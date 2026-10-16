import { useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../../store';
import { PRESET_THEMES, type PresetTheme } from '../../store/themes';
import { DEFAULT_SETTINGS } from '../../store/seed';
import { withThemeTransition } from '../../lib/themeTransition';
import { contrastWithWhite, switchModePatch, systemMode } from '../../lib/appearance';
import { useNow } from '../../hooks/useNow';
import { CLOCK_STYLES, CLOCK_STYLE_NAMES } from '../topbar/TimeWidget';
import type { ClockStyle, Settings, ThemeMode } from '../../types';

// Settings → Appearance, ordered the way people tune a look:
//   live preview → Light / Dark / Auto → accent → theme gallery →
//   backdrop & glass → clock → greeting, with a reset at the end.
// Every control applies instantly; the preview mirrors the page that the
// Settings sheet is covering.

// macOS System Settings accents, plus DevDeck's own magenta.
const ACCENTS = [
  { name: 'Blue', hex: '#007aff' },
  { name: 'Purple', hex: '#a550a7' },
  { name: 'Pink', hex: '#f74f9e' },
  { name: 'Magenta', hex: '#ff2e9a' },
  { name: 'Red', hex: '#ff5257' },
  { name: 'Orange', hex: '#f7821b' },
  { name: 'Yellow', hex: '#ffc600' },
  { name: 'Green', hex: '#62ba46' },
  { name: 'Graphite', hex: '#8c8c8c' },
];

const CLOCK_FONT: Record<ClockStyle, string> = {
  dseg7: 'font-clock',
  cyberpunk: 'font-cyber font-bold tracking-wide',
  macos: 'font-mac font-light',
};

const DARK_PANEL = 'radial-gradient(ellipse at 50% 0%, #1c0e35 0%, #0b0713 100%)';
const backdropFor = (s: Pick<Settings, 'backgroundImage' | 'presetTheme' | 'themeMode'>) => {
  if (s.backgroundImage) {
    return /gradient\(/.test(s.backgroundImage) ? s.backgroundImage : `center / cover url("${s.backgroundImage}")`;
  }
  const preset = PRESET_THEMES.find((p) => p.id === s.presetTheme);
  return preset?.gradient ?? preset?.swatch ?? (s.themeMode === 'light' ? PRESET_THEMES[1].swatch! : DARK_PANEL);
};

type Filter = 'all' | ThemeMode;

export function AppearanceTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [filter, setFilter] = useState<Filter>('all');
  const mode = settings.themeMode ?? 'dark';

  const pickMode = (next: ThemeMode | 'auto') =>
    withThemeTransition(() => {
      const s = useStore.getState().settings;
      if (next === 'auto') updateSettings({ followSystem: true, ...switchModePatch(s, systemMode()) });
      else updateSettings({ followSystem: false, ...switchModePatch(s, next) });
    });

  const pickPreset = (preset: PresetTheme) =>
    withThemeTransition(() => {
      const s = useStore.getState().settings;
      updateSettings({
        ...switchModePatch(s, preset.mode),
        // An explicit theme for the other mode means the user wants that mode now.
        followSystem: s.followSystem && preset.mode === systemMode(),
        presetTheme: preset.id,
        accentColor: preset.accentColor,
        backgroundImage: preset.gradient,
      });
    });

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') updateSettings({ backgroundImage: reader.result, presetTheme: 'custom' });
    };
    reader.readAsDataURL(file);
  };

  const resetAppearance = () =>
    withThemeTransition(() =>
      updateSettings({
        themeMode: DEFAULT_SETTINGS.themeMode,
        presetTheme: DEFAULT_SETTINGS.presetTheme,
        accentColor: DEFAULT_SETTINGS.accentColor,
        backgroundImage: null,
        overlayOpacity: DEFAULT_SETTINGS.overlayOpacity,
        backgroundBlur: DEFAULT_SETTINGS.backgroundBlur,
        clockStyle: DEFAULT_SETTINGS.clockStyle,
        clock24h: DEFAULT_SETTINGS.clock24h,
        showSeconds: DEFAULT_SETTINGS.showSeconds,
        followSystem: false,
        modeLooks: undefined,
        reduceTransparency: false,
      }),
    );

  const presets = PRESET_THEMES.filter((p) => filter === 'all' || p.mode === filter);
  const lowContrast = contrastWithWhite(settings.accentColor) < 3;
  const customAccent = !ACCENTS.some((a) => a.hex.toLowerCase() === settings.accentColor.toLowerCase());

  return (
    <div className="max-w-3xl space-y-6 p-6 text-sm text-white/90">
      <div>
        <h3 className="font-display text-[1rem] font-semibold tracking-wide text-white">Appearance</h3>
        <p className="text-xs text-white/50">Changes apply instantly — the preview shows the page behind this sheet.</p>
      </div>

      <LivePreview settings={settings} />

      <Section title="Appearance" hint="Auto follows your system's light and dark setting. Each mode remembers its own theme.">
        <div role="radiogroup" aria-label="Appearance mode" className="grid grid-cols-3 gap-3">
          {(['light', 'dark', 'auto'] as const).map((m) => {
            const checked = m === 'auto' ? !!settings.followSystem : !settings.followSystem && mode === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'Auto'}
                onClick={() => pickMode(m)}
                className="group flex flex-col items-center gap-2 rounded-xl p-1.5 text-center"
              >
                <ModeThumb mode={m} accent={settings.accentColor} selected={checked} />
                <span className={`text-xs font-semibold ${checked ? 'text-white' : 'text-white/60 group-hover:text-white/85'}`}>
                  {m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'Auto'}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Accent colour" hint="Buttons, focus rings, highlights and the active tab.">
        <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap items-center gap-2.5">
          {ACCENTS.map((a) => {
            const checked = a.hex.toLowerCase() === settings.accentColor.toLowerCase();
            return (
              <button
                key={a.hex}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={a.name}
                title={a.name}
                onClick={() => updateSettings({ accentColor: a.hex })}
                className={`accent-swatch relative size-7 rounded-full transition-transform hover:scale-110 ${checked ? 'is-active' : ''}`}
                style={{ backgroundColor: a.hex } as CSSProperties}
              >
                {checked && <span className="absolute inset-0 m-auto size-2 rounded-full bg-white" />}
              </button>
            );
          })}
          <label
            className={`accent-swatch relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full ${customAccent ? 'is-active' : ''}`}
            title="Custom colour"
            style={{
              background: customAccent
                ? settings.accentColor
                : 'conic-gradient(#ff5257, #ffc600, #62ba46, #00c7be, #007aff, #a550a7, #ff5257)',
            }}
          >
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => updateSettings({ accentColor: e.target.value })}
              aria-label="Custom accent colour"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <span className="ml-1 font-mono text-[11px] text-white/45 uppercase">{settings.accentColor}</span>
        </div>
        {lowContrast && (
          <p role="note" className="mt-2.5 text-[11px] text-amber-300">
            White text on this colour is hard to read — buttons will look washed out.
          </p>
        )}
      </Section>

      <Section
        title="Themes"
        hint="A backdrop with a matching accent. Picking one switches to its mode."
        aside={
          <div role="tablist" aria-label="Filter themes" className="segmented flex rounded-lg p-0.5">
            {(['all', 'light', 'dark'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize ${
                  filter === f ? 'segmented-on text-white' : 'text-white/55 hover:text-white/85'
                }`}
              >
                {f} <span className="font-mono text-white/40">{f === 'all' ? PRESET_THEMES.length : PRESET_THEMES.filter((p) => p.mode === f).length}</span>
              </button>
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {presets.map((preset) => {
            const selected = settings.presetTheme === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() => pickPreset(preset)}
                className={`theme-card group flex flex-col overflow-hidden rounded-xl border text-left transition-[transform,box-shadow] hover:-translate-y-0.5 ${
                  selected ? 'is-active' : ''
                }`}
              >
                <ThemeThumb preset={preset} />
                <span className="flex items-center gap-2 px-2.5 pt-2">
                  <span className="truncate text-xs font-semibold text-white">{preset.name}</span>
                  <span className="ml-auto shrink-0 rounded px-1 font-mono text-[9px] text-white/45 uppercase">{preset.mode}</span>
                </span>
                <span className="block truncate px-2.5 pt-0.5 pb-2.5 text-[10px] text-white/45">{preset.description}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Backdrop & glass" hint="Your own wallpaper, how much it is dimmed and blurred, and how see-through panels are.">
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.backgroundImage?.startsWith('data:') ? 'Uploaded image' : (settings.backgroundImage ?? '')}
            readOnly={settings.backgroundImage?.startsWith('data:')}
            onChange={(e) =>
              updateSettings({ backgroundImage: e.target.value || null, presetTheme: e.target.value ? 'custom' : settings.presetTheme })
            }
            placeholder="Image URL or CSS gradient…"
            aria-label="Custom backdrop"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
          />
          <label className="btn-secondary cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-medium text-white transition-colors">
            Upload
            <input type="file" accept="image/*" onChange={onUpload} className="hidden" aria-label="Upload a backdrop image" />
          </label>
          {settings.backgroundImage && (
            <button
              type="button"
              onClick={() => withThemeTransition(() => updateSettings({ backgroundImage: null, presetTheme: `default-${mode}` }))}
              className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20"
            >
              Remove
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Slider
            label="Dim backdrop"
            value={Math.round(settings.overlayOpacity * 100)}
            unit="%"
            min={0}
            max={100}
            step={5}
            onChange={(v) => updateSettings({ overlayOpacity: v / 100 })}
          />
          <Slider
            label="Blur backdrop"
            value={settings.backgroundBlur}
            unit="px"
            min={0}
            max={40}
            step={1}
            onChange={(v) => updateSettings({ backgroundBlur: v })}
          />
        </div>
        <Toggle
          label="Reduce transparency"
          hint="Solid panels instead of glass — sharper text, less GPU work."
          checked={!!settings.reduceTransparency}
          onChange={(v) => updateSettings({ reduceTransparency: v })}
        />
      </Section>

      <Section title="Clock" hint="You can also click the clock on the dashboard to cycle faces.">
        <ClockFaces
          style={settings.clockStyle}
          h24={settings.clock24h}
          accent={settings.accentColor}
          onPick={(id) => updateSettings({ clockStyle: id })}
        />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div role="radiogroup" aria-label="Clock format" className="segmented flex rounded-lg p-0.5">
            {[
              { v: false, label: '12-hour' },
              { v: true, label: '24-hour' },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={settings.clock24h === o.v}
                onClick={() => updateSettings({ clock24h: o.v })}
                className={`rounded-md px-3 py-1 text-[11px] font-semibold ${
                  settings.clock24h === o.v ? 'segmented-on text-white' : 'text-white/55 hover:text-white/85'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <Toggle inline label="Show seconds" checked={settings.showSeconds} onChange={(v) => updateSettings({ showSeconds: v })} />
        </div>
      </Section>

      <Section title="Greeting" hint="Shown after Good morning / afternoon / evening.">
        <input
          type="text"
          value={settings.greetingName}
          onChange={(e) => updateSettings({ greetingName: e.target.value })}
          placeholder="Your name"
          aria-label="Greeting name"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
        />
      </Section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={resetAppearance}
          className="btn-secondary rounded-xl border px-3.5 py-2 text-xs text-white/70 hover:text-white"
        >
          Reset appearance to defaults
        </button>
      </div>
    </div>
  );
}

function Section({ title, hint, aside, children }: { title: string; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="glass-inner rounded-2xl border border-white/10 p-5">
      <div className="mb-3.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-semibold tracking-wider text-white/85 uppercase">{title}</h4>
          {hint && <p className="mt-0.5 text-[11px] text-white/45">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Slider(props: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex justify-between text-xs">
        <span className="text-white/70">{props.label}</span>
        <span className="font-mono text-white/45 tabular-nums">
          {props.value}
          {props.unit}
        </span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-accent)]"
      />
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  inline = false,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  inline?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-3 ${inline ? '' : 'mt-4 border-t border-white/[0.07] pt-4'}`}>
      <div className={inline ? '' : 'min-w-0 flex-1'}>
        <span className="text-xs text-white/80">{label}</span>
        {hint && <p className="text-[11px] text-white/45">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`switch relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${checked ? 'is-on' : ''}`}
      >
        <span
          className={`absolute top-[3px] left-[3px] size-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </div>
  );
}

// A tiny DevDeck: top bar, search, three columns — painted with the live settings.
function LivePreview({ settings }: { settings: Settings }) {
  const light = (settings.themeMode ?? 'dark') === 'light';
  const solid = !!settings.reduceTransparency;
  const panel: CSSProperties = {
    background: solid ? (light ? '#ffffff' : '#1b1329') : light ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${light ? 'rgba(60,60,67,0.12)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: solid ? undefined : 'blur(6px)',
  };
  const ink = light ? 'rgba(29,29,31,0.75)' : 'rgba(255,255,255,0.8)';
  const muted = light ? 'rgba(60,60,67,0.18)' : 'rgba(255,255,255,0.14)';
  const now = useNow(30_000);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !settings.clock24h }).replace(/\s?[AP]M$/i, '');

  return (
    <div
      data-testid="appearance-preview"
      aria-label="Live preview"
      role="img"
      className="relative overflow-hidden rounded-2xl border border-white/10"
      style={{ background: backdropFor(settings), height: 168 }}
    >
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${settings.backgroundImage ? settings.overlayOpacity * 0.6 : 0})` }} />
      <div className="relative grid h-full grid-rows-[46px_22px_1fr] gap-2 p-3">
        <div className="grid grid-cols-[1.1fr_1fr_1fr_0.9fr] gap-2">
          <div className="flex items-center justify-center rounded-lg" style={panel}>
            <span className={`${CLOCK_FONT[settings.clockStyle]} text-[18px] leading-none`} style={{ color: settings.clockStyle === 'macos' ? ink : settings.accentColor }}>
              {time}
            </span>
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="space-y-1.5 rounded-lg p-2" style={panel}>
              <div className="h-1.5 w-1/2 rounded-full" style={{ background: muted }} />
              <div className="h-1.5 w-4/5 rounded-full" style={{ background: muted }} />
            </div>
          ))}
          <div className="flex flex-col items-end justify-center pr-1">
            <div className="h-1.5 w-3/4 rounded-full" style={{ background: settings.accentColor, opacity: 0.85 }} />
            <div className="mt-1.5 h-2.5 w-full rounded-full" style={{ background: ink, opacity: 0.6 }} />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-lg px-2" style={panel}>
            <div className="h-1.5 w-1/3 rounded-full" style={{ background: muted }} />
          </div>
          <div className="w-14 rounded-lg" style={{ background: settings.accentColor }} />
        </div>
        <div className="grid grid-cols-[0.8fr_2.2fr_1fr] gap-2">
          <div className="rounded-lg" style={panel} />
          <div className="grid grid-cols-2 gap-2 rounded-lg p-2" style={panel}>
            {[0, 1].map((i) => (
              <div key={i} className="rounded-md p-1.5" style={{ ...panel, background: light ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.06)' }}>
                <div className="h-1.5 w-1/3 rounded-full" style={{ background: settings.accentColor }} />
              </div>
            ))}
          </div>
          <div className="rounded-lg" style={panel} />
        </div>
      </div>
    </div>
  );
}

function ModeThumb({ mode, accent, selected }: { mode: 'light' | 'dark' | 'auto'; accent: string; selected: boolean }) {
  const pane = (light: boolean) => (
    <div
      className="absolute inset-0 p-2"
      style={{
        background: light
          ? 'linear-gradient(160deg, #dfe7f8, #f6eef3)'
          : 'linear-gradient(160deg, #1d1033, #0b0713)',
      }}
    >
      <div className="mb-1.5 flex gap-1">
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} className="size-1.5 rounded-full" style={{ background: c }} />
        ))}
      </div>
      <div className="flex gap-1.5">
        <div className="h-9 w-1/3 rounded" style={{ background: light ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.09)' }} />
        <div className="flex-1 space-y-1 rounded p-1.5" style={{ background: light ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.09)' }}>
          <div className="h-1 w-2/3 rounded-full" style={{ background: accent }} />
          <div className="h-1 w-1/2 rounded-full" style={{ background: light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>
    </div>
  );
  return (
    <div className={`mode-thumb relative aspect-[16/10] w-full overflow-hidden rounded-lg ${selected ? 'is-active' : ''}`}>
      {mode === 'auto' ? (
        <>
          {pane(true)}
          <div className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}>
            {pane(false)}
          </div>
        </>
      ) : (
        pane(mode === 'light')
      )}
    </div>
  );
}

function ThemeThumb({ preset }: { preset: PresetTheme }) {
  const light = preset.mode === 'light';
  const glass = light ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.08)';
  return (
    <span
      className="relative block h-16 w-full"
      style={{ background: preset.gradient ?? preset.swatch ?? DARK_PANEL }}
      aria-hidden
    >
      <span className="absolute top-2 right-2 left-2 flex gap-1">
        <span className="h-3 flex-1 rounded-sm" style={{ background: glass }} />
        <span className="h-3 w-5 rounded-sm" style={{ background: preset.accentColor }} />
      </span>
      <span className="absolute right-2 bottom-2 left-2 grid h-6 grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-sm" style={{ background: glass }} />
        ))}
      </span>
      <span className="theme-check absolute top-1/2 left-1/2 hidden size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-bold text-white shadow">
        ✓
      </span>
    </span>
  );
}

function ClockFaces({
  style,
  h24,
  accent,
  onPick,
}: {
  style: ClockStyle;
  h24: boolean;
  accent: string;
  onPick: (id: ClockStyle) => void;
}) {
  const now = useNow(30_000);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !h24 }).replace(/\s?[AP]M$/i, '');
  return (
    <div role="radiogroup" aria-label="Clock style" className="grid grid-cols-3 gap-3">
      {CLOCK_STYLES.map((id) => {
        const checked = style === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={CLOCK_STYLE_NAMES[id]}
            onClick={() => onPick(id)}
            className={`clock-card flex flex-col items-center gap-2 rounded-xl border px-2 pt-4 pb-2.5 ${checked ? 'is-active' : ''}`}
          >
            <span
              className={`${CLOCK_FONT[id]} text-[26px] leading-none`}
              style={{ color: id === 'macos' ? undefined : accent, textShadow: id === 'cyberpunk' ? `0 0 12px ${accent}` : undefined }}
            >
              {time}
            </span>
            <span className={`text-[11px] font-medium ${checked ? 'text-white' : 'text-white/55'}`}>{CLOCK_STYLE_NAMES[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
