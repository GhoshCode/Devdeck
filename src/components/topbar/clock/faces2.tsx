import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../../../store';
import { cachedWeather } from '../../../services/weather';
import { DEFAULT_ZONES, zoneCity, zoneTime } from '../../../lib/zones';
import type { FaceProps } from './faces';

// The second set of TIME faces (complex / hybrid designs). Same contract as
// faces.tsx: fill a size container, size with container units, colour from
// the accent (--color-accent).

const A = 'var(--color-accent)';
const mix = (pct: number, other = 'transparent') => `color-mix(in srgb, ${A} ${pct}%, ${other})`;

const MAIN = 'text-[min(46cqh,18cqw)]';
const SEC = 'text-[min(20cqh,8cqw)]';
const TINY = 'text-[max(8px,min(9cqh,3.3cqw))]';
const SMALL = 'text-[max(9px,min(12cqh,4.2cqw))]';

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const dayYearFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const monthDayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const Meridiem = ({ m, className = '' }: { m: string | null; className?: string }) =>
  m ? <span className={`${TINY} font-sans font-semibold tracking-wider ${className}`}>{m}</span> : null;

// Square drawing area for dial-style faces: as tall as the box allows.
const DIAL = 'aspect-square h-[min(88cqh,44cqw)] shrink-0';

// ---- 1. Glassmorphism Classic ------------------------------------------------------

function GlassClassicFace({ parts, showSeconds, now }: FaceProps) {
  return (
    <div className="h-full w-full p-[4cqh]">
      <div
        className="face-dark relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[14cqh] border border-white/20"
        style={{
          background: `radial-gradient(60% 80% at 20% 30%, ${mix(45, '#6366f1')}, transparent 70%), radial-gradient(60% 80% at 85% 80%, ${mix(35, '#ec4899')}, transparent 70%), linear-gradient(135deg, #1e1b3a, #111827)`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 12px 30px -14px rgba(0,0,0,0.7)',
        }}
      >
        <span aria-hidden className="absolute top-[10cqh] right-[6cqw] size-[max(6px,3cqh)] rounded-full" style={{ background: A, boxShadow: `0 0 10px ${A}` }} />
        <span className="flex items-baseline gap-[1.5cqw] font-mac text-white tabular-nums">
          <span className={`${MAIN} leading-none font-light tracking-tight`}>
            {parts.hours}:{parts.minutes}
          </span>
          {showSeconds && <span className={`${SEC} font-light text-white/60`}>{parts.seconds}</span>}
          <Meridiem m={parts.meridiem} className="text-white/85" />
        </span>
        <span className={`mt-[2cqh] font-mac ${SMALL} text-white/80`}>{dayYearFmt.format(now)}</span>
      </div>
    </div>
  );
}

// ---- 3. Neon Orb ------------------------------------------------------------------------

