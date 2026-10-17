// A (Weather) + B (UV index) data. Sources, all key-free and CORS-open (so the
// website and the extension behave the same):
//   • Open-Meteo (ECMWF / national models) — default first choice
//   • MET Norway (Norwegian Meteorological Institute, yr.no)
//   • wttr.in (World Weather Online data)
//   • any number of user-added Open-Meteo-compatible sources (Settings → Profile)
//   • api-bdc.io (BigDataCloud) reverse geocoding — city and postcode
// The chosen source is tried first and the rest take over if it fails.
// Nothing is ever invented: if every source fails, the widget says so.

import { readCache, writeCache } from '../lib/cache';
import type { CustomWeatherSource } from '../types';

export type UvRisk = 'low' | 'moderate' | 'high' | 'very-high' | 'extreme';
export type WeatherIcon = 'sun' | 'moon' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';

// Built-in providers. site: the page opened when the weather is clicked.
export const WEATHER_PROVIDERS = [
  { id: 'open-meteo', name: 'Open-Meteo', site: 'https://open-meteo.com/en/docs?latitude={lat}&longitude={lon}' },
  { id: 'met-norway', name: 'MET Norway (yr.no)', site: 'https://www.yr.no/en/forecast/daily-table/{lat},{lon}' },
  { id: 'wttr', name: 'wttr.in', site: 'https://wttr.in/{lat},{lon}' },
] as const;
export type BuiltinProviderId = (typeof WEATHER_PROVIDERS)[number]['id'];

export const fillCoords = (template: string, lat: number, lon: number) =>
  template.replaceAll('{lat}', lat.toFixed(4)).replaceAll('{lon}', lon.toFixed(4));

export interface WeatherData {
  temperature: number; // °C
  conditionCode: number; // WMO code (MET Norway symbols are mapped onto it)
  conditionText: string;
  icon: WeatherIcon;
  place: string; // city / locality, or a timezone-derived label
  postcode: string | null;
  uvIndex: number;
  uvRisk: UvRisk;
  source: string; // provider name, shown in the tooltip
  sourceId: string;
  siteUrl: string; // the provider's page for this location
  fetchedAt: number;
}

// Location and conditions are both refreshed every 15 minutes.
export const WEATHER_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_NAME = 'weather';

// WHO bands: 0–2 Low, 3–5 Moderate, 6–7 High, 8–10 Very High, 11+ Extreme.
export function uvRisk(uv: number): UvRisk {
  const v = Math.round(uv);
  if (v <= 2) return 'low';
  if (v <= 5) return 'moderate';
  if (v <= 7) return 'high';
  if (v <= 10) return 'very-high';
  return 'extreme';
}

export const UV_LABEL: Record<UvRisk, string> = {
  low: 'Low',
  moderate: 'Mod',
  high: 'High',
  'very-high': 'V.High',
  extreme: 'Extreme',
};

// WMO weather interpretation codes → short label + icon.
export function describeWeather(code: number, isDay = true): { text: string; icon: WeatherIcon } {
  if (code === 0) return { text: 'Clear', icon: isDay ? 'sun' : 'moon' };
  if (code <= 2) return { text: 'Partly cloudy', icon: isDay ? 'partly' : 'cloud' };
  if (code === 3) return { text: 'Overcast', icon: 'cloud' };
  if (code === 45 || code === 48) return { text: 'Fog', icon: 'fog' };
  if (code >= 51 && code <= 57) return { text: 'Drizzle', icon: 'rain' };
  if (code >= 61 && code <= 67) return { text: 'Rain', icon: 'rain' };
  if (code >= 71 && code <= 77) return { text: 'Snow', icon: 'snow' };
  if (code >= 80 && code <= 82) return { text: 'Showers', icon: 'rain' };
  if (code === 85 || code === 86) return { text: 'Snow showers', icon: 'snow' };
  if (code >= 95) return { text: 'Thunderstorm', icon: 'storm' };
  return { text: 'Unknown', icon: 'cloud' };
}

