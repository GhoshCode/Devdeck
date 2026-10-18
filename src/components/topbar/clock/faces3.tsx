import { useMemo, type ReactNode } from 'react';
import type { FaceProps } from './faces';

// "Non-digital & hybrid" faces, laid out like the concept sheet. For now every
// element uses the accent colour alone (no multi-hue gradients) on a plain
// dark card; G1–G3 are kept as names so a palette can be introduced later.

const A = 'var(--color-accent)';
const mix = (pct: number, other = 'transparent') => `color-mix(in srgb, ${A} ${pct}%, ${other})`;
const G1 = A;
const G2 = A;
const G3 = A;

const TINY = 'text-[max(7px,min(8.5cqh,3.1cqw))]';
const SMALL = 'text-[max(9px,min(12cqh,4.2cqw))]';
const DIAL = 'aspect-square h-[min(86cqh,42cqw)] shrink-0';

// The concept sheet's tile: a dark card with a soft top highlight and thin edge.
function Card({ children, className = '', tight = false }: { children: ReactNode; className?: string; tight?: boolean }) {
  return (
    <div className={`h-full w-full ${tight ? 'p-[1.5cqh]' : 'p-[3cqh]'}`}>
      <div
        className={`face-dark relative h-full overflow-hidden rounded-[6cqh] border border-white/10 ${className}`}
        style={{
          background: '#14161c',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 10px 24px -14px rgba(0,0,0,0.7)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// A horizontal gradient usable as SVG paint (id must be unique per face).
function Grad({ id, from, to, x1 = 0, y1 = 0, x2 = 1, y2 = 0, user }: { id: string; from: string; to: string; x1?: number; y1?: number; x2?: number; y2?: number; user?: boolean }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits={user ? 'userSpaceOnUse' : 'objectBoundingBox'}>
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  );
}

const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
};

// ---- 01. Modern Analog ------------------------------------------------------------

function AnalogFace({ parts, now }: FaceProps) {
  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  return (
    <div className="relative flex h-full w-full items-center justify-center gap-[5cqw] px-[3cqw]">
      {/* soft ambient light behind the dial (no box around this face) */}
      <span
        aria-hidden
        className="analog-ambient pointer-events-none absolute top-1/2 left-[30%] aspect-square h-[120cqh] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, ${mix(38)} 0%, ${mix(14, 'rgba(129,140,248,0.25)')} 40%, transparent 68%)` }}
      />
      <svg viewBox="0 0 100 100" className="relative aspect-square h-[min(98cqh,50cqw)] shrink-0" aria-hidden>
        <defs>
          <radialGradient id="an-glass" cx="35%" cy="28%" r="85%">
            <stop offset="0" stopColor="rgba(255,255,255,0.20)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.03)" />
          </radialGradient>
          <Grad id="an-hour" from={G3} to={G1} x1={50} y1={50} x2={50} y2={26} user />
          <Grad id="an-min" from={G1} to={G2} x1={50} y1={50} x2={50} y2={14} user />
        </defs>
        <circle cx="50" cy="50" r="47" fill="url(#an-glass)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.8" />
        {Array.from({ length: 60 }, (_, i) => (
          <line
            key={i}
            x1="50"
            y1={i % 5 ? 6.5 : 5}
            x2="50"
            y2={i % 5 ? 8 : 11}
            stroke={i % 15 === 0 ? (i % 30 === 0 ? G2 : G1) : i % 5 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.5)'}
            strokeWidth={i % 5 ? 0.5 : 1.6}
            strokeLinecap="round"
            transform={`rotate(${i * 6} 50 50)`}
          />
        ))}
        <line x1="50" y1="50" x2="50" y2="26" stroke="url(#an-hour)" strokeWidth="3.4" strokeLinecap="round" transform={`rotate(${h * 30} 50 50)`} style={{ filter: `drop-shadow(0 0 2px ${G3})` }} />
        <line x1="50" y1="50" x2="50" y2="14" stroke="url(#an-min)" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${m * 6} 50 50)`} style={{ filter: `drop-shadow(0 0 3px ${G2})` }} />
        <line x1="50" y1="56" x2="50" y2="11" stroke={A} strokeWidth="0.7" strokeLinecap="round" transform={`rotate(${s * 6} 50 50)`} />
        <circle cx="50" cy="50" r="2.6" fill={G2} />
      </svg>
      <div className="relative flex flex-col font-mac leading-none text-white">
        <span className="text-[min(30cqh,11cqw)] font-light tracking-tight tabular-nums">
          {parts.hours}:{parts.minutes}
        </span>
        <span className="mt-[2cqh] flex items-baseline gap-[1cqw] text-[min(13cqh,4.6cqw)] tabular-nums" style={{ color: mix(70, '#fff') }}>
          {parts.seconds}
          {parts.meridiem && <span className="text-[0.75em] text-white/60">{parts.meridiem}</span>}
        </span>
      </div>
    </div>
  );
}

// ---- 02. Kinetic Orbital ------------------------------------------------------------
// Three orbits: hours on the inner ring, seconds on the middle, minutes on the
// outer; each planet moves continuously along its gradient orbit.

function KineticOrbitalFace({ parts, now }: FaceProps) {
  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const hour = polar(h * 30, 20);
  const sec = polar(s * 6, 30);
  const min = polar(m * 6, 40);
  const echo = polar(m * 6 + 180, 40);
  return (
    <Card className="flex items-center justify-center">
      {/* HUD brackets and side gauges */}
      <span aria-hidden className="absolute top-[6cqh] left-[3cqw] h-[10cqh] w-[3cqw] border-t border-l border-white/25" />
      <span aria-hidden className="absolute top-[6cqh] right-[3cqw] h-[10cqh] w-[3cqw] border-t border-r border-white/25" />
      <span aria-hidden className="absolute bottom-[6cqh] left-[3cqw] h-[10cqh] w-[3cqw] border-b border-l border-white/25" />
      <span aria-hidden className="absolute right-[3cqw] bottom-[6cqh] h-[10cqh] w-[3cqw] border-r border-b border-white/25" />
      {[0].map((side) => (
        <span key={side} aria-hidden className={`absolute top-1/2 flex -translate-y-1/2 flex-col gap-[2cqh] ${side ? 'right-[6cqw] items-end' : 'left-[6cqw]'}`}>
          {[0.5, 0.9, 0.35, 0.7].map((w, i) => (
            <span key={i} className="h-px rounded-full" style={{ width: `${w * 5}cqw`, background: i % 2 ? G1 : 'rgba(255,255,255,0.25)' }} />
          ))}
        </span>
      ))}
      <svg viewBox="0 0 100 100" className="aspect-square h-[90cqh]" aria-hidden>
        <defs>
          <Grad id="ko-outer" from={G1} to={G2} x1={0} y1={0} x2={1} y2={1} />
          <Grad id="ko-mid" from={G3} to={G1} x1={1} y1={0} x2={0} y2={1} />
          <radialGradient id="ko-planet" cx="35%" cy="35%" r="70%">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor={G2} />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="40" fill="none" stroke="url(#ko-outer)" strokeWidth="1.6" style={{ filter: `drop-shadow(0 0 3px ${G2})` }} />
        <circle cx="50" cy="50" r="30" fill="none" stroke="url(#ko-mid)" strokeWidth="1.1" style={{ filter: `drop-shadow(0 0 2px ${G1})` }} />
        <circle cx="50" cy="50" r="20" fill="none" stroke={G1} strokeOpacity="0.55" strokeWidth="0.8" />
        <circle cx={echo.x} cy={echo.y} r="2.2" fill={G3} opacity="0.85" />
        <circle cx={hour.x} cy={hour.y} r="2.6" fill={G1} style={{ filter: `drop-shadow(0 0 3px ${G1})` }} />
        <circle cx={sec.x} cy={sec.y} r="2.2" fill="#fff" style={{ filter: `drop-shadow(0 0 3px ${A})` }} />
        <circle cx={min.x} cy={min.y} r="3.4" fill="url(#ko-planet)" style={{ filter: `drop-shadow(0 0 4px ${G2})` }} />
        <circle cx="50" cy="50" r="1.6" fill={G1} opacity="0.8" />
      </svg>
      <div className="ml-[3cqw] flex flex-col font-mono leading-none tabular-nums">
        <span className="text-[min(24cqh,9cqw)] font-semibold text-white">
          {parts.hours}:{parts.minutes}
        </span>
        <span className="mt-[1.5cqh] text-[min(11cqh,4cqw)]" style={{ color: A }}>
          {parts.seconds}
          {parts.meridiem && <span className="ml-[1cqw] text-white/55">{parts.meridiem}</span>}
        </span>
      </div>
    </Card>
  );
}

// ---- 03. Typographic Word ---------------------------------------------------------------

const HOUR_WORDS = ['TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'];

// Words lit for the time to the nearest five minutes ("IT IS TWENTY MINUTES TO EIGHT PM").
export function litWords(now: Date): Set<string> {
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

const WORD_GRID = [
  'IT', 'IS', 'HALF', 'm-TEN', 'QUARTER', 'TWENTY', 'm-FIVE', 'MINUTES', 'TO', 'PAST',
  ...HOUR_WORDS.slice(1).map((w) => `h-${w}`), 'h-TWELVE', "O'CLOCK", 'AM', 'PM',
].map((key) => ({ key, label: key.replace(/^[mh]-/, '') }));

function WordClockFace({ now }: FaceProps) {
  const lit = useMemo(() => litWords(now), [now]);
  return (
    <Card tight className="flex items-center px-[4cqw] py-[1cqh]">
      <p className="flex flex-wrap content-center gap-x-[1.6cqw] gap-y-0 font-display text-[min(13cqh,4.3cqw)] leading-[1.12] font-bold tracking-wide">
        {WORD_GRID.map(({ key, label }) => (
          <span
            key={key}
            className="transition-[opacity,filter] duration-500"
            style={
              lit.has(key)
                ? {
                    backgroundImage: `linear-gradient(90deg, ${G1}, ${A}, ${G2})`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    filter: `drop-shadow(0 0 6px ${mix(45)})`,
                  }
                : { color: 'rgba(148,163,184,0.2)' }
            }
          >
            {label}
          </span>
        ))}
      </p>
    </Card>
  );
}

// ---- 05. Geek Binary ------------------------------------------------------------------------
// Six dot columns (H H M M S S), three dots wide and ten tall, lit from the
// bottom to the digit's value (0 lights one row, 9 the full column), with a
// scale on both sides.

const ROWS = 10;

function BinaryFace({ parts }: FaceProps) {
  const digits = [...`${parts.hours}${parts.minutes}${parts.seconds}`].map(Number);
  const dot = 'size-[min(6.4cqh,2.1cqw)] rounded-full';
  const scale = (side: 'left' | 'right') => (
    <span className={`flex h-full flex-col justify-between py-[1cqh] font-mono ${TINY} text-white/45 ${side === 'right' ? 'items-start' : 'items-end'}`}>
      {['09', '07', '05', '02', '00'].map((l) => (
        <span key={l} className="leading-none">
          {l}
        </span>
      ))}
    </span>
  );
  return (
    <Card className="flex items-center justify-center gap-[2.4cqw] px-[4cqw] py-[7cqh]">
      {scale('left')}
      {digits.map((d, i) => {
        const lit = d + 1;
        return (
          <span key={i} className="grid h-full grid-cols-3 content-between gap-x-[0.7cqw]" aria-hidden>
            {Array.from({ length: ROWS * 3 }, (_, k) => {
              const row = ROWS - 1 - Math.floor(k / 3); // 0 = bottom
              const on = row < lit;
              return (
                <span
                  key={k}
                  className={dot}
                  style={
                    on
                      ? {
                          background: A,
                          boxShadow: `0 0 5px ${mix(70)}`,
                        }
                      : { background: 'rgba(148,163,184,0.16)' }
                  }
                />
              );
            })}
          </span>
        );
      })}
      {scale('right')}
      <span className="sr-only">
        {parts.hours}:{parts.minutes}:{parts.seconds}
      </span>
    </Card>
  );
}

// ---- 06. Linear Timeline ----------------------------------------------------------------------

function TimelineFace({ now }: FaceProps) {
  const rows = [
    { label: 'HR', value: now.getHours(), max: 24, ticks: [0, 6, 12, 18, 24] },
    { label: 'MIN', value: now.getMinutes(), max: 60, ticks: [0, 15, 30, 45, 60] },
    { label: 'SEC', value: now.getSeconds(), max: 60, ticks: [0, 15, 30, 45, 60] },
  ];
  return (
    <Card className="flex flex-col justify-center gap-[3.5cqh] px-[6cqw]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-end gap-[3cqw]">
          <span className={`w-[8cqw] pb-[0.5cqh] font-mono ${SMALL} text-white/75`}>{r.label}</span>
          <span className="flex flex-1 flex-col gap-[1cqh]">
            <span className={`relative h-[8cqh] font-mono ${TINY} text-white/40`}>
              {r.ticks.map((t) => (
                <span key={t} className="absolute -translate-x-1/2 leading-none" style={{ left: `${(t / r.max) * 100}%` }}>
                  {t}
                </span>
              ))}
            </span>
            <span className="relative h-[min(6.5cqh,2.3cqw)] overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-white/10">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(2, (r.value / r.max) * 100)}%`, background: `linear-gradient(90deg, ${G3}, ${G1})`, boxShadow: `0 0 10px ${G1}` }}
              />
            </span>
          </span>
          <span className={`w-[7cqw] pb-[0.2cqh] text-right font-mono ${SMALL} text-white tabular-nums`}>{String(r.value).padStart(2, '0')}</span>
        </div>
      ))}
    </Card>
  );
}