function Ring({ value, size = 100, width = 5, glow = true, children }: { value: number; size?: number; width?: number; glow?: boolean; children?: ReactNode }) {
  const r = (size - width) / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden>
      <defs>
        <linearGradient id="orb-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mix(100)} />
          <stop offset="1" stopColor={mix(45, '#60a5fa')} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={mix(18)} strokeWidth={width} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#orb-grad)"
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`}
        style={glow ? { filter: `drop-shadow(0 0 4px ${mix(80)})`, transition: 'stroke-dasharray 0.6s linear' } : undefined}
      />
      {children}
    </svg>
  );
}

function NeonOrbFace({ parts, now }: FaceProps) {
  const progress = (now.getSeconds() + now.getMilliseconds() / 1000) / 60;
  return (
    <div className="flex h-full w-full items-center justify-center gap-[5cqw] px-[4cqw]">
      <div className={`relative ${DIAL}`}>
        <Ring value={progress || 0.001} width={6} />
        <span className="absolute inset-0 flex flex-col items-center justify-center font-mac text-white tabular-nums">
          <span className="text-[min(22cqh,9cqw)] leading-none font-medium">
            {parts.hours}:{parts.minutes}
          </span>
          <Meridiem m={parts.meridiem} className="mt-[2cqh] text-white/70" />
        </span>
      </div>
      <div className={`flex flex-col gap-[3cqh] border-l border-white/15 pl-[4cqw] font-mac ${SMALL} text-white/80`}>
        <span className="flex items-center gap-[1.5cqw]">
          <span className="size-[max(5px,2.4cqh)] rounded-full" style={{ background: A }} />
          {weekdayFmt.format(now)}
        </span>
        <span className="flex items-center gap-[1.5cqw]">
          <span className="size-[max(5px,2.4cqh)] rounded-full" style={{ background: mix(55, '#60a5fa') }} />
          {monthDayFmt.format(now)}
        </span>
      </div>
    </div>
  );
}

// ---- 4. Flip Clock --------------------------------------------------------------------------

function FlipCard({ value }: { value: string }) {
  const card: CSSProperties = { background: `linear-gradient(180deg, ${mix(28, '#1f232c')}, ${mix(14, '#0f1115')})` };
  return (
    <span className="relative flex h-[66cqh] w-[30cqw] items-center justify-center overflow-hidden rounded-[6cqh] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.7)]" style={card}>
      <span className="font-display text-[min(48cqh,19cqw)] leading-none font-bold tabular-nums" style={{ color: "#fff" }}>{value}</span>
      {/* top half flips down whenever the value changes */}
      <span key={value} aria-hidden className="flip-top absolute inset-x-0 top-0 h-1/2 overflow-hidden" style={card}>
        <span className="absolute inset-x-0 top-0 flex h-[66cqh] items-center justify-center font-display text-[min(48cqh,19cqw)] leading-none font-bold tabular-nums" style={{ color: "#fff" }}>
          {value}
        </span>
      </span>
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-black/60" />
    </span>
  );
}

function FlipFace({ parts, now }: FaceProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[3cqh]">
      <div className="flex items-end gap-[2.5cqw]">
        <FlipCard value={parts.hours} />
        <FlipCard value={parts.minutes} />
        <Meridiem m={parts.meridiem} className="pb-[2cqh] text-white/70" />
      </div>
      <span className={`font-mac ${TINY} text-white/65`}>{dayFmt.format(now)}</span>
    </div>
  );
}

// ---- 6. Code Terminal -------------------------------------------------------------------------

function CodeTerminalFace({ parts, showSeconds, now }: FaceProps) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div className="face-dark face-terminal flex h-full flex-col justify-center rounded-[5cqh] border px-[5cqw]">
        <span aria-hidden className="mb-[3cqh] flex gap-[1.2cqw]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="aspect-square h-[min(4.5cqh,1.6cqw)] rounded-full" style={{ background: mix(70 - i * 20, '#94a3b8') }} />
          ))}
        </span>
        <span className={`font-mono ${TINY} text-white/55`}>$ date +%T</span>
        <span className="font-mono text-[min(30cqh,10.5cqw)] leading-tight font-semibold text-white tabular-nums">
          {parts.hours}:{parts.minutes}
          {showSeconds && `:${parts.seconds}`}
          {parts.meridiem && <span style={{ color: A }}> {parts.meridiem}</span>}
        </span>
        <span className={`font-mono ${TINY} text-white/70`}>{dayYearFmt.format(now)}</span>
      </div>
    </div>
  );
}

// ---- 7. Scenic Glass -----------------------------------------------------------------------

function useCachedWeather() {
  const useGeolocation = useStore((s) => s.settings.useGeolocation);
  const manualCity = useStore((s) => s.settings.manualCity);
  const weatherSource = useStore((s) => s.settings.weatherSource);
  const customWeatherSources = useStore((s) => s.settings.customWeatherSources);
  return cachedWeather({ useGeolocation, manualCity, weatherSource, customWeatherSources });
}

function ScenicGlassFace({ parts, now }: FaceProps) {
  const weather = useCachedWeather();
  return (
    <div className="face-dark relative h-full w-full overflow-hidden">
      <svg aria-hidden viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mix(30, '#1e1b4b')} />
            <stop offset="0.6" stopColor={mix(40, '#b45372')} />
            <stop offset="1" stopColor={mix(20, '#fb923c')} />
          </linearGradient>
        </defs>
        <rect width="400" height="160" fill="url(#scene-sky)" />
        <circle cx="300" cy="78" r="22" fill={mix(35, '#fde68a')} opacity="0.55" />
        <path d="M0 120 L60 70 L110 105 L170 55 L230 100 L290 62 L350 98 L400 80 L400 160 L0 160Z" fill="#2a2440" opacity="0.85" />
        <path d="M0 140 L70 100 L140 132 L210 95 L280 130 L340 108 L400 125 L400 160 L0 160Z" fill="#15121f" />
      </svg>
      <div className="relative flex h-full items-center p-[5cqh]">
        <div className="flex h-full w-[min(100%,72cqw)] flex-col justify-center rounded-[6cqh] border border-white/20 bg-white/10 px-[5cqw] backdrop-blur-md">
          <span className="flex items-baseline gap-[1.5cqw] font-mac text-white tabular-nums">
            <span className="text-[min(34cqh,13cqw)] leading-none font-light">
              {parts.hours}:{parts.minutes}
            </span>
            <Meridiem m={parts.meridiem} className="text-white/80" />
          </span>
          <span className={`font-mac ${TINY} text-white/80`}>{dayFmt.format(now)}</span>
          {weather && (
            <span className={`mt-[2cqh] flex items-center gap-[2cqw] font-mac ${TINY} text-white/85`}>
              <span className="truncate">📍 {weather.area ?? weather.place}</span>
              <span className="text-white/40">|</span>
              <span className="shrink-0">{Math.round(weather.temperature)}°C</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- 8. Gradient Blocks ---------------------------------------------------------------------

function GradientBlocksFace({ parts, now }: FaceProps) {
  const tile = 'flex h-[60cqh] w-[28cqw] items-center justify-center rounded-[7cqh] font-mac text-[min(40cqh,16cqw)] leading-none font-semibold tabular-nums shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)]';
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[3cqh]">
      <div className="flex items-center gap-[2.5cqw]">
        <span className={tile} style={{ background: `linear-gradient(135deg, ${mix(55, '#2563eb')}, ${A})`, color: '#fff' }}>
          {parts.hours}
        </span>
        <span className={tile} style={{ background: `linear-gradient(135deg, ${A}, ${mix(55, '#db2777')})`, color: '#fff' }}>
          {parts.minutes}
        </span>
        {parts.meridiem && (
          <span className={`${SMALL} font-mac font-semibold`} style={{ color: A }}>
            {parts.meridiem}
          </span>
        )}
      </div>
      <span className={`flex items-center gap-[1.5cqw] font-mac ${TINY} text-white/70`}>
        {dayFmt.format(now)}
        <span className="size-[max(5px,2.2cqh)] rounded-full" style={{ background: A }} />
      </span>
    </div>
  );
}

// ---- 10. Typographic Bold ------------------------------------------------------------------

function TypographicBoldFace({ parts, now }: FaceProps) {
  const dayPct = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;
  return (
    <div className="flex h-full w-full flex-col justify-center px-[7cqw]">
      <span className={`font-mac ${TINY} tracking-[0.18em] text-white/55 uppercase`}>{dayFmt.format(now)}</span>
      <span className="flex items-baseline gap-[2cqw]">
        <span className="font-mac text-[min(44cqh,17cqw)] leading-tight font-thin tracking-[0.18em] text-white tabular-nums">
          {parts.hours}:{parts.minutes}
        </span>
        <Meridiem m={parts.meridiem} className="text-white/55" />
      </span>
      <span aria-hidden className="relative mt-[1cqh] h-[2px] w-full rounded-full bg-white/10" title="Progress through the day">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${dayPct}%`, background: A }} />
      </span>
    </div>
  );
}

