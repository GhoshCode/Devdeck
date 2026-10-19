import type { TimezoneOption } from '../../../lib/timezoneOptions';
import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { useStore } from '../../../store';
import { cachedWeather } from '../../../services/weather';
import { DEFAULT_ZONES, ZONE_CHOICES, zoneCity, zoneTime } from '../../../lib/zones';
import { AnchoredPopover } from '../../ui/AnchoredPopover';
import type { FaceProps } from './faces';

// The second set of TIME faces (complex / hybrid designs). Same contract as
// faces.tsx: fill a size container, size with container units, colour from
// the accent (--color-accent).

const A = 'var(--color-accent)';
const mix = (pct: number, other = 'transparent') => `color-mix(in srgb, ${A} ${pct}%, ${other})`;

const TINY = 'text-[max(8px,min(9cqh,3.3cqw))]';
const SMALL = 'text-[max(9px,min(12cqh,4.2cqw))]';


const Meridiem = ({ m, className = '' }: { m: string | null; className?: string }) =>
  m ? <span className={`${TINY} font-sans font-semibold tracking-wider ${className}`}>{m}</span> : null;

// Square drawing area for dial-style faces: as tall as the box allows.
const DIAL = 'aspect-square h-[min(88cqh,44cqw)] shrink-0';


// ---- 3. Neon Orb ------------------------------------------------------------------------