// ---- 07. Radar Sonar ----------------------------------------------------------------------------

function RadarFace({ parts, now }: FaceProps) {
  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours() % 12;
  const hb = polar(h * 30 + m / 2, 20);
  const mb = polar(m * 6, 34);
  return (
    <Card className="flex items-center justify-center gap-[5cqw] px-[4cqw]">
      <div className={`relative overflow-hidden rounded-full ${DIAL}`} style={{ background: `radial-gradient(circle, ${mix(12, '#0b0d12')}, #0b0d12 75%)`, boxShadow: `inset 0 0 0 1px ${G1}, 0 0 14px -4px ${G1}` }}>
        {/* the sweep: one turn a minute, in step with the seconds */}
        <span
          aria-hidden
          className="radar-sweep absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(from 0deg, transparent 0deg, transparent 270deg, ${mix(25)} 330deg, ${mix(85)} 360deg)`, animationDelay: `-${s}s` }}
        />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <Grad id="rd-ring" from={G1} to={A} x1={0} y1={0} x2={1} y2={1} />
          </defs>
          {[14, 28, 42].map((r) => (
            <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="url(#rd-ring)" strokeOpacity="0.6" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 36 }, (_, i) => (
            <line key={i} x1="50" y1="3" x2="50" y2={i % 3 ? 5 : 7} stroke={G1} strokeOpacity="0.55" strokeWidth="0.4" transform={`rotate(${i * 10} 50 50)`} />
          ))}
          <line x1="50" y1="6" x2="50" y2="94" stroke={G1} strokeOpacity="0.3" strokeWidth="0.35" />
          <line x1="6" y1="50" x2="94" y2="50" stroke={G1} strokeOpacity="0.3" strokeWidth="0.35" />
          <circle cx={hb.x} cy={hb.y} r="3" fill={A} style={{ filter: `drop-shadow(0 0 3px ${A})` }} />
          <circle cx={mb.x} cy={mb.y} r="2.2" fill="#d1fae5" style={{ filter: `drop-shadow(0 0 3px ${G1})` }} />
        </svg>
      </div>
      <div className="flex flex-col font-mono">
        <span
          className={`${SMALL} font-semibold tabular-nums`}
          style={{ backgroundImage: `linear-gradient(90deg, ${G1}, ${A})`, WebkitBackgroundClip: 'text', color: 'transparent' }}
        >
          {parts.hours}:{parts.minutes}:{parts.seconds}
        </span>
        <span className={`${TINY} tracking-[0.2em] text-white/55`}>SCAN · LIVE{parts.meridiem ? ` · ${parts.meridiem}` : ''}</span>
      </div>
    </Card>
  );
}

