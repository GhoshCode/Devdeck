import { memo, useEffect, useState } from 'react';
import { viewTimer, type Timer } from '../../lib/timer';

// A live countdown chip. It keeps its own clock — every second for hh:mm:ss,
// every 15 s for hh:mm, every minute for days — so a long list never
// re-renders to tick.
export const Countdown = memo(function Countdown({ timer, className = '', onClick }: { timer: Timer; className?: string; onClick?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const view = viewTimer(timer, now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), view.refreshMs);
    return () => clearInterval(id);
  }, [view.refreshMs]);

  const tone =
    view.state === 'over'
      ? 'countdown-done'
      : view.state === 'soon'
        ? 'countdown-soon'
        : 'countdown-run';
  const label = `Timer: ${view.text} (ends ${new Date(view.end).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })})`;
  const body = (
    <>
      <svg viewBox="0 0 12 12" className="size-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <circle cx="6" cy="6.8" r="4.2" />
        <path d="M6 4.6v2.3l1.4 1M4.8 1.2h2.4" strokeLinecap="round" />
      </svg>
      <span className="tabular-nums">{view.text}</span>
    </>
  );
  const cls = `countdown ${tone} inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-px font-mono text-[10px] whitespace-nowrap ${className}`;
  return onClick ? (
    <button type="button" data-testid="countdown" onClick={onClick} title={label} aria-label={`${label} — change`} className={`${cls} hover:brightness-125`}>
      {body}
    </button>
  ) : (
    <span data-testid="countdown" title={label} aria-label={label} className={cls}>
      {body}
    </span>
  );
});