// ---- 14. Organic Shape -------------------------------------------------------------------------

function OrganicFace({ parts, now }: FaceProps) {
  return (
    <div className="face-dark relative flex h-full w-full items-center justify-center overflow-hidden">
      <span aria-hidden className="organic-blob absolute h-[90cqh] w-[60cqw]" style={{ background: `radial-gradient(circle at 30% 30%, ${mix(80, '#a78bfa')}, ${mix(25)} 70%)` }} />
      <span aria-hidden className="organic-blob organic-blob--2 absolute h-[80cqh] w-[50cqw]" style={{ background: `radial-gradient(circle at 70% 60%, ${mix(45, '#60a5fa')}, transparent 70%)` }} />
      <span aria-hidden className="organic-dim absolute inset-0 bg-black/25" />
      <span className="relative flex flex-col items-center font-mac text-white">
        <span className="flex items-baseline gap-[1.5cqw] tabular-nums">
          <span className="text-[min(40cqh,15cqw)] leading-none font-light">
            {parts.hours}:{parts.minutes}
          </span>
          <Meridiem m={parts.meridiem} className="text-white/80" />
        </span>
        <span className={`${TINY} mt-[1.5cqh] text-white/80`}>{dayFmt.format(now)}</span>
      </span>
    </div>
  );
}

