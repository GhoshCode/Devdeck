import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import { openInNewTab } from '../../lib/openTab';
import { Favicon } from '../Favicon';
import { useNow } from '../../hooks/useNow';
import { openBoard } from '../../lib/workBoard';
import { CALENDAR_SNOOZE_MS } from '../../lib/alertEvents';
import { CATEGORY_COLOR, countdown } from '../../lib/calendar';
import { clearAllAlerts, dismissAlert, dismissAlerts, getAlerts, snoozeAlert, stackItems, subscribeAlerts, type AlertData } from './alertStore';

// The alert stack: solid, matte banners tinted with the theme accent that drop
// from the top edge of the window — opaque so the text reads at a glance. Each source has its own shape:
//   Currently processing → wide "spotlight" banner
//   Queue                → slim "up next" pill
//   To-do                → checklist card with Mark done
//   Overdue on open      → summary sheet with counts
//   Calendar event       → glass capsule with a live countdown; stays until
//                          acknowledged, snoozed or jumped to
// Up to three show at once (newest on top); the rest wait behind "+N more".
// Floods stay calm: a site whose reminder fires again while its card is up
// updates that card ("×N"); three or more reminders up at once become one
// "N reminders" card that opens into the list; and while a panel is open
// (sites, settings, calendar, any dialog) alerts wait behind a small
// "N waiting" bell instead of covering it.
// With two or more up, a Clear all pill sits under the stack. A thin line
// along each card's bottom shrinks right → left as its time on screen runs
// out (paused on hover). While any alert is up, a frosted shield sits behind
// the stack: the busy top-middle of the page is blurred and can't be clicked.

const VISIBLE = 3;
// To-do / Queue stay 10 s, Currently processing 5 s; calendar capsules stay until acted on.
const LIFE_MS = { processing: 5_000, queue: 10_000, todo: 10_000, overdue: 20_000, calendar: null } as const;
const CLEAR_STAGGER_S = 0.04;

