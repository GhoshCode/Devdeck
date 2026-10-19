import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { ZoneSearch } from '../topbar/clock/faces2';
import { useStore } from '../../store';
import { PRESET_THEMES, THEME_CATEGORIES, type PresetTheme, type ThemeCategory } from '../../store/themes';
import { DEFAULT_SETTINGS } from '../../store/seed';
import { withThemeTransition } from '../../lib/themeTransition';
import { contrastWithWhite, switchModePatch, systemMode } from '../../lib/appearance';
import { DEFAULT_STUDIO, STUDIO_PALETTES, accentFromGradient, gradientCss, modeForGradient } from '../../lib/gradient';
import { useNow } from '../../hooks/useNow';
import { CLOCK_STYLE_INFO } from '../../lib/clockStyles';
import { clockParts } from '../../lib/time';
import { ClockFace } from '../topbar/clock/faces';
import { DEFAULT_ZONES, zoneCity, zoneTime } from '../../lib/zones';
import type { ClockStyle, GradientStudio, Settings, ThemeMode } from '../../types';
import { GREET_STYLES, NAME_FONTS } from '../../types';

// Settings → Appearance & Display, ordered the way people tune a look:
//   live preview → Light / Dark / Auto → accent → Gradient Studio →
//   theme gallery → wallpaper → panel glass → clock & cockpit → greeting,
//   with a reset at the end. Every control applies instantly; the preview
//   mirrors the page that the Settings sheet is covering.

// macOS System Settings accents, plus DevDeck's own magenta.
const ACCENTS = [
  { name: 'Magenta', hex: '#ff2e9a' },
  { name: 'Blue', hex: '#007aff' },
  { name: 'Purple', hex: '#a550a7' },
  { name: 'Pink', hex: '#f74f9e' },
  { name: 'Red', hex: '#ff5257' },
  { name: 'Orange', hex: '#f7821b' },
  { name: 'Yellow', hex: '#ffc600' },
  { name: 'Green', hex: '#62ba46' },
  { name: 'Teal', hex: '#00c7be' },
  { name: 'Graphite', hex: '#8c8c8c' },
];

const ANGLE_CHIPS = [
  { angle: 135, label: '↘ 135°' },
  { angle: 90, label: '→ 90°' },
  { angle: 180, label: '↓ 180°' },
  { angle: 45, label: '↗ 45°' },
  { angle: 315, label: '↖ 315°' },
  { angle: 0, label: '↑ 0°' },
];
const POSITIONS = ['0% 0%', '50% 0%', '100% 0%', '0% 50%', '50% 50%', '100% 50%', '0% 100%', '50% 100%', '100% 100%'];