// ---- 13. Futuristic HUD ---------------------------------------------------------------------------

function FuturisticHudFace({ parts, now }: FaceProps) {
  return (
    <div className="relative flex h-full w-full items-center justify-center p-[5cqh]">
      <svg aria-hidden viewBox="0 0 200 100" preserveAspectRatio="none" className="absolute inset-[5cqh] h-[calc(100%-10cqh)] w-[calc(100%-10cqh)]">
        <path
          d="M14 2 H186 L198 14 V70 L182 98 H18 L2 84 V14 Z"
          fill={mix(8, 'rgba(10,14,25,0.85)')}
          stroke={A}
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 4px ${mix(70)})` }}
        />
      </svg>
      <div className="face-dark relative flex flex-col items-center">
        <span className="flex items-baseline gap-[1.5cqw] font-mac text-white tabular-nums">
          <span className="text-[min(36cqh,14cqw)] leading-none font-medium">
            {parts.hours}:{parts.minutes}
          </span>
          <Meridiem m={parts.meridiem} className="text-white/80" />
        </span>
        <span className={`mt-[2cqh] font-mac ${TINY} tracking-[0.2em] text-white/70 uppercase`}>{dayFmt.format(now)}</span>
      </div>
      <span aria-hidden className="absolute right-[9cqw] bottom-[9cqh] flex gap-[1cqw]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-[4cqh] w-[2.4cqw] -skew-x-[30deg]" style={{ background: A, opacity: 0.55 + i * 0.15 }} />
        ))}
      </span>
    </div>
  );
}

// ---- 9. Circular Progress ----------------------------------------------------------------------

function CircularProgressFace({ parts, now }: FaceProps) {
  const progress = (now.getSeconds() + 1) / 60;
  const angle = progress * 2 * Math.PI - Math.PI / 2;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className={`relative ${DIAL}`}>
        <Ring value={progress} width={2.5} glow={false}>
          <circle
            cx={50 + 44.75 * Math.cos(angle + Math.PI / 2)}
            cy={50 + 44.75 * Math.sin(angle + Math.PI / 2)}
            r="3"
            fill={A}
            style={{ filter: `drop-shadow(0 0 3px ${A})` }}
          />
        </Ring>
        <span className="absolute inset-0 flex flex-col items-center justify-center font-mac text-white tabular-nums">
          <span className="text-[min(20cqh,8cqw)] leading-none font-light">
            {parts.hours}:{parts.minutes}
          </span>
          <Meridiem m={parts.meridiem} className="mt-[1cqh] text-white/65" />
          <span className="mt-[1cqh] text-[max(7px,min(7.5cqh,2.8cqw))] text-white/55">{dayFmt.format(now)}</span>
        </span>
      </div>
    </div>
  );
}

// ---- 12. Multi-Timezone ---------------------------------------------------------------------------

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function MultiTimezoneFace({ parts, now }: FaceProps) {
  const zones = useStore((s) => s.settings.clockZones ?? DEFAULT_ZONES);
  const weather = useCachedWeather();
  const h24 = parts.meridiem === null;
  const tiles = [
    { city: weather?.area ?? weather?.place ?? zoneCity(LOCAL_TZ), hours: parts.hours, minutes: parts.minutes, meridiem: parts.meridiem, offset: 'local', local: true },
    ...zones.slice(0, 3).map((tz) => ({ city: zoneCity(tz), ...zoneTime(now, tz, h24), local: false })),
  ];
  return (
    <div className="flex h-full w-full items-center justify-center gap-[2cqw] px-[3cqw]">
      {tiles.map((t) => (
        <div
          key={t.city}
          className="face-zone flex h-[78cqh] min-w-0 flex-1 flex-col items-center justify-center rounded-[6cqh] border px-[1cqw]"
          style={t.local ? { borderColor: mix(55), boxShadow: `0 0 0 1px ${mix(25)}` } : undefined}
        >
          <span className="font-mac text-[min(24cqh,7.5cqw)] leading-none font-medium text-white tabular-nums">
            {t.hours}:{t.minutes}
          </span>
          <span className={`mt-[2cqh] max-w-full truncate font-mac ${TINY} text-white/75`}>{t.city}</span>
          <span className={`font-mono ${TINY} ${t.local ? "" : "text-white/50"}`} style={t.local ? { color: A } : undefined}>
            {t.local ? (t.meridiem ?? 'local') : `${t.offset}${t.meridiem ? ` · ${t.meridiem}` : ''}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- 01. Modern Analog ----------------------------------------------------------------------------

function AnalogFace({ parts, now }: FaceProps) {
  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const hand = (deg: number, len: number, w: number, color: string, glow = false) => (
    <line
      x1="50"
      y1="50"
      x2="50"
      y2={50 - len}
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
      transform={`rotate(${deg} 50 50)`}
      style={glow ? { filter: `drop-shadow(0 0 2px ${mix(80)})` } : undefined}
    />
  );
  return (
    <div className="flex h-full w-full items-center justify-center gap-[5cqw] px-[4cqw]">
      <svg viewBox="0 0 100 100" className={`dial ${DIAL}`} aria-hidden>
        <defs>
          <radialGradient id="dial-glass" cx="35%" cy="30%" r="80%">
            <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.03)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="47" fill="url(#dial-glass)" stroke="var(--dial-ink-2)" strokeWidth="0.8" />
        {Array.from({ length: 60 }, (_, i) => (
          <line
            key={i}
            x1="50"
            y1={i % 5 ? 6 : 5}
            x2="50"
            y2={i % 5 ? 8 : 11}
            stroke={i % 15 === 0 ? A : i % 5 ? 'var(--dial-ink-2)' : 'var(--dial-ink-1)'}
            strokeWidth={i % 5 ? 0.6 : 1.4}
            transform={`rotate(${i * 6} 50 50)`}
          />
        ))}
        {hand(h * 30, 24, 3.2, 'var(--dial-ink-1)')}
        {hand(m * 6, 35, 2.2, A, true)}
        {hand(s * 6, 38, 0.8, mix(60, '#f472b6'))}
        <circle cx="50" cy="50" r="2.4" fill={A} />
      </svg>
      <div className="flex flex-col font-mac text-white">
        <span className={`${SMALL} font-medium tabular-nums`}>
          {parts.hours}:{parts.minutes}
          {parts.meridiem && <span className="text-white/60"> {parts.meridiem}</span>}
        </span>
        <span className={`${TINY} text-white/60`}>{dayFmt.format(now)}</span>
      </div>
    </div>
  );
}

