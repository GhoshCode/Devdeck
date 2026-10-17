import { memo } from 'react';
import type { ClockStyle } from '../../types';
import { useStore } from '../../store';
import { useNow } from '../../hooks/useNow';
import { clockParts, type ClockParts } from '../../lib/time';

// TIME widget (spec §3.1): three faces. They sit bare inside the clock +
// weather card; clicking the clock cycles the face (also in Settings ->
// Appearance). All share role="timer" so assistive tech and the e2e suite find
// the clock the same way whichever face is active.

export const CLOCK_STYLES: readonly ClockStyle[] = ['dseg7', 'cyberpunk', 'macos'];
export const CLOCK_STYLE_NAMES: Record<ClockStyle, string> = {
  dseg7: 'Digital (DSEG7)',
  cyberpunk: 'Cyberpunk 2077',
  macos: 'macOS Minimal',
};

export const TimeWidget = memo(function TimeWidget() {
  const now = useNow();
  const clock24h = useStore((s) => s.settings.clock24h);
  const clockStyle = useStore((s) => s.settings.clockStyle);
  const showSeconds = useStore((s) => s.settings.showSeconds);
  const updateSettings = useStore((s) => s.updateSettings);
  const parts = clockParts(now, clock24h);
  const label = `${parts.hours}:${parts.minutes}${parts.meridiem ? ` ${parts.meridiem}` : ''}`;

  const next = CLOCK_STYLES[(CLOCK_STYLES.indexOf(clockStyle) + 1) % CLOCK_STYLES.length];

  return (
    <button
      type="button"
      onClick={() => updateSettings({ clockStyle: next })}
      aria-label={`Clock style: ${CLOCK_STYLE_NAMES[clockStyle]}. Click to switch to ${CLOCK_STYLE_NAMES[next]}`}
      title={`${label} · ${CLOCK_STYLE_NAMES[clockStyle]} — click for ${CLOCK_STYLE_NAMES[next]}`}
      className="group/clock relative h-full min-w-0 flex-1 cursor-pointer text-left select-none focus-visible:outline-offset-[-2px]"
    >
      <div
        role="timer"
        aria-label="Digital clock"
        aria-live="off"
        data-clock-style={clockStyle}
        className="relative h-full min-w-0 overflow-hidden"
      >
        {clockStyle === 'cyberpunk' ? (
          <CyberpunkFace parts={parts} showSeconds={showSeconds} />
        ) : clockStyle === 'macos' ? (
          <MacFace parts={parts} showSeconds={showSeconds} />
        ) : (
          <SegmentFace parts={parts} showSeconds={showSeconds} />
        )}
      </div>
      {/* The Cyberpunk face has its own header strip, so no hint over it. */}
      {clockStyle !== 'cyberpunk' && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 left-3 font-mono text-[8px] tracking-[0.18em] whitespace-nowrap text-white/40 uppercase opacity-0 transition-opacity group-hover/clock:opacity-100"
        >
          {CLOCK_STYLE_NAMES[clockStyle]} · click to change
        </span>
      )}
    </button>
  );
});

interface FaceProps {
  parts: ClockParts;
  showSeconds: boolean;
}

// 1. DSEG7 — lit segments over a faint "88" ghost, pulsing colon, accent glow.
function SegmentFace({ parts, showSeconds }: FaceProps) {
  const digits = (value: string, ghost: string, className: string) => (
    <span className={`relative inline-block ${className}`}>
      <span aria-hidden className="clock-ghost absolute inset-0">
        {ghost}
      </span>
      <span className="relative">{value}</span>
    </span>
  );

  return (
    <div className="flex h-full flex-col justify-center px-4 py-3">
      <div className="flex items-end gap-2 font-clock leading-none text-white/95 [text-shadow:0_0_14px_color-mix(in_srgb,var(--color-accent)_55%,transparent)]">
        <span className="flex items-center text-[2.8rem]">
          {digits(parts.hours, '88', '')}
          <span className="clock-colon mx-0.5">:</span>
          {digits(parts.minutes, '88', '')}
        </span>
        <span className="flex flex-col items-start gap-1 pb-0.5">
          {parts.meridiem && (
            <span className="font-sans text-[10px] font-bold tracking-widest text-white/50">
              {parts.meridiem}
            </span>
          )}
          {showSeconds && digits(parts.seconds, '88', 'text-lg text-white/70')}
        </span>
      </div>
    </div>
  );
}

// 2. Cyberpunk 2077 — massive condensed HH:MM, seconds stacked half-height on
// the right flank. Per §7 Q9 there is deliberately NO row of world-clock cities.
function CyberpunkFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="cyber-face relative m-1.5 flex h-[calc(100%-12px)] flex-col overflow-hidden rounded-xl border border-[#fcee0a]/30 bg-[#0d0d0f]/90 px-3.5 pt-1.5 pb-1.5">
      <div className="flex items-center justify-between font-mono text-[9px] font-bold tracking-[0.2em] text-[#fcee0a]/70">
        <span>// WORLD TIME</span>
        <span aria-hidden className="grid grid-cols-4 gap-[3px]">
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className={`size-[3px] rounded-full ${i % 3 === 0 ? 'bg-[#00f0ff]' : 'bg-[#fcee0a]/60'}`}
            />
          ))}
        </span>
      </div>
      <div className="flex flex-1 items-center gap-2">
        <span className="cyber-digits font-cyber text-[3.2rem] leading-[0.8] font-bold tracking-tight text-[#fcee0a] tabular-nums">
          {parts.hours}:{parts.minutes}
        </span>
        <span className="flex flex-col justify-center gap-0.5 font-cyber leading-none">
          {showSeconds && (
            <span className="text-[1.7rem] font-bold text-[#00f0ff] tabular-nums">{parts.seconds}</span>
          )}
          {parts.meridiem && (
            <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#fcee0a]/70">
              {parts.meridiem}
            </span>
          )}
        </span>
      </div>
      <span aria-hidden className="absolute right-0 bottom-0 h-[3px] w-1/3 bg-[#ff003c]" />
    </div>
  );
}

// 3. macOS — SF/Inter at light weight, tabular numerals, quiet glass.
function MacFace({ parts, showSeconds }: FaceProps) {
  return (
    <div className="flex h-full flex-col justify-center px-5 py-3">
      <div className="flex items-baseline gap-1.5 font-mac tabular-nums text-white/95">
        <span className="text-[3.1rem] leading-none font-extralight tracking-[-0.02em]">
          {parts.hours}:{parts.minutes}
        </span>
        <span className="flex flex-col text-white/60">
          {showSeconds && <span className="text-[1.15rem] font-light">{parts.seconds}</span>}
          {parts.meridiem && <span className="text-[10px] font-medium tracking-wide">{parts.meridiem}</span>}
        </span>
      </div>
    </div>
  );
}