function NeonOrbFace({ parts, now }: FaceProps) {
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const polar = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  };
  const [sx, sy] = polar(s * 6, 44);
  return (
    <div className="flex h-full w-full items-center justify-center gap-[4cqw] px-[3cqw]">
      <div className={`relative ${DIAL}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
          <defs>
            <radialGradient id="chrono-core" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor={mix(30, '#0b1020')} />
              <stop offset="70%" stopColor="#05070d" />
              <stop offset="100%" stopColor="#020308" />
            </radialGradient>
            <filter id="chrono-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="50" cy="50" r="49" fill="url(#chrono-core)" stroke={mix(35)} strokeWidth="0.6" />
          {/* 60 micro ticks, every 5th a light bar */}
          {Array.from({ length: 60 }, (_, i) => {
            const [x1, y1] = polar(i * 6, i % 5 ? 45.5 : 43);
            const [x2, y2] = polar(i * 6, 47.5);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 5 ? 'rgba(255,255,255,0.18)' : A} strokeWidth={i % 5 ? 0.5 : 1.2} />;
          })}
          {/* slowly counter-rotating data rings */}
          <g className="chrono-spin">
            <circle cx="50" cy="50" r="36" fill="none" stroke={mix(45)} strokeWidth="0.5" strokeDasharray="1 3" />
          </g>
          <g className="chrono-spin-rev">
            <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.6" strokeDasharray="18 6 2 6" />
          </g>
          {/* seconds sweep arc + orbiting light */}
          <circle
            cx="50" cy="50" r="44" fill="none" stroke={A} strokeWidth="0.8" strokeLinecap="round"
            strokeDasharray={`${(s / 60) * 276.5} 276.5`} transform="rotate(-90 50 50)" opacity="0.55"
          />
          <circle cx={sx} cy={sy} r="1.6" fill="#fff" filter="url(#chrono-glow)" />
          {/* light-beam hands */}
          <g filter="url(#chrono-glow)" strokeLinecap="round">
            <line x1="50" y1="50" x2={polar(h * 30, 22)[0]} y2={polar(h * 30, 22)[1]} stroke="#fff" strokeWidth="2.4" />
            <line x1="50" y1="50" x2={polar(m * 6, 34)[0]} y2={polar(m * 6, 34)[1]} stroke={A} strokeWidth="1.5" />
          </g>
          <circle cx="50" cy="50" r="3.2" fill="#05070d" stroke={A} strokeWidth="1" />
          <circle cx="50" cy="50" r="1" fill="#fff" />
          <text x="50" y="68" textAnchor="middle" fontSize="5" fontFamily="monospace" fill={mix(70, '#fff')} letterSpacing="1">
            CHRONO·2100
          </text>
        </svg>
      </div>
      {/* side readout */}
      <div className="flex flex-col gap-[1.5cqh] font-mono leading-none tabular-nums">
        <span className="text-[min(20cqh,8cqw)] font-semibold text-white">
          {parts.hours}:{parts.minutes}
        </span>
        <span className="flex items-center gap-[1cqw]">
          <span className="text-[min(12cqh,4.6cqw)]" style={{ color: A }}>
            {parts.seconds}
          </span>
          <Meridiem m={parts.meridiem} className="text-white/60" />
        </span>
        <span aria-hidden className="flex gap-[0.6cqw]">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="h-[1.6cqh] w-[2.2cqw] rounded-[1px]" style={{ background: i < Math.ceil(s / 10) ? A : 'rgba(255,255,255,0.12)' }} />
          ))}
        </span>
      </div>
    </div>
  );
}

// ---- 4. Flip Clock --------------------------------------------------------------------------

function FlipCard({ value }: { value: string }) {
  const card: CSSProperties = { background: `linear-gradient(180deg, ${mix(28, '#1f232c')}, ${mix(14, '#0f1115')})` };
  return (
    <span className="relative flex h-[66cqh] w-[22cqw] items-center justify-center overflow-hidden rounded-[4cqh] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.7)]" style={card}>
      {/* hinge pins */}
      <span aria-hidden className="absolute top-1/2 left-0 z-10 h-[5cqh] w-[0.8cqw] -translate-y-1/2 rounded-r-sm bg-black/70" />
      <span aria-hidden className="absolute top-1/2 right-0 z-10 h-[5cqh] w-[0.8cqw] -translate-y-1/2 rounded-l-sm bg-black/70" />
      <span className="font-display text-[min(48cqh,15cqw)] leading-none font-bold tabular-nums" style={{ color: "#fff" }}>{value}</span>
      {/* top half flips down whenever the value changes */}
      <span key={value} aria-hidden className="flip-top absolute inset-x-0 top-0 h-1/2 overflow-hidden" style={card}>
        <span className="absolute inset-x-0 top-0 flex h-[66cqh] items-center justify-center font-display text-[min(48cqh,15cqw)] leading-none font-bold tabular-nums" style={{ color: "#fff" }}>
          {value}
        </span>
      </span>
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-black/60" />
    </span>
  );
}

const FlipColon = () => (
  <span aria-hidden className="flex flex-col gap-[3cqh]">
    <span className="size-[1.6cqh] rounded-full" style={{ background: A, boxShadow: `0 0 6px ${A}` }} />
    <span className="size-[1.6cqh] rounded-full" style={{ background: A, boxShadow: `0 0 6px ${A}` }} />
  </span>
);

function FlipFace({ parts }: FaceProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      {/* the case */}
      <div
        className="flip-case relative mt-[4cqh] flex items-center gap-[1.5cqw] rounded-[7cqh] px-[2cqw] pt-[3.5cqh] pb-[3.5cqh]"
        style={{
          background: `linear-gradient(180deg, ${mix(12, '#2a2e37')}, ${mix(6, '#14161b')} 60%, #0c0d10)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 6px rgba(0,0,0,0.6), 0 10px 22px -10px rgba(0,0,0,0.8), 0 0 0 1px ${mix(18)}`,
        }}
      >
        {/* brand plate sitting on the top rim of the case */}
        <span aria-hidden className={`flip-plate absolute -top-[3cqh] left-1/2 -translate-x-1/2 rounded-[1.6cqh] px-[2.8cqw] pt-[1.3cqh] pb-[1.1cqh] pl-[3.2cqw] font-mono ${TINY} leading-none tracking-[0.4em] text-white/55`}>DEVDECK</span>
        {/* recessed window */}
        <div className="flex items-center gap-[0.9cqw] rounded-[5cqh] bg-black/55 p-[1.4cqh] shadow-[inset_0_2px_6px_rgba(0,0,0,0.8)]">
          <FlipCard value={parts.hours} />
          <FlipColon />
          <FlipCard value={parts.minutes} />
          <FlipColon />
          <FlipCard value={parts.seconds} />
        </div>
        {parts.meridiem && (
          <span className={`flex flex-col items-center gap-[1cqh] font-mono ${TINY} text-white/45`}>
            <span style={parts.meridiem === 'AM' ? { color: A } : undefined}>AM</span>
            <span style={parts.meridiem === 'PM' ? { color: A } : undefined}>PM</span>
          </span>
        )}
        {/* feet */}
        <span aria-hidden className="absolute -bottom-[2.4cqh] left-[14%] h-[2.6cqh] w-[12%] rounded-b-[2cqh] bg-[#0a0b0e]" />
        <span aria-hidden className="absolute right-[14%] -bottom-[2.4cqh] h-[2.6cqh] w-[12%] rounded-b-[2cqh] bg-[#0a0b0e]" />
      </div>
    </div>
  );
}