// ---- 03. Typographic Word -------------------------------------------------------------------------

const HOUR_WORDS = ['TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'];

// Words lit for "IT IS TWENTY FIVE MINUTES PAST SEVEN PM" style phrasing (to 5 minutes).
function litWords(now: Date): Set<string> {
  const m5 = Math.floor(now.getMinutes() / 5) * 5;
  let hour = now.getHours();
  const lit = new Set(['IT', 'IS', now.getHours() < 12 ? 'AM' : 'PM']);
  if (m5 === 0) lit.add("O'CLOCK");
  else {
    const mins = m5 <= 30 ? m5 : 60 - m5;
    lit.add(m5 <= 30 ? 'PAST' : 'TO');
    if (m5 > 30) hour += 1;
    if (mins === 5) lit.add('m-FIVE').add('MINUTES');
    if (mins === 10) lit.add('m-TEN').add('MINUTES');
    if (mins === 15) lit.add('QUARTER');
    if (mins === 20) lit.add('TWENTY').add('MINUTES');
    if (mins === 25) lit.add('TWENTY').add('m-FIVE').add('MINUTES');
    if (mins === 30) lit.add('HALF');
  }
  lit.add(`h-${HOUR_WORDS[hour % 12]}`);
  return lit;
}

const WORD_GRID: Array<{ key: string; label: string }> = [
  'IT', 'IS', 'HALF', 'm-TEN', 'QUARTER', 'TWENTY', 'm-FIVE', 'MINUTES', 'TO', 'PAST',
  ...HOUR_WORDS.slice(1).map((w) => `h-${w}`), 'h-TWELVE', "O'CLOCK", 'AM', 'PM',
].map((key) => ({ key, label: key.replace(/^[mh]-/, '') }));

