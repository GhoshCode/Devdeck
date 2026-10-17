import type { ReactNode } from 'react';
import type { ClockParts } from '../../../lib/time';
import type { ClockStyle } from '../../../lib/clockStyles';

// TIME widget faces. Each fills a size container (`[container-type:size]`) and
// sizes itself with container units, so the same component renders the
// dashboard clock and the small previews in Settings → Appearance. Colour
// always comes from the accent (--color-accent), so every face follows the
// theme the user picked.

export interface FaceProps {
  parts: ClockParts;
  showSeconds: boolean;
  now: Date;
}

const A = 'var(--color-accent)';
const mix = (pct: number, other = 'transparent') => `color-mix(in srgb, ${A} ${pct}%, ${other})`;

// Shared type scale (container units): main HH:MM, seconds, small labels.
const MAIN = 'text-[min(50cqh,20cqw)]';
const SEC = 'text-[min(22cqh,8.5cqw)]';
const TINY = 'text-[max(8px,min(9cqh,3.4cqw))]';

function Meridiem({ parts, className = '' }: { parts: ClockParts; className?: string }) {
  return parts.meridiem ? <span className={`${TINY} font-sans font-bold tracking-widest ${className}`}>{parts.meridiem}</span> : null;
}

// HH:MM with a blinking colon.
function HM({ parts, colon = ':' }: { parts: ClockParts; colon?: string }) {
  return (
    <>
      {parts.hours}
      <span className="clock-colon">{colon}</span>
      {parts.minutes}
    </>
  );
}

// Lit seven-segment digits over faint "88" ghosts.
function Segments({ value, className = '', ghostClass = 'clock-ghost' }: { value: string; className?: string; ghostClass?: string }) {
  return (
    <span className={`relative inline-block font-clock ${className}`}>
      <span aria-hidden className={`absolute inset-0 ${ghostClass}`}>
        {value.replace(/\d/g, '8')}
      </span>
      <span className="relative">{value}</span>
    </span>
  );
}

const center = 'flex h-full w-full items-center justify-center';

// ---- Existing faces ------------------------------------------------------------

function DsegFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="flex h-full w-full flex-col justify-center px-[6cqw]">
      <div
        className="flex items-end gap-[2cqw] leading-none text-white/95"
        style={{ textShadow: `0 0 14px ${mix(55)}` }}
      >
        <span className={`flex items-center ${MAIN}`}>
          <Segments value={parts.hours} />
          <span className="clock-colon mx-[1cqw] font-clock">:</span>
          <Segments value={parts.minutes} />
        </span>
        <span className="flex flex-col items-start gap-[1cqh] pb-[1cqh]">
          <Meridiem parts={parts} className="text-white/50" />
          {showSeconds && <Segments value={parts.seconds} className={`${SEC} text-white/70`} />}
        </span>
      </div>
    </div>
  );
}

function CyberpunkFace({ parts, showSeconds }: FaceProps) {
  return (
    <div
      className="cyber-face relative m-[2cqh] flex h-[calc(100%-4cqh)] flex-col overflow-hidden rounded-[3cqh] border bg-[#0d0d0f]/90 px-[4cqw] py-[2cqh]"
      style={{ borderColor: mix(30) }}
    >
      <div className={`flex items-center justify-between font-mono ${TINY} font-bold tracking-[0.2em]`} style={{ color: mix(75, '#fff') }}>
        <span>// WORLD TIME</span>
        <span aria-hidden className="grid grid-cols-4 gap-[3px]">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="size-[3px] rounded-full" style={{ background: i % 3 === 0 ? mix(55, '#fff') : mix(60) }} />
          ))}
        </span>
      </div>
      <div className="flex flex-1 items-center gap-[2cqw]">
        <span
          className="font-cyber text-[min(60cqh,23cqw)] leading-[0.8] font-bold tracking-tight tabular-nums"
          style={{ color: A, textShadow: `-2px 0 0 rgb(255 0 60 / 0.55), 2px 0 0 ${mix(45, '#0ff')}, 0 0 18px ${mix(35)}` }}
        >
          {parts.hours}:{parts.minutes}
        </span>
        <span className="flex flex-col justify-center gap-[1cqh] font-cyber leading-none">
          {showSeconds && (
            <span className="text-[min(28cqh,11cqw)] font-bold tabular-nums" style={{ color: mix(55, '#fff') }}>
              {parts.seconds}
            </span>
          )}
          <Meridiem parts={parts} className="font-mono" />
        </span>
      </div>
      <span aria-hidden className="absolute right-0 bottom-0 h-[3px] w-1/3" style={{ background: mix(70, '#ff003c') }} />
    </div>
  );
}

function MacFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="flex h-full w-full flex-col justify-center px-[6cqw]">
      <div className="flex items-baseline gap-[1.5cqw] font-mac tabular-nums text-white/95">
        <span className={`${MAIN} leading-none font-extralight tracking-[-0.02em]`}>
          {parts.hours}:{parts.minutes}
        </span>
        <span className="flex flex-col" style={{ color: mix(70, '#fff') }}>
          {showSeconds && <span className={`${SEC} font-light`}>{parts.seconds}</span>}
          <Meridiem parts={parts} />
        </span>
      </div>
    </div>
  );
}

// ---- Glass & neumorphic ------------------------------------------------------------

function GlassProFace({ parts, showSeconds, now }: FaceProps) {
  const offset = -now.getTimezoneOffset();
  const utc = `UTC${offset >= 0 ? '+' : '−'}${Math.floor(Math.abs(offset) / 60)}${offset % 60 ? `:${String(Math.abs(offset) % 60).padStart(2, '0')}` : ''}`;
  return (
    <div className="p-[3cqh] h-full w-full">
      <div className="face-glass relative flex h-full items-center justify-center gap-[2cqw] overflow-hidden rounded-[6cqh] border">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 90% at 85% 0%, ${mix(22)}, transparent 60%)` }} />
        <span className={`relative font-mac ${MAIN} leading-none font-bold tracking-tight text-white tabular-nums`}>
          {parts.hours}:{parts.minutes}
        </span>
        <span className="relative flex flex-col gap-[1cqh] self-start pt-[16cqh] leading-none">
          <Meridiem parts={parts} className="text-white/80" />
          <span className={`${TINY} font-mono text-white/55`}>{showSeconds ? `:${parts.seconds}` : utc}</span>
          {showSeconds && <span className={`${TINY} font-mono text-white/45`}>{utc}</span>}
        </span>
      </div>
    </div>
  );
}

function NeumorphicFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className={`${center} p-[5cqh]`}>
      <div className="face-neu flex h-full w-full items-center justify-center gap-[2cqw] rounded-[10cqh]">
        <span className={`flex items-center ${MAIN} leading-none`} style={{ color: A, textShadow: `0 0 12px ${mix(60)}` }}>
          <Segments value={parts.hours} />
          <span className="clock-colon mx-[1cqw] font-clock">:</span>
          <Segments value={parts.minutes} />
        </span>
        {showSeconds && (
          <span className="self-end pb-[2cqh] opacity-75" style={{ color: A }}>
            <Segments value={parts.seconds} className={SEC} />
          </span>
        )}
      </div>
    </div>
  );
}

function AmbientNeumorphicFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className={`${center} p-[4cqh]`}>
      <div className="face-neu-soft flex h-full w-full items-center justify-center rounded-[8cqh] p-[3cqh]">
        <div className="face-neu-inset flex h-full w-full items-center justify-center gap-[2cqw] rounded-[6cqh]">
          <span className={`font-mac ${MAIN} leading-none font-medium tracking-tight text-white/95 tabular-nums`}>
            {parts.hours}:{parts.minutes}
          </span>
          {showSeconds && (
            <span className={`${SEC} self-end pb-[3cqh] font-mac tabular-nums`} style={{ color: mix(80, '#fff') }}>
              {parts.seconds}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Dot & pixel matrix ------------------------------------------------------------

// 5×7 glyphs; each string is a row, '1' = lit.
const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['0', '0', '1', '0', '1', '0', '0'],
};

function Matrix({ text, dot, gap, square = false, dim }: { text: string; dot: string; gap: string; square?: boolean; dim: string }) {
  return (
    <span aria-hidden className="flex" style={{ gap: `calc(${gap} * 2.2)` }}>
      {[...text].map((ch, i) => {
        const g = GLYPHS[ch] ?? GLYPHS['0'];
        return (
          <span
            key={i}
            className={`grid ${ch === ':' ? 'clock-colon' : ''}`}
            style={{ gridTemplateColumns: `repeat(${g[0].length}, ${dot})`, gap }}
          >
            {g.flatMap((row, r) =>
              [...row].map((on, c) => (
                <span
                  key={`${r}-${c}`}
                  style={{
                    width: dot,
                    height: dot,
                    borderRadius: square ? '1px' : '50%',
                    background: on === '1' ? A : dim,
                    boxShadow: on === '1' ? `0 0 4px ${mix(70)}` : undefined,
                  }}
                />
              )),
            )}
          </span>
        );
      })}
    </span>
  );
}

function DotMatrixFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div className="face-led flex h-full items-center justify-center gap-[3cqw] rounded-[4cqh] border" style={{ borderColor: mix(25) }}>
        <Matrix text={`${parts.hours}:${parts.minutes}`} dot="min(5.2cqh,1.5cqw)" gap="min(2.2cqh,0.65cqw)" dim={mix(10)} />
        {showSeconds && <Matrix text={parts.seconds} dot="min(2.8cqh,0.8cqw)" gap="min(1.2cqh,0.35cqw)" dim={mix(10)} />}
      </div>
    </div>
  );
}

function MicroPixelFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div className="face-pixel flex h-full items-center justify-center gap-[3cqw] rounded-[5cqh]">
        <Matrix text={`${parts.hours}:${parts.minutes}`} dot="min(4.6cqh,1.35cqw)" gap="min(1.9cqh,0.55cqw)" square dim={mix(6)} />
        {showSeconds && <Matrix text={parts.seconds} dot="min(2.4cqh,0.7cqw)" gap="min(1cqh,0.3cqw)" square dim={mix(6)} />}
      </div>
    </div>
  );
}

// ---- Futuristic ------------------------------------------------------------------------

function HolographicFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div
        className="relative flex h-full items-center justify-center overflow-hidden rounded-[5cqh] border"
        style={{ borderColor: mix(30), background: `radial-gradient(circle at 50% 50%, ${mix(18)}, transparent 70%), linear-gradient(135deg, ${mix(12, '#0b1020')}, #0b1020)` }}
      >
        <span aria-hidden className="holo-ring absolute aspect-square h-[88%] rounded-full border-2 border-dashed" style={{ borderColor: mix(45) }} />
        <span aria-hidden className="absolute aspect-square h-[70%] rounded-full border" style={{ borderColor: mix(30) }} />
        <span aria-hidden className="holo-ring-rev absolute aspect-square h-[100%] rounded-full border-t-2 border-b-2" style={{ borderColor: mix(55) }} />
        <span
          className={`relative font-display ${MAIN} leading-none font-semibold tabular-nums`}
          style={{
            backgroundImage: `linear-gradient(180deg, #fff, ${mix(80, '#9ff')})`,
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            filter: `drop-shadow(0 0 10px ${mix(60)})`,
          }}
        >
          {parts.hours}:{parts.minutes}
        </span>
        {showSeconds && (
          <span className={`absolute right-[5cqw] bottom-[6cqh] font-mono ${TINY}`} style={{ color: mix(80, '#fff') }}>
            {parts.seconds}s
          </span>
        )}
      </div>
    </div>
  );
}

function CyberpunkHudFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div
        className="face-hud relative flex h-full flex-col justify-center px-[6cqw]"
        style={{ background: `linear-gradient(${mix(85)}, ${mix(85)}) top left / 22% 2px no-repeat, #0b0b0d`, borderColor: mix(70) }}
      >
        <span className={`absolute top-[4cqh] left-1/2 -translate-x-1/2 font-mono text-[max(7px,min(7cqh,2.6cqw))] tracking-[0.25em] whitespace-nowrap`} style={{ color: mix(80, '#fff') }}>
          TECHNICAL TELEMETRY
        </span>
        <div className="flex items-end justify-center gap-[2cqw] pt-[8cqh] leading-none" style={{ color: A, textShadow: `0 0 10px ${mix(50)}` }}>
          <span className="flex items-center text-[min(44cqh,18cqw)]">
            <Segments value={parts.hours} ghostClass="face-hud-ghost" />
            <span className="clock-colon mx-[1cqw] font-clock">:</span>
            <Segments value={parts.minutes} ghostClass="face-hud-ghost" />
          </span>
          {showSeconds && <Segments value={parts.seconds} className={SEC} ghostClass="face-hud-ghost" />}
        </div>
        <span aria-hidden className="absolute top-[22%] bottom-[22%] left-[2cqw] w-[3px]" style={{ background: mix(70) }} />
        <span aria-hidden className="absolute top-[22%] right-[2cqw] bottom-[22%] w-[3px]" style={{ background: mix(70) }} />
        <span aria-hidden className={`absolute bottom-[5cqh] left-[5cqw] font-mono ${TINY} text-white/40`}>
          LOC·SYNC
        </span>
      </div>
    </div>
  );
}

function SplitGeometricFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div className="face-split relative flex h-full items-center justify-center gap-[2cqw] overflow-hidden">
        <span aria-hidden className="absolute top-[5cqh] left-1/2 h-[4cqh] w-1/2 -translate-x-1/2 face-stripes" />
        <span aria-hidden className="absolute bottom-[5cqh] left-1/2 h-[4cqh] w-1/2 -translate-x-1/2 face-stripes" />
        <span
          className={`face-split-digits relative font-display ${MAIN} leading-none font-black tracking-tight tabular-nums`}
          style={{ backgroundImage: `linear-gradient(170deg, #f1f5f9 0%, ${mix(45, '#cbd5e1')} 48%, transparent 48.5%, transparent 52%, ${mix(55, '#94a3b8')} 52.5%, #64748b 100%)` }}
        >
          {parts.hours}:{parts.minutes}
        </span>
        {showSeconds && (
          <span className={`relative self-end pb-[8cqh] font-display ${SEC} font-black text-white/50 tabular-nums`}>{parts.seconds}</span>
        )}
      </div>
    </div>
  );
}

function ScifiSegmentedFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div className="face-octagon relative flex h-full items-center justify-center gap-[2cqw]" style={{ ['--a' as string]: A }}>
        <span className={`flex items-center ${MAIN} leading-none`} style={{ color: A, textShadow: `0 0 12px ${mix(55)}` }}>
          <Segments value={parts.hours} ghostClass="face-seg-ghost" />
          <span className="clock-colon mx-[1cqw] font-clock">:</span>
          <Segments value={parts.minutes} ghostClass="face-seg-ghost" />
        </span>
        {showSeconds && (
          <span className="self-end pb-[3cqh]" style={{ color: A, textShadow: `0 0 10px ${mix(50)}` }}>
            <Segments value={parts.seconds} className={SEC} ghostClass="face-seg-ghost" />
          </span>
        )}
      </div>
    </div>
  );
}

function DiffusedGlowFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className={`${center} gap-[2cqw]`} style={{ background: `radial-gradient(60% 70% at 50% 55%, ${mix(16)}, transparent 70%)` }}>
      <span
        className={`face-glow font-mac ${MAIN} leading-none font-light tracking-tight tabular-nums`}
        style={{ color: mix(55, '#fff'), textShadow: `0 0 8px ${mix(80)}, 0 0 22px ${mix(70)}, 0 0 44px ${mix(55)}` }}
      >
        {parts.hours}:{parts.minutes}
      </span>
      {showSeconds && (
        <span className={`${SEC} self-end pb-[4cqh] font-mac font-light tabular-nums`} style={{ color: mix(60, '#fff'), textShadow: `0 0 12px ${mix(70)}` }}>
          {parts.seconds}
        </span>
      )}
    </div>
  );
}

// ---- Gradient & glass ------------------------------------------------------------------

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function GradientFrostFace({ parts, showSeconds, now }: FaceProps) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div
        className="face-glass relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[6cqh] border"
        style={{ background: `radial-gradient(80% 90% at 70% 30%, ${mix(35)}, transparent 70%), rgba(255,255,255,0.06)` }}
      >
        <span
          className={`face-frost-digits font-mac text-[min(46cqh,19cqw)] leading-none font-semibold tracking-tight tabular-nums`}
          style={{ backgroundImage: `linear-gradient(120deg, #fff 20%, ${mix(85, '#fff')} 70%)`, WebkitBackgroundClip: 'text', color: 'transparent' }}
        >
          {parts.hours}:{parts.minutes}
          {showSeconds && <span className={`${SEC} font-medium opacity-70`}>:{parts.seconds}</span>}
        </span>
        <span className={`${TINY} mt-[2cqh] font-mac font-medium tracking-[0.25em] text-white/65 uppercase`}>{dateFmt.format(now)}</span>
      </div>
    </div>
  );
}

function PrismGlassFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="h-full w-full p-[4cqh]">
      <div
        className="relative h-full rounded-[7cqh] p-[2px]"
        style={{ background: `conic-gradient(from 210deg, ${A}, #7dd3fc, #f0abfc, ${mix(60, '#fff')}, ${A})` }}
      >
        <div className="face-prism-inner flex h-full items-center justify-center gap-[2cqw] rounded-[calc(7cqh-2px)]">
          <span className={`font-mac ${MAIN} leading-none font-light tracking-tight text-white/95 tabular-nums`}>
            <HM parts={parts} />
          </span>
          {showSeconds && <span className={`${SEC} self-end pb-[3cqh] font-mac font-light text-white/55 tabular-nums`}>{parts.seconds}</span>}
        </div>
      </div>
    </div>
  );
}

function LinearOutlineFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className={`${center} gap-[2cqw]`}>
      <span
        className={`font-mac text-[min(58cqh,23cqw)] leading-none font-thin tracking-tight tabular-nums`}
        style={{ color: 'transparent', WebkitTextStroke: `1.4px ${A}`, filter: `drop-shadow(0 0 6px ${mix(40)})` }}
      >
        {parts.hours}:{parts.minutes}
      </span>
      {showSeconds && (
        <span className={`${SEC} self-end pb-[5cqh] font-mac font-thin tabular-nums`} style={{ color: 'transparent', WebkitTextStroke: `1px ${mix(70)}` }}>
          {parts.seconds}
        </span>
      )}
    </div>
  );
}

// ---- Developer -----------------------------------------------------------------------------

function dayOfYear(d: Date) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86_400_000);
}
function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
}

function DevMonoFace({ parts, showSeconds, now }: FaceProps) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div className="face-terminal flex h-full flex-col justify-center rounded-[4cqh] border px-[6cqw]">
        <span className="font-mono text-[min(40cqh,14cqw)] leading-none font-medium tracking-tight text-white/95 tabular-nums">
          {parts.hours}:{parts.minutes}
          {showSeconds && <span style={{ color: mix(80, '#fff') }}>:{parts.seconds}</span>}
          {parts.meridiem && <span className={`${TINY} ml-[1cqw] text-white/45`}>{parts.meridiem}</span>}
        </span>
        <span className={`mt-[4cqh] flex justify-between font-mono ${TINY} tracking-wider text-white/45 uppercase`}>
          <span>
            day <span style={{ color: A }}>{dayOfYear(now)}</span>
          </span>
          <span className="flex items-center gap-1">
            sync <span className="inline-block size-[5px] rounded-full" style={{ background: A }} />
          </span>
          <span>
            wk <span style={{ color: A }}>{isoWeek(now)}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