// MET Norway symbol codes ("partlycloudy_day", "heavyrainshowers_night", …)
// mapped onto a representative WMO code so both sources share describeWeather.
export function metSymbolToWmo(symbol: string): { code: number; isDay: boolean } {
  const [base, variant] = symbol.split('_');
  const isDay = variant !== 'night';
  const s = base ?? '';
  let code = 3;
  if (s.includes('thunder')) code = 95;
  else if (s.includes('snow') || s.includes('sleet')) code = s.includes('showers') ? 85 : 73;
  else if (s.includes('rain')) code = s.includes('showers') ? 80 : s.startsWith('light') ? 61 : s.startsWith('heavy') ? 65 : 63;
  else if (s === 'fog') code = 45;
  else if (s === 'clearsky') code = 0;
  else if (s === 'fair') code = 1;
  else if (s === 'partlycloudy') code = 2;
  return { code, isDay };
}

export interface Place {
  lat: number;
  lon: number;
  label: string | null; // null → the forecast's timezone name
  postcode: string | null;
}

type Fetch = typeof fetch;

// Every network call gets a timeout so a hung source falls through quickly.
const withTimeout = (fetcher: Fetch): Fetch =>
  fetcher === fetch
    ? (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    : fetcher;

export async function geocodeCity(name: string, fetcher: Fetch = fetch): Promise<Place> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(name)}`;
  const res = await withTimeout(fetcher)(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const json = (await res.json()) as {
    results?: Array<{ latitude: number; longitude: number; name: string; postcodes?: string[] }>;
  };
  const hit = json.results?.[0];
  if (!hit) throw new Error(`City "${name}" not found`);
  return { lat: hit.latitude, lon: hit.longitude, label: hit.name, postcode: hit.postcodes?.[0] ?? null };
}

// City/locality and postcode for GPS coordinates. Best effort: a failure
// just leaves the label to the forecast's timezone.
export async function reverseGeocode(
  lat: number,
  lon: number,
  fetcher: Fetch = fetch,
): Promise<Pick<Place, 'label' | 'postcode'>> {
  try {
    const url = `https://api-bdc.io/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await withTimeout(fetcher)(url);
    if (!res.ok) return { label: null, postcode: null };
    const j = (await res.json()) as { city?: string; locality?: string; principalSubdivision?: string; postcode?: string };
    return { label: j.city || j.locality || j.principalSubdivision || null, postcode: j.postcode || null };
  } catch {
    return { label: null, postcode: null };
  }
}

export function browserPosition(timeoutMs = 8000): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation unavailable'));
      return;
    }
    // The API's own timeout only starts once permission is granted; an
    // unanswered prompt would otherwise leave the widget loading forever.
    setTimeout(() => reject(new Error('Location request timed out')), timeoutMs + 2000);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: null, postcode: null }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Location unavailable')),
      // A fix up to one refresh old is fine; anything older is re-read.
      { timeout: timeoutMs, maximumAge: WEATHER_TTL_MS },
    );
  });
}

// "Asia/Kolkata" → "Kolkata", "America/Argentina/Buenos_Aires" → "Buenos Aires".
export const placeFromTimezone = (tz: string): string =>
  (tz.split('/').pop() ?? tz).replace(/_/g, ' ');

interface Provider {
  id: string;
  name: string;
  site: string; // template
  fetch: (place: Place, fetcher: Fetch, now: number) => Promise<Omit<WeatherData, 'source' | 'sourceId' | 'siteUrl'>>;
}

const OPEN_METEO_API =
  'https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,uv_index,is_day&timezone=auto';

