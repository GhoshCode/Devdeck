// A (Weather) + B (UV index) data. Sources, all key-free and CORS-open (so the
// website and the extension behave the same):
//   • Open-Meteo (ECMWF / national models) — primary: temperature, code, UV
//   • MET Norway (Norwegian Meteorological Institute) — automatic fallback
//   • api-bdc.io (BigDataCloud) reverse geocoding — city and postcode
// Nothing is ever invented: if every source fails, the widget says so.

import { readCache, writeCache } from '../lib/cache';

export type UvRisk = 'low' | 'moderate' | 'high' | 'very-high' | 'extreme';
export type WeatherIcon = 'sun' | 'moon' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';

export type WeatherSource = 'Open-Meteo' | 'MET Norway';

export interface WeatherData {
  temperature: number; // °C
  conditionCode: number; // WMO code (MET Norway symbols are mapped onto it)
  conditionText: string;
  icon: WeatherIcon;
  place: string; // city / locality, or a timezone-derived label
  postcode: string | null;
  uvIndex: number;
  uvRisk: UvRisk;
  source: WeatherSource;
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

async function fetchOpenMeteo(place: Place, fetcher: Fetch, now: number): Promise<WeatherData> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${place.lat.toFixed(3)}&longitude=${place.lon.toFixed(3)}` +
    '&current=temperature_2m,weather_code,uv_index,is_day&timezone=auto';
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const json = (await res.json()) as {
    timezone?: string;
    current?: { temperature_2m: number; weather_code: number; uv_index?: number; is_day?: number };
  };
  const cur = json.current;
  if (!cur) throw new Error('Weather response had no current conditions');
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
    source: 'Open-Meteo',
    fetchedAt: now,
  };
}

async function fetchMetNorway(place: Place, fetcher: Fetch, now: number): Promise<WeatherData> {
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
    source: 'MET Norway',
    fetchedAt: now,
  };
}

// Primary source first; if it is down, the fallback answers instead.
export async function fetchWeather(place: Place, fetcher: Fetch = fetch, now = Date.now()): Promise<WeatherData> {
  const f = withTimeout(fetcher);
  try {
    return await fetchOpenMeteo(place, f, now);
  } catch (primary) {
    try {
      return await fetchMetNorway(place, f, now);
    } catch {
      throw primary instanceof Error ? primary : new Error('Weather unavailable');
    }
  }
}

export interface WeatherPrefs {
  useGeolocation: boolean;
  manualCity: string;
}

// Cache key: which location *source* the reading is for, so changing the
// manual city or toggling geolocation invalidates the cached reading.
const cacheKey = (p: WeatherPrefs) =>
  p.useGeolocation ? 'geo' : `city:${p.manualCity.trim().toLowerCase()}`;

export function cachedWeather(prefs: WeatherPrefs): WeatherData | null {
  return readCache<WeatherData>(CACHE_NAME, cacheKey(prefs), WEATHER_TTL_MS);
}

// Geolocation first (if enabled; re-read every refresh so a moved laptop gets
// local weather), falling back to the manual city.
export async function loadWeather(prefs: WeatherPrefs, opts: { force?: boolean } = {}): Promise<WeatherData> {
  if (!opts.force) {
    const hit = cachedWeather(prefs);
    if (hit) return hit;
  }
  const city = prefs.manualCity.trim();
  let place: Place;
  if (prefs.useGeolocation) {
    try {
      const fix = await browserPosition();
      place = { ...fix, ...(await reverseGeocode(fix.lat, fix.lon)) };
    } catch (err) {
      if (!city) throw err;
      place = await geocodeCity(city);
    }
  } else if (city) {
    place = await geocodeCity(city);
  } else {
    throw new Error('Set a city in Settings → Profile');
  }
  const data = await fetchWeather(place);
  writeCache(CACHE_NAME, cacheKey(prefs), data);
  return data;
}