function TerminalChrome({ children }: { children: ReactNode }) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div className="face-terminal relative flex h-full flex-col rounded-[4cqh] border px-[5cqw] pt-[5cqh]">
        <span aria-hidden className="flex gap-[1.2cqw]">
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} className="aspect-square h-[min(5cqh,1.8cqw)] rounded-full" style={{ background: c }} />
          ))}
          <span className="ml-auto flex gap-[1cqw]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="aspect-square h-[min(4cqh,1.4cqw)] rounded-full" style={{ background: i === 0 ? A : 'rgba(255,255,255,0.25)' }} />
            ))}
          </span>
        </span>
        {children}
      </div>
    </div>
  );
}

function CliChronoFace({ parts, showSeconds }: FaceProps) {
  return (
    <TerminalChrome>
      <span className="flex flex-1 items-center font-mono text-[min(36cqh,12.5cqw)] leading-none text-white/90 tabular-nums">
        <span style={{ color: A }}>&gt;</span>
        <span className="ml-[2cqw]">
          {parts.hours}:{parts.minutes}
          {showSeconds && `:${parts.seconds}`}
        </span>
      </span>
    </TerminalChrome>
  );
}

function CliSophisticatedFace({ parts, showSeconds, now }: FaceProps) {
  return (
    <div className="h-full w-full p-[3cqh]">
      <div className="face-terminal relative flex h-full flex-col justify-center rounded-[4cqh] border px-[5cqw]" style={{ background: `linear-gradient(${mix(8, '#04110d')}, #050a0a)` }}>
        <span className={`absolute top-[6cqh] left-[5cqw] font-mono ${TINY} leading-tight text-white/45`}>
          sys.clock — {now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()} · tz synced
          <span className="clock-colon">..</span>
        </span>
        <span className="font-mono text-[min(38cqh,13cqw)] leading-none font-semibold tabular-nums" style={{ color: mix(70, '#fff'), textShadow: `0 0 10px ${mix(40)}` }}>
          <span style={{ color: A }}>&gt; </span>
          {parts.hours}:{parts.minutes}
          {showSeconds && `:${parts.seconds}`}
        </span>
        <span aria-hidden className="cli-cursor absolute right-[5cqw] bottom-[8cqh] h-[9cqh] w-[2.2cqw]" style={{ background: A }} />
      </div>
    </div>
  );
}

export const FACES: Record<ClockStyle, (p: FaceProps) => ReactNode> = {
  dseg7: DsegFace,
  cyberpunk: CyberpunkFace,
  macos: MacFace,
  'glass-pro': GlassProFace,
  neumorphic: NeumorphicFace,
  'ambient-neumorphic': AmbientNeumorphicFace,
  'dot-matrix': DotMatrixFace,
  'micro-pixel': MicroPixelFace,
  holographic: HolographicFace,
  'cyberpunk-hud': CyberpunkHudFace,
  'split-geometric': SplitGeometricFace,
  'scifi-segmented': ScifiSegmentedFace,
  'diffused-glow': DiffusedGlowFace,
  'gradient-frost': GradientFrostFace,
  'prism-glass': PrismGlassFace,
  'linear-outline': LinearOutlineFace,
  'dev-mono': DevMonoFace,
  'cli-chrono': CliChronoFace,
  'cli-sophisticated': CliSophisticatedFace,
};

// A face inside its size container — what the dashboard and the previews render.
export function ClockFace({ style, ...props }: FaceProps & { style: ClockStyle }) {
  const Face = FACES[style] ?? FACES.dseg7;
  return (
    <div data-clock-face={style} className="h-full w-full [container-type:size]">
      <Face {...props} />
    </div>
  );
}
