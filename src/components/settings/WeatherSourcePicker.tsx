import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useStore } from '../../store';
import { requestHostAccess } from '../../lib/env';
import { clearCache } from '../../lib/cache';
import { WEATHER_PROVIDERS, resolvePlace, testWeatherSource } from '../../services/weather';
import type { CustomWeatherSource } from '../../types';

// Settings → Profile: where weather comes from. A dropdown with Auto, the
// built-in providers and any user-added source, plus "Add custom source…" so
// the widget keeps working if a provider ever shuts down. The chosen source
// is tried first; the others remain as fallbacks.

type Option = { id: string; name: string; detail: string; custom?: boolean };

export function WeatherSourcePicker() {
  const weatherSource = useStore((s) => s.settings.weatherSource ?? 'auto');
  const custom = useStore((s) => s.settings.customWeatherSources ?? []);
  const useGeolocation = useStore((s) => s.settings.useGeolocation);
  const manualCity = useStore((s) => s.settings.manualCity);
  const updateSettings = useStore((s) => s.updateSettings);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const options: Option[] = [
    { id: 'auto', name: 'Auto', detail: 'Best available — Open-Meteo, then the others' },
    ...WEATHER_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      detail:
        p.id === 'open-meteo'
          ? 'ECMWF & national models'
          : p.id === 'met-norway'
            ? 'Norwegian Met Institute'
            : 'World Weather Online data',
    })),
    ...custom.map((c) => ({
      id: c.id,
      name: c.name,
      detail: new URL(c.apiUrl.replace(/\{(lat|lon)\}/g, '0')).host,
      custom: true,
    })),
  ];
  const current = options.find((o) => o.id === weatherSource) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (id: string) => {
    updateSettings({ weatherSource: id });
    clearCache('weather');
    setOpen(false);
  };
  const remove = (id: string) => {
    updateSettings({
      customWeatherSources: custom.filter((c) => c.id !== id),
      weatherSource: weatherSource === id ? 'auto' : weatherSource,
    });
    clearCache('weather');
  };

  // Rows: every option, then "Add custom source…".
  const rowCount = options.length + 1;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActive(
          Math.max(
            0,
            options.findIndex((o) => o.id === current.id),
          ),
        );
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.stopPropagation(); // keep Settings open
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + rowCount) % rowCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active < options.length) choose(options[active].id);
      else {
        setOpen(false);
        setAdding(true);
      }
    }
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold tracking-wider text-white/80 uppercase">Weather source</span>
      <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Weather source: ${current.name}`}
          onClick={() => setOpen((o) => !o)}
          className="dropdown-trigger flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left"
        >
          <SourceIcon id={current.id} custom={current.custom} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-white">{current.name}</span>
            <span className="block truncate text-[11px] text-white/55">{current.detail}</span>
          </span>
          <svg
            className={`size-3.5 text-white/55 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div
            role="listbox"
            aria-label="Weather sources"
            className="dropdown-menu absolute top-full right-0 left-0 z-20 mt-1.5 overflow-hidden rounded-xl border py-1 shadow-2xl"
          >
            {options.map((o, i) => (
              <div
                key={o.id}
                role="option"
                aria-selected={o.id === current.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o.id)}
                className={`flex cursor-pointer items-center gap-3 px-3.5 py-2 ${active === i ? 'dropdown-active' : ''}`}
              >
                <SourceIcon id={o.id} custom={o.custom} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-white">{o.name}</span>
                  <span className="block truncate text-[11px] text-white/55">{o.detail}</span>
                </span>
                {o.id === current.id && <span className="text-xs text-[var(--color-accent)]">✓</span>}
                {o.custom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(o.id);
                    }}
                    aria-label={`Remove ${o.name}`}
                    title="Remove this source"
                    className="rounded px-1 text-xs text-white/45 hover:text-red-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div className="mx-3 my-1 h-px bg-white/[0.08]" />
            <div
              role="option"
              aria-selected={false}
              onMouseEnter={() => setActive(options.length)}
              onClick={() => {
                setOpen(false);
                setAdding(true);
              }}
              className={`flex cursor-pointer items-center gap-3 px-3.5 py-2 text-xs font-semibold text-[var(--color-accent)] ${
                active === options.length ? 'dropdown-active' : ''
              }`}
            >
              <span className="flex size-7 items-center justify-center rounded-lg border border-dashed border-current text-sm">
                +
              </span>
              Add custom source…
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-white/55">
        Your choice is tried first; if it fails, the other sources take over. Clicking the weather opens the site the
        reading came from.
      </p>
      {adding && (
        <AddSourceForm
          place={{ useGeolocation, manualCity }}
          onCancel={() => setAdding(false)}
          onSave={(src) => {
            updateSettings({ customWeatherSources: [...custom, src], weatherSource: src.id });
            clearCache('weather');
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function AddSourceForm({
  place,
  onCancel,
  onSave,
}: {
  place: { useGeolocation: boolean; manualCity: string };
  onCancel: () => void;
  onSave: (s: CustomWeatherSource) => void;
}) {
  const [name, setName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; text?: string }>({ kind: 'idle' });

  const source = (): CustomWeatherSource | null => {
    const api = apiUrl.trim();
    if (!/^https:\/\/\S+$/.test(api) || !api.includes('{lat}') || !api.includes('{lon}')) return null;
    return {
      id: `custom-${Date.now().toString(36)}`,
      name: name.trim() || new URL(api.replace(/\{(lat|lon)\}/g, '0')).host,
      apiUrl: api,
      siteUrl: siteUrl.trim(),
    };
  };

  const test = async () => {
    const src = source();
    if (!src) return setStatus({ kind: 'error', text: 'Use an https:// URL containing {lat} and {lon}.' });
    setStatus({ kind: 'testing' });
    try {
      if (!(await requestHostAccess(src.apiUrl.replace(/\{(lat|lon)\}/g, '0'))))
        throw new Error('Permission to reach this site was not granted');
      const data = await testWeatherSource(src, await resolvePlace(place));
      setStatus({
        kind: 'ok',
        text: `Works — ${Math.round(data.temperature)}°C, ${data.conditionText}, UV ${data.uvIndex.toFixed(1)}`,
      });
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'The source did not answer' });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const src = source();
    if (!src) return setStatus({ kind: 'error', text: 'Use an https:// URL containing {lat} and {lon}.' });
    if (!(await requestHostAccess(src.apiUrl.replace(/\{(lat|lon)\}/g, '0'))))
      return setStatus({ kind: 'error', text: 'Permission to reach this site was not granted' });
    onSave(src);
  };

  const field =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none';

  return (
    <form
      onSubmit={submit}
      aria-label="Add a weather source"
      className="sub-panel mt-2 space-y-3 rounded-xl border p-4"
    >
      <div>
        <h4 className="text-xs font-semibold text-white">Add a custom weather source</h4>
        <p className="mt-0.5 text-[11px] text-white/55">
          Any API that answers in Open-Meteo's format — a mirror, a self-hosted Open-Meteo, or a compatible service. Use{' '}
          <code className="font-mono">{'{lat}'}</code> and <code className="font-mono">{'{lon}'}</code> for the
          location.
        </p>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name, e.g. My Open-Meteo"
        aria-label="Source name"
        className={field}
      />
      <input
        value={apiUrl}
        onChange={(e) => setApiUrl(e.target.value)}
        placeholder="https://api.example.com/v1/forecast?latitude={lat}&longitude={lon}"
        aria-label="API URL"
        spellCheck={false}
        className={`${field} font-mono`}
      />
      <input
        value={siteUrl}
        onChange={(e) => setSiteUrl(e.target.value)}
        placeholder="Website to open on click (optional) — may use {lat} and {lon}"
        aria-label="Website URL"
        spellCheck={false}
        className={`${field} font-mono`}
      />
      {status.kind !== 'idle' && (
        <p
          role="status"
          className={`text-[11px] ${status.kind === 'error' ? 'text-red-300' : status.kind === 'ok' ? 'text-emerald-300' : 'text-white/60'}`}
        >
          {status.kind === 'testing' ? 'Testing…' : status.text}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary rounded-xl border px-3 py-1.5 text-xs text-white/70"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={test}
          className="btn-secondary rounded-xl border px-3 py-1.5 text-xs text-white/85"
        >
          Test
        </button>
        <button type="submit" className="accent-gradient rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white">
          Add &amp; use
        </button>
      </div>
    </form>
  );
}

function SourceIcon({ id, custom }: { id: string; custom?: boolean }) {
  const glyph = custom ? '🔗' : id === 'auto' ? '✨' : id === 'open-meteo' ? '🌤️' : id === 'met-norway' ? '🇳🇴' : '🌍';
  return (
    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-sm">
      {glyph}
    </span>
  );
}