function WordClockFace({ now }: FaceProps) {
  const lit = useMemo(() => litWords(now), [now]);
  return (
    <div className="flex h-full w-full items-center px-[4cqw]">
      <p className="flex flex-wrap content-center gap-x-[1.6cqw] gap-y-[0.5cqh] font-display text-[min(10.5cqh,3.7cqw)] leading-tight font-bold tracking-wide">
        {WORD_GRID.map(({ key, label }) => (
          <span
            key={key}
            className="transition-colors duration-500"
            style={lit.has(key) ? { color: A, textShadow: `0 0 8px ${mix(55)}` } : { color: 'rgba(148,163,184,0.22)' }}
          >
            {label}
          </span>
        ))}
      </p>
    </div>
  );
}

// ---- 05. Geek Binary -------------------------------------------------------------------------------

function BinaryFace({ parts }: FaceProps) {
  const digits = [...`${parts.hours}${parts.minutes}${parts.seconds}`].map(Number);
  const dot = 'size-[min(11cqh,4cqw)] rounded-full';
  return (
    <div className="flex h-full w-full items-center justify-center gap-[3cqw]">
      <span className={`flex flex-col items-end gap-[2.5cqh] font-mono ${TINY} text-white/40`}>
        {[8, 4, 2, 1].map((b) => (
          <span key={b} className="flex h-[min(11cqh,4cqw)] items-center leading-none">
            {b}
          </span>
        ))}
        <span className="invisible">0</span>
      </span>
      {digits.map((d, i) => (
        <span key={i} className={`flex flex-col items-center gap-[2.5cqh] ${i % 2 === 0 && i > 0 ? 'ml-[2cqw]' : ''}`}>
          {[8, 4, 2, 1].map((bit) => {
            const on = (d & bit) !== 0;
            return (
              <span
                key={bit}
                className={dot}
                style={on ? { background: A, boxShadow: `0 0 6px ${mix(80)}` } : { background: mix(12, 'rgba(148,163,184,0.15)') }}
              />
            );
          })}
          <span className={`font-mono ${TINY} text-white/55`}>{d}</span>
        </span>
      ))}
    </div>
  );
}

// ---- 06. Linear Timeline ---------------------------------------------------------------------------

function TimelineFace({ now }: FaceProps) {
  const rows = [
    { label: 'HR', value: now.getHours(), max: 24 },
    { label: 'MIN', value: now.getMinutes(), max: 60 },
    { label: 'SEC', value: now.getSeconds(), max: 60 },
  ];
  return (
    <div className="flex h-full w-full flex-col justify-center gap-[6cqh] px-[6cqw]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-[3cqw]">
          <span className={`w-[9cqw] font-mono ${TINY} text-white/60`}>{r.label}</span>
          <span className="relative h-[min(7cqh,2.4cqw)] flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(2, (r.value / r.max) * 100)}%`, background: `linear-gradient(90deg, ${mix(55, '#6366f1')}, ${A})`, boxShadow: `0 0 8px ${mix(50)}` }}
            />
          </span>
          <span className={`w-[7cqw] text-right font-mono ${SMALL} text-white/85 tabular-nums`}>{String(r.value).padStart(2, '0')}</span>
        </div>
      ))}
    </div>
  );
}