const DARK_PANEL = 'radial-gradient(ellipse at 50% 0%, #1c0e35 0%, #0b0713 100%)';
const SONOMA_SWATCH = PRESET_THEMES.find((p) => p.id === 'default-light')?.swatch ?? '#eef1f8';
const backdropFor = (s: Pick<Settings, 'backgroundImage' | 'presetTheme' | 'themeMode'>) => {
  if (s.backgroundImage) {
    return /gradient\(/.test(s.backgroundImage) ? s.backgroundImage : `center / cover url("${s.backgroundImage}")`;
  }
  const preset = PRESET_THEMES.find((p) => p.id === s.presetTheme);
  return preset?.gradient ?? preset?.swatch ?? (s.themeMode === 'light' ? SONOMA_SWATCH : DARK_PANEL);
};

type Filter = 'all' | ThemeCategory;

export function AppearanceTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const mode = settings.themeMode ?? 'dark';

  const pickMode = (next: ThemeMode | 'auto') =>
    withThemeTransition(() => {
      const s = useStore.getState().settings;
      if (next === 'auto') updateSettings({ followSystem: true, ...switchModePatch(s, systemMode()) });
      else updateSettings({ followSystem: false, ...switchModePatch(s, next) });
    });

  // Applies a backdrop that belongs to `targetMode`, switching mode when needed.
  const applyLook = (targetMode: ThemeMode, look: { presetTheme: string; accentColor?: string; backgroundImage: string | null }) =>
    withThemeTransition(() => {
      const s = useStore.getState().settings;
      updateSettings({
        ...switchModePatch(s, targetMode),
        // An explicit look for the other mode means the user wants that mode now.
        followSystem: s.followSystem && targetMode === systemMode(),
        presetTheme: look.presetTheme,
        accentColor: look.accentColor ?? s.accentColor,
        backgroundImage: look.backgroundImage,
      });
    });

  const pickPreset = (preset: PresetTheme) =>
    applyLook(preset.mode, { presetTheme: preset.id, accentColor: preset.accentColor, backgroundImage: preset.gradient });

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
        panelSolidity: undefined,
        panelBlur: undefined,
      }),
    );

  const lowContrast = contrastWithWhite(settings.accentColor) < 3;
  const customAccent = !ACCENTS.some((a) => a.hex.toLowerCase() === settings.accentColor.toLowerCase());
  const uploaded = settings.backgroundImage?.startsWith('data:');

  return (
    <div className="max-w-3xl space-y-6 p-6 text-sm text-white/90">
      <div className="border-b border-white/[0.07] pb-4">
        <h3 className="flex items-center gap-2 font-display text-[1rem] font-semibold tracking-wide text-white">
          Appearance &amp; Display
        </h3>
        <p className="text-xs text-white/55">
          Mode, accent, wallpapers, your own gradients, glass and the clock. Changes apply instantly — the preview shows the
          page behind this sheet.
        </p>
      </div>

      <LivePreview settings={settings} />

      <Section title="Appearance mode" hint="Auto follows your system's light and dark setting. Each mode remembers its own theme.">
        <div role="radiogroup" aria-label="Appearance mode" className="grid grid-cols-3 gap-3">
          {(['light', 'dark', 'auto'] as const).map((m) => {
            const checked = m === 'auto' ? !!settings.followSystem : !settings.followSystem && mode === m;
            const label = m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'Auto';
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={label}
                onClick={() => pickMode(m)}
                className="group flex flex-col items-center gap-2 rounded-xl p-1.5 text-center"
              >
                <ModeThumb mode={m} accent={settings.accentColor} selected={checked} />
                <span className={`text-xs font-semibold ${checked ? 'text-white' : 'text-white/60 group-hover:text-white/85'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Accent colour"
        hint="Buttons, focus rings, highlights and the active tab."
        aside={<span className="font-mono text-[11px] text-white/55 uppercase">{settings.accentColor}</span>}
      >
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
                className={`accent-swatch relative size-8 rounded-full transition-transform hover:scale-110 ${checked ? 'is-active' : ''}`}
                style={{ backgroundColor: a.hex } as CSSProperties}
              >
                {checked && <span className="absolute inset-0 m-auto size-2 rounded-full bg-white" />}
              </button>
            );
          })}
          <label
            className={`btn-secondary relative ml-1 flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-xs font-medium text-white ${
              customAccent ? 'ring-2 ring-[var(--color-accent)]' : ''
            }`}
            title="Pick any colour"
          >
            <span
              className="size-4 rounded"
              style={{
                background: customAccent
                  ? settings.accentColor
                  : 'conic-gradient(#ff5257, #ffc600, #62ba46, #00c7be, #007aff, #a550a7, #ff5257)',
              }}
            />
            Custom
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => updateSettings({ accentColor: e.target.value })}
              aria-label="Custom accent colour"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        {lowContrast && (
          <p role="note" className="mt-2.5 text-[11px] text-amber-300">
            White text on this colour is hard to read — buttons will look washed out.
          </p>
        )}
      </Section>

      <GradientStudioSection
        studio={settings.gradientStudio ?? DEFAULT_STUDIO}
        onChange={(g) => updateSettings({ gradientStudio: g })}
        active={settings.presetTheme === 'custom-gradient'}
        onApply={(g, opts) =>
          applyLook(opts.mode, {
            presetTheme: 'custom-gradient',
            backgroundImage: gradientCss(g),
            accentColor: opts.matchAccent ? accentFromGradient(g) : undefined,
          })
        }
      />

      <ThemeGallery selected={settings.presetTheme ?? null} onPick={pickPreset} />

      <Section title="Custom wallpaper" hint="Any image URL, a CSS gradient, or a picture from your computer.">
        <div className="flex gap-2">
          <input
            type="text"
            value={uploaded ? 'Uploaded image' : (settings.backgroundImage ?? '')}
            readOnly={uploaded}
            onChange={(e) =>
              updateSettings({
                backgroundImage: e.target.value || null,
                presetTheme: e.target.value ? 'custom' : `default-${mode}`,
              })
            }
            placeholder="https://… or linear-gradient(…)"
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
            label="Wallpaper tint & darkness"
            value={Math.round(settings.overlayOpacity * 100)}
            unit="%"
            min={0}
            max={100}
            step={5}
            onChange={(v) => updateSettings({ overlayOpacity: v / 100 })}
          />
          <Slider
            label="Wallpaper blur"
            value={settings.backgroundBlur}
            unit="px"
            min={0}
            max={40}
            step={1}
            onChange={(v) => updateSettings({ backgroundBlur: v })}
          />
        </div>
      </Section>

      <Section
        title="Glass vibrancy & translucency"
        hint="How see-through the panels are and how much they blur what is behind them."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Slider
            label="Panel opacity"
            value={settings.panelSolidity ?? 0}
            unit="%"
            min={0}
            max={100}
            step={5}
            hintLeft="Glass"
            hintRight="Solid"
            onChange={(v) => updateSettings({ panelSolidity: v })}
          />
          <Slider
            label="Panel blur"
            value={settings.panelBlur ?? 16}
            unit="px"
            min={0}
            max={40}
            step={1}
            hintLeft="Clear"
            hintRight="Frosted"
            onChange={(v) => updateSettings({ panelBlur: v })}
          />
        </div>
        {(settings.panelSolidity || settings.panelBlur !== undefined) && (
          <button
            type="button"
            onClick={() => updateSettings({ panelSolidity: undefined, panelBlur: undefined })}
            className="mt-3 text-[11px] font-medium text-[var(--color-accent)] hover:underline"
          >
            Use the theme's glass
          </button>
        )}
        <Toggle
          label="Reduce transparency"
          hint="Solid panels instead of glass — sharper text, less GPU work. Overrides the sliders."
          checked={!!settings.reduceTransparency}
          onChange={(v) => updateSettings({ reduceTransparency: v })}
        />
      </Section>

      <Section title="Clock & cockpit" hint="You can also click the clock on the dashboard to cycle faces.">
        <ClockFaces
          style={settings.clockStyle}
          h24={settings.clock24h}
          showSeconds={settings.showSeconds}
          onPick={(id) => updateSettings({ clockStyle: id })}
        />
        {settings.clockStyle === 'multi-timezone' && (
          <ZonePicker zones={settings.clockZones ?? DEFAULT_ZONES} onChange={(clockZones) => updateSettings({ clockZones })} />
        )}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Hour format">
            <div role="radiogroup" aria-label="Clock format" className="segmented flex w-fit rounded-lg p-0.5">
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
          </Field>
          <Field label="Seconds">
            <Toggle inline label="Show seconds" checked={settings.showSeconds} onChange={(v) => updateSettings({ showSeconds: v })} />
          </Field>
          <Field label="GitHub username">
            <input
              type="text"
              value={settings.githubUsername}
              onChange={(e) => updateSettings({ githubUsername: e.target.value.trim() })}
              placeholder="octocat"
              aria-label="GitHub username"
              spellCheck={false}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 font-mono text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
            />
          </Field>
          <Field label="Weather & UV">
            <Toggle
              inline
              label="Show weather"
              checked={settings.weatherEnabled}
              onChange={(v) => updateSettings({ weatherEnabled: v })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Greeting" hint="Your name is shown after Good morning / afternoon / evening.">
        <input
          type="text"
          value={settings.greetingName}
          onChange={(e) => updateSettings({ greetingName: e.target.value })}
          placeholder="Your name"
          aria-label="Greeting name"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
        />
        <div role="radiogroup" aria-label="Greeting style" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GREET_STYLES.map((g) => {
            const on = (settings.greetStyle ?? 'classic') === g.id;
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${g.name} greeting`}
                onClick={() => updateSettings({ greetStyle: g.id })}
                className={`greet-option flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${on ? 'is-on' : ''}`}
              >
                <span className={`greet-words greet-${g.id} font-display text-[15px] leading-tight font-bold tracking-tight`}>GOOD MORNING,</span>
                <span className="text-[10.5px] text-white/55">{g.name}</span>
              </button>
            );
          })}
        </div>
        <p className="pt-1 text-[11px] font-semibold tracking-wider text-white/60 uppercase">Name font</p>
        <div role="radiogroup" aria-label="Name font" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {NAME_FONTS.map((f) => {
            const on = (settings.nameFont ?? 'grotesk') === f.id;
            const sample = settings.greetingName.trim() || 'Alex';
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${f.name} name font`}
                onClick={() => updateSettings({ nameFont: f.id })}
                className={`greet-option flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${on ? 'is-on' : ''}`}
              >
                <span className={`name-font-${f.id} max-w-full truncate text-[17px] leading-tight text-white`}>{f.upper ? sample.toUpperCase() : sample}</span>
                <span className="text-[10.5px] text-white/55">{f.name}</span>
              </button>
            );
          })}
        </div>
        <Toggle
          label="Daily motivational quote"
          hint="A new quote every day under the greeting — hover it and press ↻ for another."
          checked={settings.showQuote ?? true}
          onChange={(v) => updateSettings({ showQuote: v })}
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

// ---- Gradient Studio --------------------------------------------------------

function GradientStudioSection({
  studio,
  active,
  onChange,
  onApply,
}: {
  studio: GradientStudio;
  active: boolean;
  onChange: (g: GradientStudio) => void;
  onApply: (g: GradientStudio, opts: { mode: ThemeMode; matchAccent: boolean }) => void;
}) {
  const [textMode, setTextMode] = useState<'auto' | ThemeMode>('auto');
  const [matchAccent, setMatchAccent] = useState(true);
  const [copied, setCopied] = useState(false);
  const css = gradientCss(studio);
  const autoMode = modeForGradient(studio);

  const setStop = (i: number, patch: Partial<GradientStudio['stops'][number]>) =>
    onChange({ ...studio, stops: studio.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addStop = () => {
    const sorted = [...studio.stops].sort((a, b) => a.at - b.at);
    // Insert in the widest gap, coloured like its left neighbour.
    let gap = 0;
    for (let i = 1; i < sorted.length; i++) if (sorted[i].at - sorted[i - 1].at > sorted[gap + 1].at - sorted[gap].at) gap = i - 1;
    const at = Math.round((sorted[gap].at + sorted[gap + 1].at) / 2);
    onChange({ ...studio, stops: [...sorted.slice(0, gap + 1), { color: sorted[gap].color, at }, ...sorted.slice(gap + 1)] });
  };
  const removeStop = (i: number) => onChange({ ...studio, stops: studio.stops.filter((_, j) => j !== i) });
  const reverse = () => onChange({ ...studio, stops: studio.stops.map((s) => ({ ...s, at: 100 - s.at })).reverse() });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — the CSS is visible to copy by hand
    }
  };

  return (
    <Section
      title="Gradient Studio"
      badge="Live builder"
      hint="Design your own backdrop: type, direction, up to four colour stops."
      aside={
        <div role="radiogroup" aria-label="Gradient type" className="segmented flex rounded-lg p-0.5">
          {(['linear', 'radial', 'conic'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={studio.type === t}
              onClick={() => onChange({ ...studio, type: t })}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize ${
                studio.type === t ? 'segmented-on text-white' : 'text-white/55 hover:text-white/85'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        {studio.type !== 'radial' && (
          <div className="sub-panel rounded-xl border p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-auto text-xs text-white/70">
                {studio.type === 'conic' ? 'Start angle' : 'Direction'}:{' '}
                <span className="font-mono text-[var(--color-accent)]">{studio.angle}°</span>
              </span>
              {ANGLE_CHIPS.map((c) => (
                <button
                  key={c.angle}
                  type="button"
                  onClick={() => onChange({ ...studio, angle: c.angle })}
                  aria-pressed={studio.angle === c.angle}
                  className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${
                    studio.angle === c.angle
                      ? 'border-[var(--color-accent)] text-white'
                      : 'border-white/10 text-white/55 hover:text-white/85'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={360}
              value={studio.angle}
              onChange={(e) => onChange({ ...studio, angle: Number(e.target.value) })}
              aria-label="Gradient angle"
              className="w-full accent-[var(--color-accent)]"
            />
          </div>
        )}
        {studio.type !== 'linear' && (
          <div className="sub-panel flex items-center gap-3 rounded-xl border p-3">
            <span className="text-xs text-white/70">Centre</span>
            <div role="radiogroup" aria-label="Gradient centre" className="grid grid-cols-3 gap-1">
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={studio.position === p}
                  aria-label={`Centre at ${p}`}
                  onClick={() => onChange({ ...studio, position: p })}
                  className={`size-4 rounded-sm border ${
                    studio.position === p ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-white/20 hover:border-white/50'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {studio.stops.map((s, i) => (
          <div key={i} className="sub-panel space-y-2 rounded-xl border p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider text-white/60 uppercase">Stop {i + 1}</span>
              {studio.stops.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeStop(i)}
                  aria-label={`Remove stop ${i + 1}`}
                  className="text-xs text-white/45 hover:text-red-300"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-white/20" style={{ background: s.color }}>
                <input
                  type="color"
                  value={s.color}
                  onChange={(e) => setStop(i, { color: e.target.value })}
                  aria-label={`Stop ${i + 1} colour`}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <input
                type="text"
                value={s.color}
                onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && setStop(i, { color: e.target.value.toLowerCase() })}
                aria-label={`Stop ${i + 1} hex`}
                spellCheck={false}
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-white focus:outline-none"
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={s.at}
              onChange={(e) => setStop(i, { at: Number(e.target.value) })}
              aria-label={`Stop ${i + 1} position`}
              className="w-full accent-[var(--color-accent)]"
            />
            <span className="block text-right font-mono text-[10px] text-white/55">{s.at}%</span>
          </div>
        ))}
        {studio.stops.length < 4 && (
          <button
            type="button"
            onClick={addStop}
            className="sub-panel flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-white/55 hover:text-white"
          >
            <span className="text-lg leading-none">+</span>
            Add stop
          </button>
        )}
      </div>

      <div className="mt-3">
        <span className="text-[10px] font-semibold tracking-wider text-white/60 uppercase">Palettes for inspiration</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {STUDIO_PALETTES.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => onChange(p.studio)}
              className="btn-secondary flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium text-white/85 hover:text-white"
            >
              <span className="size-3 rounded-full" style={{ background: gradientCss(p.studio) }} />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="sub-panel mt-3 space-y-2.5 rounded-xl border p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">Preview</span>
          <code className="min-w-0 flex-1 truncate rounded bg-black/30 px-2 py-0.5 font-mono text-[10px] text-cyan-300">{css}</code>
          <button type="button" onClick={reverse} className="btn-secondary rounded-md border px-2 py-0.5 text-[10px] text-white/80">
            ⇄ Reverse
          </button>
          <button type="button" onClick={copy} className="btn-secondary rounded-md border px-2 py-0.5 text-[10px] text-white/80">
            {copied ? 'Copied ✓' : 'Copy CSS'}
          </button>
        </div>
        <div className="h-20 rounded-lg border border-white/10" style={{ background: css }} />
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Text style on this gradient" className="segmented flex rounded-lg p-0.5">
            {(['auto', 'light', 'dark'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={textMode === m}
                onClick={() => setTextMode(m)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  textMode === m ? 'segmented-on text-white' : 'text-white/55 hover:text-white/85'
                }`}
              >
                {m === 'auto' ? `Auto (${autoMode})` : m === 'light' ? 'Light UI' : 'Dark UI'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-white/70">
            <input
              type="checkbox"
              checked={matchAccent}
              onChange={(e) => setMatchAccent(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            Match accent to gradient
          </label>
          <button
            type="button"
            onClick={() => onApply(studio, { mode: textMode === 'auto' ? autoMode : textMode, matchAccent })}
            className="accent-gradient ml-auto rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md transition-transform hover:scale-[1.02]"
          >
            {active ? 'Update workspace gradient' : 'Apply to workspace'} ✨
          </button>
        </div>
      </div>
    </Section>
  );
}

// ---- Theme gallery ----------------------------------------------------------

function ThemeGallery({ selected, onPick }: { selected: string | null; onPick: (p: PresetTheme) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const presets = useMemo(
    () =>
      PRESET_THEMES.filter(
        (p) =>
          (filter === 'all' || p.category === filter) &&
          (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
      ),
    [filter, q],
  );
  const pills: Array<{ id: Filter; label: string }> = [{ id: 'all', label: 'All' }, ...THEME_CATEGORIES];

  return (
    <Section
      title={`Themes & wallpapers (${PRESET_THEMES.length})`}
      hint="A backdrop with a matching accent. Picking one switches to its mode."
      aside={
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search themes"
          aria-label="Search themes"
          className="w-36 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white placeholder-white/35 focus:border-white/25 focus:outline-none"
        />
      }
    >
      <div role="tablist" aria-label="Filter themes" className="segmented mb-3 flex w-fit flex-wrap rounded-lg p-0.5">
        {pills.map((f) => {
          const count = f.id === 'all' ? PRESET_THEMES.length : PRESET_THEMES.filter((p) => p.category === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                filter === f.id ? 'segmented-on text-white' : 'text-white/55 hover:text-white/85'
              }`}
            >
              {f.label} <span className="font-mono text-white/45">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="ultra-thin-scrollbar -mr-2 grid max-h-[460px] grid-cols-2 gap-3 overflow-y-auto pr-2 sm:grid-cols-3">
        {presets.map((preset) => {
          const isSelected = selected === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onPick(preset)}
              className={`theme-card group flex flex-col overflow-hidden rounded-xl border text-left transition-[transform,box-shadow] hover:-translate-y-0.5 ${
                isSelected ? 'is-active' : ''
              }`}
            >
              <ThemeThumb preset={preset} />
              <span className="flex items-center gap-2 px-2.5 pt-2">
                <span className="truncate text-xs font-semibold text-white">{preset.name}</span>
                <span className="ml-auto shrink-0 rounded px-1 font-mono text-[9px] text-white/60 uppercase">
                  {THEME_CATEGORIES.find((c) => c.id === preset.category)?.label}
                </span>
              </span>
              <span className="block truncate px-2.5 pt-0.5 pb-2.5 text-[10px] text-white/60">{preset.description}</span>
            </button>
          );
        })}
        {presets.length === 0 && <p className="col-span-full py-6 text-center text-xs text-white/55">No themes match “{query}”.</p>}
      </div>
    </Section>
  );
}