export function AlertCenter() {
  const list = useSyncExternalStore(subscribeAlerts, getAlerts);
  const [showAll, setShowAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    if (list.length <= VISIBLE) setShowAll(false);
    if (!list.length) setClearing(false);
  }, [list.length]);
  // Render once with the staggered exit in place, then empty the stack.
  const clearAll = () => {
    setClearing(true);
    requestAnimationFrame(() => clearAllAlerts());
  };
  const items = stackItems(list);
  const shown = showAll ? items : items.slice(0, VISIBLE);
  const hidden = items.length - shown.length;
  // Hold the stack while a panel is open; the bell shows it on request.
  const busy = usePanelOpen(list.length > 0);
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    if (!busy || !list.length) setPeek(false);
  }, [busy, list.length]);
  if (busy && !peek && list.length) {
    return createPortal(
      <div role="region" aria-label="Reminders" className="pointer-events-none fixed inset-x-0 top-0 z-[110] flex justify-center pt-3">
        <button
          type="button"
          onClick={() => setPeek(true)}
          data-testid="alerts-waiting"
          title="Reminders wait while a panel is open — click to see them"
          className="alert-clear pointer-events-auto flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-3 text-[13px] font-semibold backdrop-blur-md"
        >
          <BellGlyph />
          {list.length} reminder{list.length === 1 ? '' : 's'} waiting
        </button>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div
      role="region"
      aria-label="Reminders"
      className="pointer-events-none fixed inset-x-0 top-0 z-[110] isolate flex flex-col items-center gap-2.5 px-4 pt-3 pb-4"
    >
      <AnimatePresence>
        {list.length > 0 && !clearing && (
          <motion.div
            key="alert-shield"
            data-testid="alert-shield"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            // only a backdrop for legibility: clicks pass through to the page (a dialog under it stays usable)
            className="alert-shield pointer-events-none absolute top-0 left-1/2 -z-10 h-full w-[min(980px,calc(100vw/var(--ui-zoom,1)))] -translate-x-1/2"
          />
        )}
      </AnimatePresence>
      {/* Clear all sits at the top of the stack, so arriving cards can never cover
          it; leaving cards keep their place until they are gone (no popLayout),
          so the stack never overlaps itself when reminders arrive back to back. */}
      <AnimatePresence initial={false}>
        {list.length > 1 && !clearing && (
          <motion.div
            key="clear-all"
            layout
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
            className="alert-clear pointer-events-auto flex items-center gap-2.5 rounded-full border py-1.5 pr-1.5 pl-3.5 backdrop-blur-md"
          >
            <span className="alert-clear-count font-mono text-[12px] font-semibold tracking-wider tabular-nums">{list.length} ACTIVE</span>
            <button
              type="button"
              onClick={clearAll}
              data-testid="alerts-clear-all"
              className="alert-clear-btn flex items-center gap-2 rounded-full px-4 py-1.5 text-[14px] font-semibold tabular-nums"
            >
              <SweepIcon />
              Clear all ({list.length})
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {shown.map((item, i) => (
          <motion.div
            key={item.type === 'one' ? item.a.key : item.key}
            layout
            initial={{ y: -140, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 - Math.min(i, 2) * 0.012 }}
            exit={
              clearing
                ? { x: 90, opacity: 0, transition: { duration: 0.2, delay: i * CLEAR_STAGGER_S, ease: 'easeIn' } }
                : { y: -60, opacity: 0, scale: 0.96, transition: { duration: 0.2 } }
            }
            transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.9 }}
            className="pointer-events-auto max-w-full"
          >
            {item.type === 'one' ? <AlertCard a={item.a} /> : <GroupCard members={item.members} />}
          </motion.div>
        ))}
        {hidden > 0 && (
          <motion.button
            key="more"
            layout
            type="button"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAll(true)}
            className="alert-glass alert-more pointer-events-auto rounded-md border px-4 py-1.5 text-[13px] font-semibold"
          >
            +{hidden} more reminder{hidden === 1 ? '' : 's'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

function AlertCard({ a }: { a: AlertData }) {
  // Auto-hide, paused while the pointer is on it.
  const [hover, setHover] = useState(false);
  const life = LIFE_MS[a.kind];
  const left = useRef<number>(life ?? 0);
  // the same site firing again restarts the card's time on screen
  const seenRepeat = useRef(a.repeat ?? 1);
  if ((a.repeat ?? 1) !== seenRepeat.current) {
    seenRepeat.current = a.repeat ?? 1;
    left.current = life ?? 0;
  }
  useEffect(() => {
    if (hover || life === null) return;
    const started = Date.now();
    const t = setTimeout(() => dismissAlert(a.key), left.current);
    return () => {
      clearTimeout(t);
      left.current -= Date.now() - started;
    };
  }, [hover, a.key, life, a.repeat]);

  const open = () => {
    dismissAlert(a.key);
    if (a.kind === 'overdue') openBoard({ tab: 'todo', focus: 'overdue' }); // Review: the work panel, overdue first
    else if (a.url) openInNewTab(a.url);
    else window.dispatchEvent(new CustomEvent('devdeck:show-todo', { detail: { id: a.todoId } }));
  };
  const snooze = () => snoozeAlert(a);
  const close = () => dismissAlert(a.key);
  const done = () => {
    if (a.todoId) useStore.getState().completeTodo(a.todoId);
    dismissAlert(a.key);
  };

  const common = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    'data-alert-kind': a.kind,
    // Time-left line (CSS ::after): runs for the whole life, paused with the timer.
    'data-life': life === null ? undefined : '',
    'data-paused': hover ? 'true' : undefined,
    style: life === null ? undefined : ({ '--life': `${life}ms` } as CSSProperties),
    role: 'alert' as const,
  };

  if (a.kind === 'calendar') return <CalendarPill a={a} common={common} />;

  if (a.kind === 'queue') {
    return (
      <div {...common} className="alert-glass alert-pill flex max-w-[min(700px,94vw)] items-center gap-3 rounded-[10px] border py-2 pr-2 pl-3">
        {a.url ? <Favicon url={a.url} name={a.title} className="size-6 shrink-0 rounded-md" /> : <QueueGlyph />}
        <span className="alert-title min-w-0 truncate text-[15px]">
          <span className="font-bold">Up next:</span> <span className="font-semibold">{a.title}</span>
          <RepeatBadge n={a.repeat} />
          {a.sub && <span className="alert-sub font-medium"> · {a.sub}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Btn primary onClick={open}>Open</Btn>
          <Btn onClick={snooze}>Snooze 10m</Btn>
          <CloseBtn onClick={close} />
        </span>
      </div>
    );
  }

  if (a.kind === 'todo') {
    const stripe = a.priority === 1 ? 'is-p1' : a.priority === 2 ? 'is-p2' : a.priority === 3 ? 'is-p3' : '';
    return (
      <div {...common} className={`alert-glass alert-todo ${stripe} relative flex w-[min(540px,94vw)] items-start gap-3.5 overflow-hidden rounded-[10px] border py-3.5 pr-3 pl-5`}>
        <button type="button" onClick={done} aria-label={`Mark “${a.title}” done`} title="Mark done" className="alert-check mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2">
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="alert-eyebrow font-mono text-[11.5px] font-bold tracking-[0.12em]">{a.eyebrow ?? 'TO-DO DUE'}</p>
          <p className="alert-title mt-1 line-clamp-2 text-[17px] leading-snug font-semibold">{a.title}</p>
          {a.sub && <p className="alert-sub mt-0.5 truncate text-[13.5px] font-medium">{a.sub}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn primary onClick={done}>Mark done</Btn>
            <Btn onClick={open}>Open</Btn>
            <Btn onClick={snooze}>Snooze 10m</Btn>
          </div>
        </div>
        <CloseBtn onClick={close} />
      </div>
    );
  }

  if (a.kind === 'overdue') {
    const c = a.counts ?? { todos: 0, queue: 0, processing: 0 };
    const total = c.todos + c.queue + c.processing;
    return (
      <div {...common} className="alert-glass alert-summary w-[min(560px,94vw)] rounded-[10px] border p-4">
        <div className="flex items-center gap-3">
          <span className="alert-badge flex size-10 shrink-0 items-center justify-center rounded-lg">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="alert-title text-[17px] font-semibold">
              You have {total} overdue item{total === 1 ? '' : 's'}
            </p>
            {a.list?.length ? <p className="alert-sub truncate text-[13.5px] font-medium">{a.list.join(' · ')}</p> : null}
          </div>
          <Btn primary onClick={open}>Review</Btn>
          <CloseBtn onClick={close} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Count label="To-dos" n={c.todos} />
          <Count label="Queue" n={c.queue} />
          <Count label="Currently processing" n={c.processing} />
        </div>
      </div>
    );
  }

  // Currently processing: the spotlight banner
  return (
    <div {...common} className="alert-glass alert-spot flex w-[min(680px,94vw)] items-center gap-4 rounded-[10px] border px-4 py-3.5">
      <span className="alert-ring flex size-12 shrink-0 items-center justify-center rounded-lg">
        {a.url ? <Favicon url={a.url} name={a.title} className="size-7 rounded-md" /> : <QueueGlyph />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="alert-eyebrow font-mono text-[11.5px] font-bold tracking-[0.12em]">{a.eyebrow ?? 'CURRENTLY PROCESSING · NOW'}</p>
        <p className="alert-title mt-1 truncate text-[17px] font-semibold">
          Time to work on {a.title}
          <RepeatBadge n={a.repeat} />
        </p>
        {a.sub && <p className="alert-sub truncate text-[13.5px] font-medium">{a.sub}</p>}
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        <Btn primary onClick={open}>Open</Btn>
        <Btn onClick={snooze}>Snooze 10m</Btn>
        <CloseBtn onClick={close} />
      </span>
    </div>
  );
}

function RepeatBadge({ n }: { n?: number }) {
  if (!n || n < 2) return null;
  return (
    <span data-testid="alert-repeat" title={`Fired ${n} times while this was up`} className="alert-repeat ml-2 rounded-md px-1.5 py-px align-middle font-mono text-[11px] font-bold tabular-nums">
      ×{n}
    </span>
  );
}

// Three or more reminders at once: one card, "N reminders now", that opens
// into the list (each row can be opened or dismissed). Snooze all / dismiss
// all act on every member. It stays 10 s after the newest one arrived,
// paused while the pointer is on it or the list is open.
const GROUP_LIFE_MS = 10_000;
function GroupCard({ members }: { members: AlertData[] }) {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const keys = members.map((m) => m.key);
  const newest = Math.max(...members.map((m) => m.shownAt ?? 0));
  const left = useRef(GROUP_LIFE_MS);
  const seen = useRef(newest);
  if (newest !== seen.current) {
    seen.current = newest;
    left.current = GROUP_LIFE_MS;
  }
  useEffect(() => {
    if (hover || open) return;
    const started = Date.now();
    const t = setTimeout(() => dismissAlerts(keys), left.current);
    return () => {
      clearTimeout(t);
      left.current -= Date.now() - started;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, open, newest, keys.join('|')]);
  const names = members.map((m) => (m.repeat && m.repeat > 1 ? `${m.title} ×${m.repeat}` : m.title));
  return (
    <div
      role="alert"
      data-alert-kind="group"
      data-testid="alert-group"
      data-life=""
      data-paused={hover || open ? 'true' : undefined}
      style={{ '--life': `${GROUP_LIFE_MS}ms` } as CSSProperties}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="alert-glass alert-spot w-[min(680px,94vw)] rounded-[10px] border px-4 py-3.5"
    >
      <div className="flex items-center gap-4">
        <span className="alert-ring flex size-12 shrink-0 items-center justify-center rounded-lg">
          <BellGlyph />
        </span>
        <div className="min-w-0 flex-1">
          <p className="alert-eyebrow font-mono text-[11.5px] font-bold tracking-[0.12em]">REMINDERS · NOW</p>
          <p className="alert-title mt-1 truncate text-[17px] font-semibold">{members.length} reminders now</p>
          <p className="alert-sub truncate text-[13.5px] font-medium">{names.join(' · ')}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          <Btn primary onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Show'}</Btn>
          <Btn onClick={() => members.forEach((m) => snoozeAlert(m))}>Snooze all</Btn>
          <CloseBtn onClick={() => dismissAlerts(keys)} />
        </span>
      </div>
      {open && (
        <ul aria-label="Reminders" className="alert-group-list mt-3 max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
          {members.map((m) => (
            <li key={m.key} className="alert-group-row flex items-center gap-2.5 rounded-lg px-2.5 py-1.5">
              {m.url ? <Favicon url={m.url} name={m.title} className="size-5 shrink-0 rounded" /> : <QueueGlyph />}
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                {m.title}
                <RepeatBadge n={m.repeat} />
                {m.sub && <span className="alert-sub font-medium"> · {m.sub}</span>}
              </span>
              <span className="alert-group-kind shrink-0 rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-wider">{m.kind === 'processing' ? 'PROCESSING' : 'QUEUE'}</span>
              <Btn
                onClick={() => {
                  dismissAlert(m.key);
                  if (m.url) openInNewTab(m.url);
                }}
              >
                Open
              </Btn>
              <CloseBtn onClick={() => dismissAlert(m.key)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BellGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// True while a panel covers the page: any dialog (sites, settings, site map,
// composer…) or the full-screen calendar. Checked a few times a second, only
// while there are alerts to hold.
function usePanelOpen(active: boolean): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) return setOpen(false);
    const check = () => setOpen(!!document.querySelector('[role="dialog"]:not([data-alert-ui]), .cmdcal'));
    check();
    const t = setInterval(check, 400);
    return () => clearInterval(t);
  }, [active]);
  return open;
}

// Custom calendar events: a full capsule with a category-coloured glowing
// ring, a ringing bell and a live countdown.
function CalendarPill({ a, common }: { a: AlertData; common: Record<string, unknown> }) {
  const now = useNow(1000).getTime();
  const color = CATEGORY_COLOR[a.category ?? 'meeting'];
  const when = a.startsAt && a.endsAt ? countdown(a.startsAt, a.endsAt, now) : '';
  const live = when === 'Now';
  const jump = () => {
    dismissAlert(a.key);
    window.dispatchEvent(new CustomEvent('devdeck:open-calendar', { detail: { date: a.date, eventId: a.eventId } }));
  };
  return (
    <div {...common} className={`cal-alert ${live ? 'is-live' : ''} rounded-full p-[1.5px]`} style={{ '--cat': color } as CSSProperties}>
      <div className="cal-alert-inner flex max-w-[min(760px,94vw)] items-center gap-3 rounded-full p-1.5 backdrop-blur-xl">
        <span className="cal-alert-icon flex size-11 shrink-0 items-center justify-center rounded-full">
          <BellIcon />
        </span>
        <div className="min-w-0 flex-1 pr-1">
          <p className="flex items-center gap-2">
            <span className="cal-alert-eyebrow truncate font-mono text-[10.5px] font-bold tracking-[0.14em]">{a.eyebrow ?? 'CALENDAR'}</span>
            {when && (
              <span data-testid="cal-alert-countdown" className="cal-alert-when shrink-0 rounded-full px-2 py-px font-mono text-[10.5px] font-bold tabular-nums">
                {when}
              </span>
            )}
          </p>
          <p className="cal-alert-title truncate text-[15px] leading-snug font-semibold">{a.title}</p>
          {a.sub && <p className="cal-alert-sub truncate text-[12px] font-medium tabular-nums">{a.sub}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1">
          <PillBtn primary onClick={() => dismissAlert(a.key)}>Acknowledge</PillBtn>
          <PillBtn onClick={() => snoozeAlert(a, CALENDAR_SNOOZE_MS)}>Snooze 5m</PillBtn>
          <PillBtn onClick={jump}>Jump to slot</PillBtn>
        </span>
      </div>
    </div>
  );
}

function PillBtn({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`cal-alert-btn rounded-full px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap ${primary ? 'is-primary' : ''}`}>
      {children}
    </button>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="cal-alert-bell size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function SweepIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
    </svg>
  );
}

function Count({ label, n }: { label: string; n: number }) {

  return (
    <div className={`alert-count rounded-md px-3 py-2 ${n ? '' : 'is-zero'}`}>
      <p className="alert-sub truncate text-[12.5px] font-medium">{label}</p>
      <p className="alert-title font-mono text-[21px] leading-tight font-bold">{n}</p>
    </div>
  );
}

function Btn({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`alert-btn rounded-md px-3.5 py-1.5 text-[13.5px] font-semibold whitespace-nowrap ${primary ? 'is-primary' : ''}`}>
      {children}
    </button>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Dismiss" className="alert-x flex size-8 shrink-0 items-center justify-center rounded-md">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

function QueueGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" />
    </svg>
  );
}