// ---- 07. Radar Sonar --------------------------------------------------------------------------------

function RadarFace({ parts, now }: FaceProps) {
  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours() % 12;
  const blip = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return { cx: 50 + r * Math.cos(a), cy: 50 + r * Math.sin(a) };
  };
  const hb = blip(h * 30 + m / 2, 20);
  const mb = blip(m * 6, 34);
  return (
    <div className="flex h-full w-full items-center justify-center gap-[5cqw] px-[4cqw]">
      <div className={`relative overflow-hidden rounded-full ${DIAL}`} style={{ background: mix(10, '#04130c'), boxShadow: `inset 0 0 0 1px ${mix(40)}` }}>
        {/* the sweep: one turn a minute, in step with the seconds */}
        <span
          aria-hidden
          className="radar-sweep absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(from 0deg, transparent 0deg, transparent 300deg, ${mix(55)} 360deg)`, animationDelay: `-${s}s` }}
        />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          {[16, 30, 44].map((r) => (
            <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={mix(35)} strokeWidth="0.5" />
          ))}
          <line x1="50" y1="4" x2="50" y2="96" stroke={mix(25)} strokeWidth="0.4" />
          <line x1="4" y1="50" x2="96" y2="50" stroke={mix(25)} strokeWidth="0.4" />
          <circle {...hb} r="3" fill={A} style={{ filter: `drop-shadow(0 0 3px ${A})` }} />
          <circle {...mb} r="2.2" fill={mix(60, '#fff')} />
        </svg>
      </div>
      <div className="flex flex-col font-mono">
        <span className={`${SMALL} font-semibold tabular-nums`} style={{ color: A }}>
          {parts.hours}:{parts.minutes}:{parts.seconds}
        </span>
        <span className={`${TINY} tracking-[0.2em] text-white/55`}>SCAN · LIVE{parts.meridiem ? ` · ${parts.meridiem}` : ''}</span>
      </div>
    </div>
  );
}

// ---- 11. Cosmic Arc ---------------------------------------------------------------------------------

