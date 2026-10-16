import { memo, useCallback, useEffect, useState } from 'react';
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

// A (weather °C) over B (UV badge) over the location, as the right-hand column
// of the clock + weather card. Refreshes every 15 min; click to refresh now.

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
export const WeatherUV = memo(function WeatherUV({ onSetup }: { onSetup?: () => void }) {
  const enabled = useStore((s) => s.settings.weatherEnabled);
  const useGeolocation = useStore((s) => s.settings.useGeolocation);
  const manualCity = useStore((s) => s.settings.manualCity);
  const [state, setState] = useState<State>(() => {
    const hit = cachedWeather({ useGeolocation, manualCity });
    return hit ? { status: 'ready', data: hit } : { status: 'loading', data: null };
  });

  const refresh = useCallback(
    (force: boolean) => {
      let cancelled = false;
      setState((s) => ({ status: 'loading', data: s.data }));
      loadWeather({ useGeolocation, manualCity }, { force })
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
    [useGeolocation, manualCity],
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

  if (!enabled) return <div aria-hidden className="glass h-full opacity-40" />;

  const { data } = state;
  const error = state.status === 'error' ? state.error : null;

  // First run with location denied and no city: say what to do instead of
  // showing a bare warning and "--°C".
  const column = 'flex h-full w-[150px] shrink-0 flex-col items-end justify-center gap-1 border-l border-white/[0.08] pr-3 pl-2.5 text-right';

  if (!data && error && !manualCity.trim() && onSetup) {
    return (
      <button
        type="button"
        onClick={onSetup}
        title={`${error} — set a city in Settings → Profile`}
        aria-label="Set your location for weather"
        data-testid="weather-uv"
        className={`${column} items-center text-center hover:bg-white/[0.04]`}
      >
        <span aria-hidden className="text-base leading-none">📍</span>
        <span className="text-[11px] leading-tight font-semibold text-white/90">Set location</span>
        <span className="text-[9px] leading-tight text-white/50">for weather &amp; UV</span>
      </button>
    );
  }

  const updated = data ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const title = error
    ? `${error} — click to retry`
    : data
      ? `${data.conditionText} in ${data.place}${data.postcode ? ` ${data.postcode}` : ''} · ${data.source}, updated ${updated} (refreshes every 15 min) — click to refresh now`
      : 'Loading weather…';

  return (
    <button
      type="button"
      onClick={() => refresh(true)}
      title={title}
      aria-label={
        data
          ? `Weather in ${data.place}: ${Math.round(data.temperature)}°C, ${data.conditionText}, UV ${data.uvIndex.toFixed(1)} ${UV_LABEL[data.uvRisk]}`
          : 'Weather'
      }
      data-testid="weather-uv"
      className={`${column} hover:bg-white/[0.03] ${state.status === 'loading' && !data ? 'animate-pulse' : ''}`}
    >
      {/* A — condition + temperature */}
      <span className="flex items-center gap-1.5 text-white/95">
        <span aria-hidden className="text-lg leading-none">{data ? ICON[data.icon] : error ? '⚠️' : '·'}</span>
        <span className="font-display text-[1.45rem] leading-none font-bold tracking-tight tabular-nums">
          {data ? `${Math.round(data.temperature)}°C` : '--°C'}
        </span>
      </span>
      {/* B — UV index badge */}
      <span
        className={`rounded-md border px-1.5 py-px text-[9px] font-bold tracking-wider uppercase ${
          data ? UV_BADGE[data.uvRisk] : 'border-white/15 text-white/40'
        }`}
      >
        UV {data ? data.uvIndex.toFixed(1) : '--'} · {data ? UV_LABEL[data.uvRisk] : '—'}
      </span>
      {/* Location, under the UV index */}
      <span className="flex max-w-full items-center gap-1 text-[10px] leading-tight text-white/60">
        <span aria-hidden className="text-[9px]">📍</span>
        <span className="truncate font-medium">{data?.place ?? (error ? 'Unavailable' : 'Locating…')}</span>
        {data?.postcode && <span className="shrink-0 font-mono text-[9px] text-white/40">{data.postcode}</span>}
      </span>
    </button>
  );
});
