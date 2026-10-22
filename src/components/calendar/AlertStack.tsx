import { memo, useMemo, useSyncExternalStore, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { CalendarEvent, ProcessingItem, Todo } from '../../types';
import { upcomingEvents, type AlertData } from '../../lib/alertEvents';
import { CATEGORY_COLOR, DAY, fmtDuration, fmtTime } from '../../lib/calendar';
import { clearAllAlerts, dismissAlert, getAlerts, subscribeAlerts } from '../ui/alertStore';

// The calendar's alert stack: what's on screen now (with Clear all once two
// or more are up) and everything set to fire in the next 24 hours. Calendar
// events show as capsules; to-do / Queue / Processing keep their card shape.

interface Props {
  events: readonly CalendarEvent[];
  todos: readonly Todo[];
  processing: readonly ProcessingItem[];
  now: number;
  h24: boolean;
  onJump: (date: string, eventId: string) => void;
}

const TONE: Record<AlertData['kind'], string> = { processing: '#10b981', queue: '#f59e0b', todo: '#38bdf8', overdue: '#f43f5e', calendar: 'var(--color-accent)' };
const toneOf = (a: AlertData) => (a.kind === 'calendar' ? CATEGORY_COLOR[a.category ?? 'meeting'] : TONE[a.kind]);
const KIND_TAG: Record<AlertData['kind'], string> = { processing: 'PROCESSING', queue: 'QUEUE', todo: 'TO-DO', overdue: 'OVERDUE', calendar: 'CALENDAR' };

export const AlertStack = memo(function AlertStack({ events, todos, processing, now, h24, onJump }: Props) {
  const live = useSyncExternalStore(subscribeAlerts, getAlerts);
  const next = useMemo(() => upcomingEvents(processing, todos, now, events).filter((e) => e.at < now + DAY).slice(0, 12), [processing, todos, now, events]);

  return (
    <aside aria-label="Alert stack" data-testid="cal-alert-stack" className="cc-stack hidden w-[340px] shrink-0 flex-col rounded-2xl border p-4 xl:flex">
      <header className="cc-line mb-3 flex items-center gap-2.5 border-b pb-3">
        <span className="cc-stack-icon flex size-8 items-center justify-center rounded-lg">
          <BellIcon />
        </span>
        <div className="min-w-0">
          <p className="cc-fg flex items-center gap-2 text-[11.5px] font-bold tracking-[0.12em] uppercase">
            Alert stack
            <span className="cc-count rounded-full px-1.5 font-mono text-[10.5px] tabular-nums">{live.length}</span>
          </p>
          <p className="cc-fg3 truncate text-[10.5px]">Capsule = calendar event · Card = to-do, Queue, Processing</p>
        </div>
      </header>

      <div className="cc-scroll -mr-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        <section aria-label="Live now">
          <p className="cc-eyebrow mb-2">Live now</p>
          {live.length === 0 ? (
            <p className="cc-empty rounded-xl border border-dashed px-3 py-4 text-center text-[11.5px]">No alerts on screen.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {live.map((a) => (
                  <motion.div key={a.key} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}>
                    <Mini a={a} meta={a.kind === 'calendar' && a.startsAt ? whenText(a.startsAt, now) : 'On screen'} onClose={() => dismissAlert(a.key)} onClick={a.kind === 'calendar' && a.date && a.eventId ? () => onJump(a.date!, a.eventId!) : undefined} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          <AnimatePresence>
            {live.length > 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="cc-line mt-3 flex items-center justify-between border-t pt-3">
                <span className="cc-fg3 text-[11px] tabular-nums">{live.length} alerts active</span>
                <button type="button" onClick={clearAllAlerts} className="alert-clear-btn flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold tabular-nums">
                  <TrashIcon />
                  Clear all ({live.length})
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section aria-label="Next 24 hours">
          <p className="cc-eyebrow mb-2">Next 24 hours</p>
          {next.length === 0 ? (
            <p className="cc-empty rounded-xl border border-dashed px-3 py-4 text-center text-[11.5px]">Nothing set to alert.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {next.map((e) => (
                <Mini key={e.data.key} a={e.data} meta={`${fmtTime(e.at, h24)} · ${whenText(e.at, now)}`} onClick={e.data.kind === 'calendar' && e.data.date && e.data.eventId ? () => onJump(e.data.date!, e.data.eventId!) : undefined} />
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
});

const whenText = (at: number, now: number) => (at <= now ? 'Now' : `in ${fmtDuration(Math.ceil((at - now) / 60_000) * 60_000)}`);

function Mini({ a, meta, onClose, onClick }: { a: AlertData; meta: string; onClose?: () => void; onClick?: () => void }) {
  const style = { '--k': toneOf(a) } as CSSProperties;
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="cc-mini-tag rounded-full px-1.5 font-mono text-[9px] font-bold tracking-wider">{a.kind === 'calendar' ? (a.eyebrow ?? 'CALENDAR') : KIND_TAG[a.kind]}</span>
          <span className="cc-fg3 truncate font-mono text-[10px] tabular-nums">{meta}</span>
        </span>
        <span className="cc-fg mt-0.5 block truncate text-[12px] font-semibold">{a.kind === 'overdue' ? `${a.title} items` : a.title}</span>
        {a.sub && <span className="cc-fg3 block truncate text-[10.5px]">{a.sub}</span>}
      </span>
      {onClose && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Dismiss"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
          className="cc-iconbtn flex size-6 shrink-0 items-center justify-center rounded-full"
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </span>
      )}
    </>
  );
  if (a.kind === 'calendar')
    return (
      <div className="cc-mini-capsule rounded-full p-px" style={style}>
        <button type="button" onClick={onClick} disabled={!onClick} className="cc-mini-capsule-in flex w-full items-center gap-2.5 rounded-full py-1.5 pr-1.5 pl-1.5 text-left">
          <span className="cc-mini-ring flex size-8 shrink-0 items-center justify-center rounded-full">
            <BellIcon />
          </span>
          {body}
        </button>
      </div>
    );
  return (
    <div className={`cc-mini-card flex items-start gap-2 rounded-xl border p-2.5 ${a.kind === 'queue' ? 'border-dashed' : ''}`} style={style}>
      {body}
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
    </svg>
  );
}