// ---- Building blocks ----------------------------------------------------------

function Section({
  title,
  hint,
  badge,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  badge?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="glass-inner rounded-2xl border border-white/10 p-5">
      <div className="mb-3.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-white/85 uppercase">
            {title}
            {badge && (
              <span className="rounded border border-cyan-400/30 bg-cyan-500/10 px-1.5 font-mono text-[9px] tracking-normal text-cyan-300 normal-case">
                {badge}
              </span>
            )}
          </h4>
          {hint && <p className="mt-0.5 text-[11px] text-white/55">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[10px] font-semibold tracking-wider text-white/60 uppercase">{label}</span>
      {children}
    </div>
  );
}

function Slider(props: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  hintLeft?: string;
  hintRight?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex justify-between text-xs">
        <span className="text-white/70">{props.label}</span>
        <span className="font-mono text-white/55 tabular-nums">
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
      {(props.hintLeft || props.hintRight) && (
        <span className="flex justify-between text-[10px] text-white/45">
          <span>{props.hintLeft}</span>
          <span>{props.hintRight}</span>
        </span>
      )}
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
        {hint && <p className="text-[11px] text-white/55">{hint}</p>}
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

// A tiny DevDeck in a macOS window: top bar, search, three columns — painted
// with the live settings.
function LivePreview({ settings }: { settings: Settings }) {
  const light = (settings.themeMode ?? 'dark') === 'light';
  const solid = !!settings.reduceTransparency;
  const solidity = solid ? 100 : (settings.panelSolidity ?? 0);
  const glassBase = light ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.07)';
  const solidBase = light ? '#ffffff' : '#1b1329';
  const panel: CSSProperties = {
    background: `color-mix(in srgb, ${glassBase}, ${solidBase} ${solidity}%)`,
    border: `1px solid ${light ? 'rgba(60,60,67,0.12)' : 'rgba(255,255,255,0.12)'}`,
  };
  const ink = light ? 'rgba(29,29,31,0.75)' : 'rgba(255,255,255,0.8)';
  const muted = light ? 'rgba(60,60,67,0.18)' : 'rgba(255,255,255,0.14)';
  const now = useNow(30_000);

  return (
    <div className="preview-window overflow-hidden rounded-2xl border">
      <div className="flex items-center gap-2 px-3.5 py-2">
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />
        ))}
        <span className="ml-2 text-[11px] font-semibold text-white/70">DevDeck — Live preview</span>
        <span className="ml-auto font-mono text-[10px] text-white/55 uppercase">
          {settings.followSystem ? 'auto · ' : ''}
          {light ? 'light' : 'dark'} · {settings.accentColor}
        </span>
      </div>
      <div
        data-testid="appearance-preview"
        aria-label="Live preview"
        role="img"
        className="relative overflow-hidden"
        style={{ background: backdropFor(settings), height: 172 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `rgba(0,0,0,${settings.backgroundImage ? settings.overlayOpacity * 0.6 : 0})`,
            backdropFilter: settings.backgroundBlur ? `blur(${Math.round(settings.backgroundBlur / 4)}px)` : undefined,
          }}
        />
        <div className="relative grid h-full grid-rows-[46px_22px_1fr] gap-2 p-3">
          <div className="grid grid-cols-[1.1fr_1fr_1fr_0.9fr] gap-2">
            <div className="overflow-hidden rounded-lg" style={panel}>
              <ClockFace style={settings.clockStyle} parts={clockParts(now, settings.clock24h)} showSeconds={false} now={now} />
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
                <div key={i} className="rounded-md p-1.5" style={panel}>
                  <div className="h-1.5 w-1/3 rounded-full" style={{ background: settings.accentColor }} />
                </div>
              ))}
            </div>
            <div className="rounded-lg" style={panel} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeThumb({ mode, accent, selected }: { mode: 'light' | 'dark' | 'auto'; accent: string; selected: boolean }) {
  const pane = (light: boolean) => (
    <div
      className="absolute inset-0 p-2"
      style={{ background: light ? 'linear-gradient(160deg, #dfe7f8, #f6eef3)' : 'linear-gradient(160deg, #1d1033, #0b0713)' }}
    >
      <div className="mb-1.5 flex gap-1">
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} className="size-1.5 rounded-full" style={{ background: c }} />
        ))}
      </div>
      <div className="flex gap-1.5">
        <div className="h-9 w-1/3 rounded" style={{ background: light ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.09)' }} />
        <div
          className="flex-1 space-y-1 rounded p-1.5"
          style={{ background: light ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.09)' }}
        >
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
    <span className="relative block h-16 w-full" style={{ background: preset.gradient ?? preset.swatch ?? DARK_PANEL }} aria-hidden>
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

// Every clock face as a live preview, in one horizontal row. The thin
// scrollbar stays visible; a vertical wheel anywhere over the row (faces
// included) scrolls it sideways.
function ClockFaces({ style, h24, showSeconds, onPick }: { style: ClockStyle; h24: boolean; showSeconds: boolean; onPick: (id: ClockStyle) => void }) {
  const now = useNow(1000);
  const parts = clockParts(now, h24);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return; // let the page scroll at the ends
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Keep the chosen face in view when the section opens.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, []);

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Clock style"
      className="thin-autohide-scroll is-scrolling -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pt-1 pb-2.5"
    >
      {CLOCK_STYLE_INFO.map(({ id, name, desc }) => {
        const checked = style === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={name}
            onClick={() => onPick(id)}
            className={`clock-card flex w-[210px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border text-left ${checked ? 'is-active' : ''}`}
          >
            <span className="clock-preview block h-[96px] w-full">
              <ClockFace style={id} parts={parts} showSeconds={showSeconds} now={now} />
            </span>
            <span className="px-2.5 pt-1.5 pb-2">
              <span className={`block truncate text-[11.5px] font-semibold ${checked ? 'text-white' : 'text-white/75'}`}>{name}</span>
              <span className="block truncate text-[10px] text-white/50">{desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Multi-Timezone face: up to two cities beside local time (24-hour). Adding
// one uses the clock's own search over every time zone in the world.
const MAX_ZONES = 2;
function ZonePicker({ zones, onChange }: { zones: string[]; onChange: (z: string[]) => void }) {
  const now = useNow(30_000);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const shown = zones.slice(0, MAX_ZONES);
  return (
    <div data-testid="zone-picker" className="sub-panel mt-2 rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider text-white/60 uppercase">Time zones</span>
        <span className="text-[10px] text-white/45">{shown.length}/{MAX_ZONES} · shown beside your local time</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map((tz) => {
          const t = zoneTime(now, tz, true);
          return (
            <span key={tz} className="btn-secondary flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] text-white/85">
              {zoneCity(tz)}
              <span className="font-mono text-[10px] text-white/50">
                {t.hours}:{t.minutes} · {t.offset}
              </span>
              <button
                type="button"
                onClick={() => onChange(shown.filter((z) => z !== tz))}
                aria-label={`Remove ${zoneCity(tz)}`}
                className="text-white/45 hover:text-red-300"
              >
                ✕
              </button>
            </span>
          );
        })}
        {shown.length < MAX_ZONES && (
          <button
            type="button"
            aria-label="Add a time zone"
            onClick={(e) => setAnchor(e.currentTarget)}
            className="btn-secondary rounded-lg border border-dashed px-2.5 py-1 text-[11px] text-white/70 hover:text-white"
          >
            + Add city…
          </button>
        )}
      </div>
      {anchor && (
        <ZoneSearch
          anchor={anchor}
          now={now}
          onClose={() => setAnchor(null)}
          onPick={(tz) => {
            setAnchor(null);
            if (!shown.includes(tz)) onChange([...shown, tz].slice(0, MAX_ZONES));
          }}
        />
      )}
    </div>
  );
}