// Open-Meteo's format — also used for user-added compatible sources, whose URL
// may omit the query fields DevDeck needs; they are appended when missing.
async function fetchOpenMeteoFormat(apiTemplate: string, place: Place, fetcher: Fetch, now: number) {
  let url = fillCoords(apiTemplate, place.lat, place.lon);
  if (!/[?&]current=/.test(url)) {
    url += `${url.includes('?') ? '&' : '?'}current=temperature_2m,weather_code,uv_index,is_day&timezone=auto`;
  }
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const json = (await res.json()) as {
    timezone?: string;
    current?: { temperature_2m: number; weather_code: number; uv_index?: number; is_day?: number };
  };
  const cur = json.current;
  if (!cur || typeof cur.temperature_2m !== 'number') throw new Error('Weather response had no current conditions');
  const uv = cur.uv_index ?? 0;
  const { text, icon } = describeWeather(cur.weather_code, cur.is_day !== 0);
  return {
    temperature: cur.temperature_2m,
    conditionCode: cur.weather_code,
    conditionText: text,
    icon,
    place: place.label ?? placeFromTimezone(json.timezone ?? ''),
    postcode: place.postcode,
    uvIndex: uv,
    uvRisk: uvRisk(uv),
    fetchedAt: now,
  };
}

async function fetchMetNorway(place: Place, fetcher: Fetch, now: number) {
  // MET Norway asks for at most 4 decimals of coordinates.
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${place.lat.toFixed(4)}&lon=${place.lon.toFixed(4)}`;
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`MET Norway responded ${res.status}`);
  const json = (await res.json()) as {
    properties?: {
      timeseries?: Array<{
        data: {
          instant: { details: { air_temperature: number; ultraviolet_index_clear_sky?: number } };
          next_1_hours?: { summary: { symbol_code: string } };
        };
      }>;
    };
  };
  const first = json.properties?.timeseries?.[0];
  if (!first) throw new Error('MET Norway returned no forecast');
  const { code, isDay } = metSymbolToWmo(first.data.next_1_hours?.summary.symbol_code ?? 'cloudy');
  const { text, icon } = describeWeather(code, isDay);
  const uv = first.data.instant.details.ultraviolet_index_clear_sky ?? 0;
  return {
    temperature: first.data.instant.details.air_temperature,
    conditionCode: code,
    conditionText: text,
    icon,
    place: place.label ?? 'Your location',
    postcode: place.postcode,
    uvIndex: uv,
    uvRisk: uvRisk(uv),
    fetchedAt: now,
  };
}

// World Weather Online condition codes (used by wttr.in) → a representative WMO code.
export function wwoToWmo(code: number): number {
  if (code === 113) return 0;
  if (code === 116) return 2;
  if (code === 119 || code === 122) return 3;
  if ([143, 248, 260].includes(code)) return 45;
  if ([200, 386, 389, 392, 395].includes(code)) return 95;
  if ([179, 182, 185, 227, 230, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(code))
    return 73;
  if ([263, 266, 281, 284].includes(code)) return 53;
  if ([299, 302, 305, 308, 356, 359].includes(code)) return 65;
  if ([176, 293, 296, 311, 314, 353].includes(code)) return 61;
  return 3;
}

async function fetchWttr(place: Place, fetcher: Fetch, now: number) {
  const res = await fetcher(`https://wttr.in/${place.lat.toFixed(4)},${place.lon.toFixed(4)}?format=j1`);
  if (!res.ok) throw new Error(`wttr.in responded ${res.status}`);
  const json = (await res.json()) as {
    current_condition?: Array<{ temp_C: string; uvIndex: string; weatherCode: string }>;
    nearest_area?: Array<{ areaName?: Array<{ value: string }> }>;
  };
  const cur = json.current_condition?.[0];
  if (!cur) throw new Error('wttr.in returned no current conditions');
  const code = wwoToWmo(Number(cur.weatherCode));
  const hour = new Date(now).getHours();
  const { text, icon } = describeWeather(code, hour >= 6 && hour < 19);
  const uv = Number(cur.uvIndex) || 0;
  return {
    temperature: Number(cur.temp_C),
    conditionCode: code,
    conditionText: text,
    icon,
    place: place.label ?? json.nearest_area?.[0]?.areaName?.[0]?.value ?? 'Your location',
    postcode: place.postcode,
    uvIndex: uv,
    uvRisk: uvRisk(uv),
    fetchedAt: now,
  };
}