function CosmicArcFace({ parts, now }: FaceProps) {
  const mins = now.getHours() * 60 + now.getMinutes();
  // Day runs 06:00 → 18:00 along the arc; outside it the sun rests below the horizon.
  const t = Math.min(1, Math.max(0, (mins - 360) / 720));
  const day = mins >= 360 && mins <= 1080;
  const a = Math.PI * (1 - t);
  const sun = { x: 100 + 82 * Math.cos(a), y: 92 - 70 * Math.sin(a) };
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 200 110" className="h-[92cqh] w-auto max-w-full" aria-hidden>
        <defs>
          <linearGradient id="arc-grad" x1="0" x2="1">
            <stop offset="0" stopColor={mix(40, '#38bdf8')} />
            <stop offset="0.5" stopColor={A} />
            <stop offset="1" stopColor={mix(45, '#a855f7')} />
          </linearGradient>
        </defs>
        <path d="M18 92 A82 70 0 0 1 182 92" fill="none" stroke="url(#arc-grad)" strokeWidth="2.4" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${mix(60)})` }} />
        <circle cx={day ? sun.x : 176} cy={day ? sun.y : 84} r={day ? 6 : 4} fill={day ? '#fff' : mix(50, '#c7d2fe')} style={{ filter: `drop-shadow(0 0 8px ${A})` }} />
        <text x="18" y="106" fontSize="7" fill="rgba(148,163,184,0.8)" textAnchor="middle">dawn</text>
        <text x="100" y="106" fontSize="7" fill="rgba(148,163,184,0.8)" textAnchor="middle">day</text>
        <text x="182" y="106" fontSize="7" fill="rgba(148,163,184,0.8)" textAnchor="middle">night</text>
      </svg>
      <span className="absolute top-[42%] flex items-baseline gap-[1cqw] font-mac text-white tabular-nums">
        <span className="text-[min(26cqh,10cqw)] leading-none font-light">
          {parts.hours}:{parts.minutes}
        </span>
        <Meridiem m={parts.meridiem} className="text-white/65" />
      </span>
    </div>
  );
}

// ---- 12. Cybernetic Chrono ------------------------------------------------------------------------

const NODES = Array.from({ length: 12 }, (_, i) => {
  const a = ((i * 30 - 90) * Math.PI) / 180;
  return { x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a), ix: 50 + 22 * Math.cos(a + 0.26), iy: 50 + 22 * Math.sin(a + 0.26) };
});

function CyberChronoFace({ parts, now }: FaceProps) {
  const m = now.getMinutes() + now.getSeconds() / 60;
  const a = ((m * 6 - 90) * Math.PI) / 180;
  return (
    <div className="flex h-full w-full items-center justify-center gap-[5cqw] px-[4cqw]">
      <svg viewBox="0 0 100 100" className={DIAL} aria-hidden>
        <circle cx="50" cy="50" r="40" fill="none" stroke={mix(35)} strokeWidth="0.5" />
        <circle cx="50" cy="50" r="22" fill="none" stroke={mix(25)} strokeWidth="0.4" />
        {NODES.map((n, i) => {
          const far = NODES[(i + 5) % 12];
          return (
            <g key={i}>
              <line x1={n.x} y1={n.y} x2={far.x} y2={far.y} stroke={mix(28)} strokeWidth="0.35" />
              <line x1={n.x} y1={n.y} x2={n.ix} y2={n.iy} stroke={mix(30)} strokeWidth="0.35" />
              <circle cx={n.x} cy={n.y} r="1.3" fill={A} />
              <circle cx={n.ix} cy={n.iy} r="0.9" fill={mix(70, '#fff')} />
              <text
                x={50 + 47 * Math.cos(((i * 30 - 90) * Math.PI) / 180)}
                y={50 + 47 * Math.sin(((i * 30 - 90) * Math.PI) / 180) + 1.6}
                fontSize="4.2"
                textAnchor="middle"
                fill="rgba(148,163,184,0.75)"
              >
                {String(i * 5).padStart(2, '0')}
              </text>
            </g>
          );
        })}
        <line x1="50" y1="50" x2={50 + 40 * Math.cos(a)} y2={50 + 40 * Math.sin(a)} stroke={A} strokeWidth="1.2" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 2px ${A})` }} />
        <circle cx="50" cy="50" r="1.8" fill={A} />
      </svg>
      <div className="flex flex-col font-mono">
        <span className={`${SMALL} font-semibold text-white tabular-nums`}>
          {parts.hours}:{parts.minutes}
          <span style={{ color: A }}>:{parts.seconds}</span>
        </span>
        <span className={`${TINY} tracking-[0.2em] text-white/50`}>NODE·SYNC{parts.meridiem ? ` · ${parts.meridiem}` : ''}</span>
      </div>
    </div>
  );
}

export const FACES2 = {
  'glass-classic': GlassClassicFace,
  'neon-orb': NeonOrbFace,
  flip: FlipFace,
  'gradient-blocks': GradientBlocksFace,
  'typographic-bold': TypographicBoldFace,
  'scenic-glass': ScenicGlassFace,
  organic: OrganicFace,
  'futuristic-hud': FuturisticHudFace,
  'circular-progress': CircularProgressFace,
  'multi-timezone': MultiTimezoneFace,
  analog: AnalogFace,
  'word-clock': WordClockFace,
  binary: BinaryFace,
  timeline: TimelineFace,
  radar: RadarFace,
  'cosmic-arc': CosmicArcFace,
  'cyber-chrono': CyberChronoFace,
  'code-terminal': CodeTerminalFace,
} as const;