// ---- 11. Cosmic Arc -----------------------------------------------------------------------------

function CosmicArcFace({ parts, now }: FaceProps) {
  const mins = now.getHours() * 60 + now.getMinutes();
  // Day runs 06:00 → 18:00 along the arc; after dark the moon rests at the night end.
  const t = Math.min(1, Math.max(0, (mins - 360) / 720));
  const day = mins >= 360 && mins <= 1080;
  const a = Math.PI * (1 - t);
  const sun = { x: 100 + 82 * Math.cos(a), y: 92 - 70 * Math.sin(a) };
  // Bright trail from dawn to the sun.
  const trail = `M18 92 A82 70 0 0 1 ${sun.x.toFixed(2)} ${sun.y.toFixed(2)}`;
  return (
    <Card className="flex items-center justify-center">
      <svg viewBox="0 0 200 110" className="h-[92cqh] w-auto max-w-full" aria-hidden>
        <defs>
          <Grad id="ca-arc" from={G1} to={G2} />
          <radialGradient id="ca-sun">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.5" stopColor={mix(40, '#fff')} />
            <stop offset="1" stopColor="transparent" />
          </radialGradient>
        </defs>
        <path d="M18 92 A82 70 0 0 1 182 92" fill="none" stroke="url(#ca-arc)" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
        {day && <path d={trail} fill="none" stroke="url(#ca-arc)" strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${G1})` }} />}
        {[0, 1, 2, 3].map((i) => (
          <line key={`l${i}`} x1={22 + i * 2.5} y1={96 - i * 7} x2={18 + i * 2.5} y2={96 - i * 7} stroke="rgba(148,163,184,0.5)" strokeWidth="1.2" />
        ))}
        {day ? (
          <>
            <circle cx={sun.x} cy={sun.y} r="14" fill="url(#ca-sun)" />
            <circle cx={sun.x} cy={sun.y} r="5" fill="#fff" />
            <text x={sun.x} y={sun.y - 10} fontSize="6.5" textAnchor="middle" fill="rgba(255,255,255,0.85)">
              Sun/Time
            </text>
          </>
        ) : (
          <circle cx="176" cy="84" r="4" fill={mix(50, '#fff')} style={{ filter: `drop-shadow(0 0 6px ${G2})` }} />
        )}
        <text x="18" y="106" fontSize="7" fill="rgba(148,163,184,0.85)" textAnchor="middle">dawn</text>
        <text x="100" y="106" fontSize="7" fill="rgba(148,163,184,0.85)" textAnchor="middle">Day</text>
        <text x="182" y="106" fontSize="7" fill="rgba(148,163,184,0.85)" textAnchor="middle">Night</text>
      </svg>
      <span className="absolute top-[46%] flex items-baseline gap-[1cqw] font-mac text-white tabular-nums">
        <span className="text-[min(24cqh,9cqw)] leading-none font-light">
          {parts.hours}:{parts.minutes}
        </span>
        {parts.meridiem && <span className={`${TINY} text-white/65`}>{parts.meridiem}</span>}
      </span>
    </Card>
  );
}

// ---- 12. Cybernetic Chrono ------------------------------------------------------------------------

const NODES = Array.from({ length: 12 }, (_, i) => ({ o: polar(i * 30, 40), i: polar(i * 30 + 15, 22) }));
const WEB = [polar(20, 49), polar(75, 49), polar(130, 49), polar(200, 49), polar(255, 49), polar(320, 49)];

function CyberChronoFace({ parts, now }: FaceProps) {
  const m = now.getMinutes() + now.getSeconds() / 60;
  const tip = polar(m * 6, 40);
  const wedge = polar(m * 6 - 24, 40);
  return (
    <Card className="flex items-center justify-center gap-[5cqw] px-[4cqw]">
      <svg viewBox="0 0 100 100" className={DIAL} aria-hidden>
        <defs>
          <Grad id="cc-web" from={G1} to={G2} x1={0} y1={0} x2={100} y2={100} user />
          <Grad id="cc-hand" from={G3} to={G1} x1={50} y1={50} x2={tip.x} y2={tip.y} user />
        </defs>
        {WEB.map((p, i) => (
          <g key={`w${i}`}>
            <line x1={p.x} y1={p.y} x2={NODES[(i * 2) % 12].o.x} y2={NODES[(i * 2) % 12].o.y} stroke="url(#cc-web)" strokeOpacity="0.35" strokeWidth="0.3" />
            <circle cx={p.x} cy={p.y} r="0.9" fill={G1} />
          </g>
        ))}
        <circle cx="50" cy="50" r="40" fill="none" stroke="url(#cc-web)" strokeOpacity="0.6" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="22" fill="none" stroke="url(#cc-web)" strokeOpacity="0.45" strokeWidth="0.4" />
        {NODES.map((n, i) => {
          const far = NODES[(i + 5) % 12].o;
          const near = NODES[(i + 3) % 12].i;
          return (
            <g key={i}>
              <line x1={n.o.x} y1={n.o.y} x2={far.x} y2={far.y} stroke="url(#cc-web)" strokeOpacity="0.5" strokeWidth="0.3" />
              <line x1={n.o.x} y1={n.o.y} x2={near.x} y2={near.y} stroke="url(#cc-web)" strokeOpacity="0.4" strokeWidth="0.3" />
              <circle cx={n.o.x} cy={n.o.y} r="1.2" fill={G1} />
              <circle cx={n.i.x} cy={n.i.y} r="0.8" fill={G2} />
              <text x={polar(i * 30, 46.5).x} y={polar(i * 30, 46.5).y + 1.5} fontSize="4" textAnchor="middle" fill="rgba(148,163,184,0.8)">
                {String(i * 5).padStart(2, '0')}
              </text>
            </g>
          );
        })}
        <path d={`M50 50 L${wedge.x} ${wedge.y} A40 40 0 0 1 ${tip.x} ${tip.y} Z`} fill={G1} opacity="0.18" />
        <line x1="50" y1="50" x2={tip.x} y2={tip.y} stroke="url(#cc-hand)" strokeWidth="1.3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 2px ${G1})` }} />
        <circle cx="50" cy="50" r="1.8" fill={G1} />
      </svg>
      <div className="flex flex-col font-mono">
        <span className={`${SMALL} font-semibold text-white tabular-nums`}>
          {parts.hours}:{parts.minutes}
          <span style={{ backgroundImage: `linear-gradient(90deg, ${G1}, ${G2})`, WebkitBackgroundClip: 'text', color: 'transparent' }}>:{parts.seconds}</span>
        </span>
        <span className={`${TINY} tracking-[0.2em] text-white/50`}>NODE·SYNC{parts.meridiem ? ` · ${parts.meridiem}` : ''}</span>
      </div>
    </Card>
  );
}

export const FACES3 = {
  analog: AnalogFace,
  'kinetic-orbital': KineticOrbitalFace,
  'word-clock': WordClockFace,
  binary: BinaryFace,
  timeline: TimelineFace,
  radar: RadarFace,
  'cosmic-arc': CosmicArcFace,
  'cyber-chrono': CyberChronoFace,
} as const;