const BUILTIN: Record<BuiltinProviderId, Provider['fetch']> = {
  'open-meteo': (place, f, now) => fetchOpenMeteoFormat(OPEN_METEO_API, place, f, now),
  'met-norway': fetchMetNorway,
  wttr: fetchWttr,
};

function providerList(custom: readonly CustomWeatherSource[] = []): Provider[] {
  return [
    ...WEATHER_PROVIDERS.map((p) => ({ id: p.id, name: p.name, site: p.site, fetch: BUILTIN[p.id] })),
    ...custom.map((c) => ({
      id: c.id,
      name: c.name,
      site: c.siteUrl || c.apiUrl,
      fetch: (place: Place, f: Fetch, now: number) => fetchOpenMeteoFormat(c.apiUrl, place, f, now),
    })),
  ];
}

export interface SourcePrefs {
  weatherSource?: string; // 'auto' | provider id
  customWeatherSources?: CustomWeatherSource[];
}

// The preferred source first (or the default order for 'auto'), then the rest.
export async function fetchWeather(
  place: Place,
  fetcher: Fetch = fetch,
  now = Date.now(),
  prefs: SourcePrefs = {},
): Promise<WeatherData> {
  const f = withTimeout(fetcher);
  const all = providerList(prefs.customWeatherSources);
  const preferred = all.find((p) => p.id === prefs.weatherSource);
  const order = preferred ? [preferred, ...all.filter((p) => p !== preferred)] : all;
  let firstError: unknown = null;
  for (const p of order) {
    try {
      const data = await p.fetch(place, f, now);
      return { ...data, source: p.name, sourceId: p.id, siteUrl: fillCoords(p.site, place.lat, place.lon) };
    } catch (err) {
      firstError ??= err;
    }
  }
  throw firstError instanceof Error ? firstError : new Error('Weather unavailable');
}

// One request to one source — Settings → Profile uses it to check a custom source.
export async function testWeatherSource(source: CustomWeatherSource, place: Place): Promise<WeatherData> {
  const data = await fetchOpenMeteoFormat(source.apiUrl, place, withTimeout(fetch), Date.now());
  return {
    ...data,
    source: source.name,
    sourceId: source.id,
    siteUrl: fillCoords(source.siteUrl || source.apiUrl, place.lat, place.lon),
  };
}

export interface WeatherPrefs extends SourcePrefs {
  useGeolocation: boolean;
  manualCity: string;
}

// Cache key: which location *source* and weather source the reading is for,
// so changing either invalidates the cached reading.
const cacheKey = (p: WeatherPrefs) =>
  `${p.useGeolocation ? 'geo' : `city:${p.manualCity.trim().toLowerCase()}`}|${p.weatherSource ?? 'auto'}`;

export function cachedWeather(prefs: WeatherPrefs): WeatherData | null {
  const hit = readCache<WeatherData>(CACHE_NAME, cacheKey(prefs), WEATHER_TTL_MS);
  // Readings cached before sources had pages are refetched.
  return hit && hit.siteUrl ? hit : null;
}

// Where weather comes from: geolocation if enabled (re-read every refresh so a
// moved laptop gets local weather), else the manual city.
export async function resolvePlace(prefs: Pick<WeatherPrefs, 'useGeolocation' | 'manualCity'>): Promise<Place> {
  const city = prefs.manualCity.trim();
  if (prefs.useGeolocation) {
    try {
      const fix = await browserPosition();
      return { ...fix, ...(await reverseGeocode(fix.lat, fix.lon)) };
    } catch (err) {
      if (!city) throw err;
      return geocodeCity(city);
    }
  }
  if (city) return geocodeCity(city);
  throw new Error('Set a city in Settings → Profile');
}

export async function loadWeather(prefs: WeatherPrefs, opts: { force?: boolean } = {}): Promise<WeatherData> {
  if (!opts.force) {
    const hit = cachedWeather(prefs);
    if (hit) return hit;
  }
  const place = await resolvePlace(prefs);
  const data = await fetchWeather(place, fetch, Date.now(), prefs);
  writeCache(CACHE_NAME, cacheKey(prefs), data);
  return data;
}