// ---- 8. Gradient Blocks ---------------------------------------------------------------------

function GradientBlocksFace({ parts }: FaceProps) {
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
    </div>
  );
}

// ---- 10. Typographic Bold ------------------------------------------------------------------

function TypographicBoldFace({ parts, now }: FaceProps) {
  const dayPct = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;
  return (
    <div className="flex h-full w-full flex-col justify-center px-[7cqw]">
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


// ---- 13. Futuristic HUD ---------------------------------------------------------------------------

function FuturisticHudFace({ parts, now }: FaceProps) {
  const sec = now.getSeconds();
  return (
    <div className="relative flex h-full w-full items-center justify-center p-[3cqh]">
      <svg aria-hidden viewBox="0 0 200 100" preserveAspectRatio="none" className="absolute inset-[3cqh] h-[calc(100%-6cqh)] w-[calc(100%-6cqh)]">
        <defs>
          <pattern id="hud-carbon" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" fill="#07090f" />
            <rect width="2" height="4" fill="#0d1018" />
          </pattern>
          <pattern id="hud-hazard" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width="3" height="6" fill={A} />
          </pattern>
        </defs>
        {/* receiver body: angular armour plate */}
        <path d="M10 2 H150 L160 10 H192 L198 18 V64 L188 74 V90 L180 98 H22 L12 90 V70 L2 60 V12 Z" fill="url(#hud-carbon)" stroke={A} strokeWidth="1.3" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 4px ${mix(65)})` }} />
        {/* panel seams + vents */}
        <path d="M160 10 V40 M150 2 V18 H120" fill="none" stroke={mix(40)} strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={166 + i * 5} y="24" width="2.4" height="14" rx="1" fill="rgba(255,255,255,0.08)" />
        ))}
        {/* hazard stripe corner */}
        <path d="M12 70 L2 60 V84 L12 90 Z" fill="url(#hud-hazard)" opacity="0.85" />
        {/* rivets */}
        {[[18, 8], [140, 8], [186, 66], [28, 92], [170, 92]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.3" fill="rgba(255,255,255,0.25)" />
        ))}
      </svg>
      <span aria-hidden className={`absolute top-[6cqh] left-[8cqw] font-mono ${TINY} tracking-[0.25em]`} style={{ color: mix(80, '#fff') }}>
        SYS.TIME // MK-II
      </span>
      <div className="face-dark relative flex translate-y-[5cqh] flex-col items-center">
        <span className="flex items-baseline gap-[1.5cqw] font-cyber text-white tabular-nums">
          <span className="text-[min(58cqh,22cqw)] leading-none font-bold" style={{ textShadow: `0 0 14px ${mix(55)}, 2px 0 0 ${mix(40, '#0ff')}, -2px 0 0 rgb(255 0 60 / 0.4)` }}>
            {parts.hours}:{parts.minutes}
          </span>
          <Meridiem m={parts.meridiem} className="text-white/80" />
        </span>
      </div>
      {/* ammo counter: one cell per 5 s */}
      <span aria-hidden className="absolute right-[7cqw] bottom-[7cqh] flex items-end gap-[0.5cqw]">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="w-[1.2cqw] -skew-x-[20deg]" style={{ height: `${3 + (i % 3)}cqh`, background: i < Math.ceil((sec + 1) / 5) ? A : 'rgba(255,255,255,0.1)' }} />
        ))}
        <span className={`ml-[1cqw] font-mono ${TINY}`} style={{ color: A }}>{String(sec).padStart(2, '0')}</span>
      </span>
    </div>
  );
}

// ---- 12. Multi-Timezone ---------------------------------------------------------------------------

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function MultiTimezoneFace({ parts, now, interactive }: FaceProps) {
  const zones = useStore((s) => s.settings.clockZones ?? DEFAULT_ZONES).slice(0, 2);
  const updateSettings = useStore((s) => s.updateSettings);
  const localName = useLocalPlaceName();
  const h24 = parts.meridiem === null;
  const [edit, setEdit] = useState<{ index: number; anchor: HTMLElement } | null>(null);
  const tiles: Array<{ key: string; city: string; hours: string; minutes: string; meridiem: string | null; offset: string; local: boolean; index: number }> = [
    { key: 'local', city: localName, hours: parts.hours, minutes: parts.minutes, meridiem: parts.meridiem, offset: 'local', local: true, index: -1 },
    ...zones.map((tz, i) => ({ key: tz, city: zoneCity(tz), ...zoneTime(now, tz, h24), local: false, index: i })),
  ];
  const slots = 2 - zones.length;
  const pick = (index: number, tz: string) => {
    const next = [...zones];
    next[index] = tz;
    updateSettings({ clockZones: next.filter(Boolean) });
    setEdit(null);
  };
  // Clicks on a city change it — without also switching the clock style.
  const open = (index: number) => (e: MouseEvent<HTMLElement>) => {
    if (!interactive) return;
    e.stopPropagation();
    e.preventDefault();
    setEdit({ index, anchor: e.currentTarget });
  };
  return (
    <div className="flex h-full w-full items-center justify-center gap-[2cqw] px-[3cqw]">
      {tiles.map((t) => (
        <div
          key={t.key}
          role={interactive && !t.local ? 'button' : undefined}
          aria-label={interactive && !t.local ? `Change ${t.city}` : undefined}
          onClick={t.local ? undefined : open(t.index)}
          className={`face-zone flex h-[78cqh] min-w-0 flex-1 flex-col items-center justify-center rounded-[6cqh] border px-[1cqw] ${interactive && !t.local ? 'cursor-pointer hover:brightness-125' : ''}`}
          style={t.local ? { borderColor: mix(55), boxShadow: `0 0 0 1px ${mix(25)}` } : undefined}
          title={t.local ? 'Your location' : interactive ? 'Click to change city' : undefined}
        >
          <span className="font-mac text-[min(24cqh,7.5cqw)] leading-none font-medium text-white tabular-nums">
            {t.hours}:{t.minutes}
          </span>
          <span className={`mt-[2cqh] max-w-full truncate font-mac ${TINY} text-white/75`}>{t.city}</span>
          <span className={`font-mono ${TINY} ${t.local ? '' : 'text-white/50'}`} style={t.local ? { color: A } : undefined}>
            {t.local ? (t.meridiem ?? 'local') : `${t.offset}${t.meridiem ? ` · ${t.meridiem}` : ''}`}
          </span>
        </div>
      ))}
      {Array.from({ length: slots }, (_, i) => (
        <div
          key={`add${i}`}
          role={interactive ? 'button' : undefined}
          aria-label={interactive ? 'Add a city' : undefined}
          onClick={open(zones.length + i)}
          className={`face-zone flex h-[78cqh] min-w-0 flex-1 flex-col items-center justify-center rounded-[6cqh] border border-dashed px-[1cqw] text-white/45 ${interactive ? 'cursor-pointer hover:text-white/80' : ''}`}
        >
          <span className="text-[min(20cqh,7cqw)] leading-none">+</span>
          <span className={`mt-[2cqh] font-mac ${TINY}`}>Add city</span>
        </div>
      ))}
      {edit && <ZoneSearch anchor={edit.anchor} now={now} onPick={(tz) => pick(edit.index, tz)} onClose={() => setEdit(null)} />}
    </div>
  );
}

// The first clock is wherever you are: the place from the weather lookup
// (browser location), else the city of the browser's time zone.
function useLocalPlaceName() {
  const useGeolocation = useStore((s) => s.settings.useGeolocation);
  const manualCity = useStore((s) => s.settings.manualCity);
  const weatherSource = useStore((s) => s.settings.weatherSource);
  const customWeatherSources = useStore((s) => s.settings.customWeatherSources);
  const w = cachedWeather({ useGeolocation, manualCity, weatherSource, customWeatherSources });
  return w?.place ?? zoneCity(LOCAL_TZ);
}

const ALL_ZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? ZONE_CHOICES.map((z) => z.tz);
  } catch {
    return ZONE_CHOICES.map((z) => z.tz);
  }
})();

// Searchable list of every time zone (city · region · offset).
function ZoneSearch({ anchor, now, onPick, onClose }: { anchor: HTMLElement; now: Date; onPick: (tz: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  // The full world list (@vvo/tzdb) loads when the search opens; until then
  // the browser's own zone names stand in.
  const [world, setWorld] = useState<TimezoneOption[] | null>(null);
  useEffect(() => {
    let alive = true;
    void import('../../../lib/timezoneOptions').then((m) => alive && setWorld(m.timezoneOptions));
    return () => {
      alive = false;
    };
  }, []);
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const all = world
      ? world.map((o) => ({ tz: o.value, city: zoneCity(o.value), detail: o.label, keys: o.searchKeywords }))
      : ALL_ZONES.map((tz) => ({ tz, city: zoneCity(tz), detail: tz.split('/')[0], keys: tz.toLowerCase() }));
    return all.filter((z) => words.every((w) => z.keys.includes(w) || z.city.toLowerCase().includes(w)));
  }, [q, world]);
  return (
    <AnchoredPopover anchor={anchor} onClose={onClose} label="Choose a city" width={Math.min(560, window.innerWidth - 16)}>
      {/* The popover is a portal, so React would bubble clicks to the clock button (style switch). */}
      <div onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setActive((i) => Math.min(list.length - 1, i + 1)));
          else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((i) => Math.max(0, i - 1)));
          else if (e.key === 'Enter' && list[active]) onPick(list[active].tz);
        }}
        placeholder="Search a city, country or time zone…"
        aria-label="Search time zones"
        className="dtp-stepper mb-2 h-9 w-full rounded-lg border px-3 text-[13px] text-white outline-none placeholder:text-white/35"
      />
      <ul role="listbox" aria-label="Time zones" className="ultra-thin-scrollbar max-h-[360px] overflow-y-auto">
        {list.map((z, i) => (
          <li
            key={z.tz}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(z.tz)}
            className={`flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 text-[13.5px] text-white/85 ${i === active ? 'dropdown-active text-white' : ''}`}
          >
            <span className="min-w-0 flex-1" title={z.detail}>
              <span className="block font-medium">{z.city}</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-white/50">{z.detail}</span>
            </span>
            <span className="shrink-0 pt-0.5 font-mono text-[11.5px] text-white/55">{zoneTime(now, z.tz, true).offset}</span>
          </li>
        ))}
        {list.length === 0 && <li className="px-2 py-2 text-[11px] text-white/40">No match</li>}
      </ul>
      </div>
    </AnchoredPopover>
  );
}

export const FACES2 = {
  'neon-orb': NeonOrbFace,
  flip: FlipFace,
  'gradient-blocks': GradientBlocksFace,
  'typographic-bold': TypographicBoldFace,
  'futuristic-hud': FuturisticHudFace,
  'multi-timezone': MultiTimezoneFace,
} as const;
