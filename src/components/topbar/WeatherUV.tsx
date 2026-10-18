import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../../store';
import {
  UV_LABEL,
  WEATHER_TTL_MS,
  cachedWeather,
  loadWeather,
  type UvRisk,
  type WeatherData,
  type WeatherIcon,
} from '../../services/weather';

// Under the clock: `lead` (the date line), then A (weather °C) and B (UV
// badge) on the same line, and the place — area, city, pincode — below.
// Refreshes every 15 min. Click to refresh now; double-click to open the page
// of the source the reading came from.

const ICON: Record<WeatherIcon, string> = {
  sun: '☀️',
  moon: '🌙',
  partly: '⛅',
  cloud: '☁️',
  fog: '🌫️',
  rain: '🌧️',
  snow: '❄️',
  storm: '⛈️',
};

// Spec §3.2 colour bands.
const UV_BADGE: Record<UvRisk, string> = {
  low: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
  moderate: 'bg-yellow-400/20 text-yellow-200 border-yellow-300/40',
  high: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
  'very-high': 'bg-red-500/25 text-red-300 border-red-400/50',
  extreme: 'bg-purple-500/25 text-purple-300 border-purple-400/50',
};

type State =
  | { status: 'loading'; data: WeatherData | null }
  | { status: 'ready'; data: WeatherData }
  | { status: 'error'; data: WeatherData | null; error: string };

// onSetup: opens Settings → Profile when there is no usable location.
export const WeatherUV = memo(function WeatherUV({ onSetup, lead }: { onSetup?: () => void; lead?: ReactNode }) {
  const enabled = useStore((s) => s.settings.weatherEnabled);
  const useGeolocation = useStore((s) => s.settings.useGeolocation);
  const manualCity = useStore((s) => s.settings.manualCity);
  const weatherSource = useStore((s) => s.settings.weatherSource);
  const customWeatherSources = useStore((s) => s.settings.customWeatherSources);
  const prefs = useMemo(
    () => ({ useGeolocation, manualCity, weatherSource, customWeatherSources }),
    [useGeolocation, manualCity, weatherSource, customWeatherSources],
  );
  const [state, setState] = useState<State>(() => {
    const hit = cachedWeather(prefs);
    return hit ? { status: 'ready', data: hit } : { status: 'loading', data: null };
  });

  const refresh = useCallback(
    (force: boolean) => {
      let cancelled = false;
      setState((s) => ({ status: 'loading', data: s.data }));
      loadWeather(prefs, { force })
        .then((data) => !cancelled && setState({ status: 'ready', data }))
        .catch(
          (err: unknown) =>
            !cancelled &&
            setState((s) => ({
              status: 'error',
              data: s.data,
              error: err instanceof Error ? err.message : 'Weather unavailable',
            })),
        );
      return () => {
        cancelled = true;
      };
    },
    [prefs],
  );

  // Load on mount / location change, then keep it fresh while the tab stays open.
  useEffect(() => {
    if (!enabled) return;
    const cancel = refresh(false);
    const timer = setInterval(() => refresh(false), WEATHER_TTL_MS);
    return () => {
      cancel();
      clearInterval(timer);
    };
  }, [enabled, refresh]);

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (clickTimer.current && clearTimeout(clickTimer.current)), []);

  if (!enabled) return <>{lead}</>;

  const { data } = state;
  const error = state.status === 'error' ? state.error : null;

  // First run with location denied and no city: say what to do instead of
  // showing a bare warning and "--°C".
  const row = 'flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-0.5 text-left';

  if (!data && error && !manualCity.trim() && onSetup) {
    return (
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {lead}
        <button
          type="button"
          onClick={onSetup}
          title={`${error} — set a city in Settings → Profile`}
          aria-label="Set your location for weather"
          data-testid="weather-uv"
          className={`${row} hover:bg-white/[0.04]`}
        >
          <span aria-hidden className="text-sm leading-none">
            📍
          </span>
          <span className="text-[11px] leading-tight font-semibold text-white/90">Set location</span>
          <span className="text-[10px] leading-tight text-white/50">for weather &amp; UV</span>
        </button>
      </div>
    );
  }

  const where = data ? [data.area, data.place].filter(Boolean).join(', ') : '';
  const updated = data
    ? new Date(data.fetchedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const site = !error && data?.siteUrl ? data.siteUrl : null;
  const title = error
    ? `${error} — click to retry`
    : data
      ? `${data.conditionText} in ${where}${data.postcode ? ` ${data.postcode}` : ''} · ${data.source}, updated ${updated}\nClick to refresh · double-click to open ${data.source}`
      : 'Loading weather…';

  // One click refreshes; a double click opens the source's page instead (the
  // single click waits a moment so a double click doesn't also refresh).
  const onClick = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      refresh(true);
    }, 260);
  };
  const onDoubleClick = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = null;
    if (site) window.open(site, '_blank', 'noopener');
  };

  const handlers = { onClick, onDoubleClick, title };
  return (
    <div className="flex max-w-full min-w-0 flex-col items-start gap-1">
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {lead}
        <button
          type="button"
          {...handlers}
          aria-label={
            data
              ? `Weather in ${where}: ${Math.round(data.temperature)}°C, ${data.conditionText}, UV ${data.uvIndex.toFixed(1)} ${UV_LABEL[data.uvRisk]}. Click to refresh, double-click to open ${data.source}`
              : 'Weather'
          }
          data-testid="weather-uv"
          className={`${row} -my-0.5 cursor-pointer transition-colors select-none hover:bg-white/[0.05] ${
            state.status === 'loading' ? (data ? 'opacity-70' : 'animate-pulse') : ''
          }`}
        >
          {/* A — condition + temperature */}
          <span className="flex items-center gap-1.5 text-white/90">
            <span aria-hidden className="text-base leading-none">
              {data ? ICON[data.icon] : error ? '⚠️' : '·'}
            </span>
            <span className="font-mac text-[1.05rem] leading-none font-light tracking-tight tabular-nums">
              {data ? `${Math.round(data.temperature)}°` : '--°'}
              <span className="text-[0.7rem] text-white/55">C</span>
            </span>
          </span>
          {/* B — UV index */}
          <span
            className={`rounded-full border px-2 py-px text-[9.5px] font-medium tracking-wide ${
              data ? UV_BADGE[data.uvRisk] : 'border-white/15 text-white/40'
            }`}
          >
            UV {data ? data.uvIndex.toFixed(1) : '--'} · {data ? UV_LABEL[data.uvRisk] : '—'}
          </span>
        </button>
      </div>
      {/* The place: area, city, pincode — one weight, the city a touch larger */}
      <span
        {...handlers}
        data-testid="weather-place"
        className="flex max-w-full min-w-0 cursor-pointer items-baseline gap-1.5 leading-tight font-medium text-white/80 select-none"
      >
        <span aria-hidden className="self-center text-[10px]">
          📍
        </span>
        {data ? (
          <>
            {data.area && <span className="truncate text-[12px]">{data.area},</span>}
            <span className="shrink-0 text-[13.5px] text-white/90">{data.place}</span>
            {data.postcode && <span className="shrink-0 font-mono text-[12px] text-white/65">{data.postcode}</span>}
          </>
        ) : (
          <span className="text-[12px]">{error ? 'Unavailable' : 'Locating…'}</span>
        )}
      </span>
    </div>
  );
});
