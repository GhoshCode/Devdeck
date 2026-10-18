import { memo } from 'react';
import { useStore } from '../../store';
import { useNow } from '../../hooks/useNow';
import { clockParts } from '../../lib/time';
import { CLOCK_STYLES, CLOCK_STYLE_NAMES } from '../../lib/clockStyles';
import { ClockFace } from './clock/faces';

// TIME widget (spec §3.1). The face (see clock/faces.tsx) sits bare inside the
// clock + weather card and follows the accent colour; clicking the clock
// cycles through every face (also chosen in Settings → Appearance). All faces
// share role="timer" so assistive tech and the e2e suite find the clock the
// same way whichever face is active.

export { CLOCK_STYLES, CLOCK_STYLE_NAMES };

export const TimeWidget = memo(function TimeWidget() {
  const now = useNow();
  const clock24h = useStore((s) => s.settings.clock24h);
  const clockStyle = useStore((s) => s.settings.clockStyle);
  const showSeconds = useStore((s) => s.settings.showSeconds);
  const updateSettings = useStore((s) => s.updateSettings);
  const parts = clockParts(now, clock24h);
  const label = `${parts.hours}:${parts.minutes}${parts.meridiem ? ` ${parts.meridiem}` : ''}`;

  const at = CLOCK_STYLES.indexOf(clockStyle);
  const next = CLOCK_STYLES[(at + 1) % CLOCK_STYLES.length];
  const prev = CLOCK_STYLES[(at - 1 + CLOCK_STYLES.length) % CLOCK_STYLES.length];

  return (
    <button
      type="button"
      onClick={() => updateSettings({ clockStyle: next })}
      // Secondary (usually right) click steps back to the previous face.
      onContextMenu={(e) => {
        e.preventDefault();
        updateSettings({ clockStyle: prev });
      }}
      aria-label={`Clock style: ${CLOCK_STYLE_NAMES[clockStyle]}. Click to switch to ${CLOCK_STYLE_NAMES[next]}`}
      title={`${label} · ${CLOCK_STYLE_NAMES[clockStyle]} — click: ${CLOCK_STYLE_NAMES[next]} · right-click: ${CLOCK_STYLE_NAMES[prev]}`}
      className="group/clock relative h-full min-w-0 flex-1 cursor-pointer text-left select-none focus-visible:outline-offset-[-2px]"
    >
      <div
        role="timer"
        aria-label="Digital clock"
        aria-live="off"
        data-clock-style={clockStyle}
        className="relative h-full min-w-0 overflow-hidden"
      >
        <ClockFace style={clockStyle} parts={parts} showSeconds={showSeconds} now={now} interactive />
      </div>
      <span
        aria-hidden
        className="clock-hint pointer-events-none absolute bottom-1 left-3 rounded px-1 font-mono text-[8px] tracking-[0.18em] whitespace-nowrap text-white/50 uppercase opacity-0 transition-opacity group-hover/clock:opacity-100"
      >
        {CLOCK_STYLE_NAMES[clockStyle]} · click next · right-click back
      </span>
    </button>
  );
});
