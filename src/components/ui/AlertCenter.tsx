import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import { openInNewTab } from '../../lib/openTab';
import { Favicon } from '../Favicon';
import { dismissAlert, getAlerts, snoozeAlert, subscribeAlerts, type AlertData } from './alertStore';

// The alert stack: solid, matte banners tinted with the theme accent that drop
// from the top edge of the window — opaque so the text reads at a glance. Each source has its own shape:
//   Currently processing → wide "spotlight" banner
//   Queue                → slim "up next" pill
//   To-do                → checklist card with Mark done
//   Overdue on open      → summary sheet with counts
// Up to three show at once (newest on top); the rest wait behind "+N more".

const VISIBLE = 3;
const LIFE_MS = { processing: 12_000, queue: 12_000, todo: 12_000, overdue: 20_000 } as const;

export function AlertCenter() {
  const list = useSyncExternalStore(subscribeAlerts, getAlerts);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (list.length <= VISIBLE) setShowAll(false);
  }, [list.length]);
  const shown = showAll ? list : list.slice(0, VISIBLE);
  const hidden = list.length - shown.length;
  return createPortal(
    <div
      role="region"
      aria-label="Reminders"
      className="pointer-events-none fixed inset-x-0 top-0 z-[110] flex flex-col items-center gap-2.5 px-4 pt-3"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((a, i) => (
          <motion.div
            key={a.key}
            layout
            initial={{ y: -140, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 - Math.min(i, 2) * 0.012 }}
            exit={{ y: -60, opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.9 }}
            className="pointer-events-auto max-w-full"
          >
            <AlertCard a={a} />
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
  const left = useRef<number>(LIFE_MS[a.kind]);
  useEffect(() => {
    if (hover) return;
    const started = Date.now();
    const t = setTimeout(() => dismissAlert(a.key), left.current);
    return () => {
      clearTimeout(t);
      left.current -= Date.now() - started;
    };
  }, [hover, a.key]);

  const open = () => {
    dismissAlert(a.key);
    if (a.url) openInNewTab(a.url);
    else window.dispatchEvent(new CustomEvent('devdeck:show-todo', { detail: { id: a.todoId, focus: a.kind === 'overdue' ? 'overdue' : undefined } }));
  };
  const snooze = () => snoozeAlert(a);
  const close = () => dismissAlert(a.key);
  const done = () => {
    if (a.todoId) useStore.getState().completeTodo(a.todoId);
    dismissAlert(a.key);
  };

  const common = { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false), 'data-alert-kind': a.kind, role: 'alert' as const };

  if (a.kind === 'queue') {
    return (
      <div {...common} className="alert-glass alert-pill flex max-w-[min(700px,94vw)] items-center gap-3 rounded-[10px] border py-2 pr-2 pl-3">
        {a.url ? <Favicon url={a.url} name={a.title} className="size-6 shrink-0 rounded-md" /> : <QueueGlyph />}
        <span className="alert-title min-w-0 truncate text-[15px]">
          <span className="font-bold">Up next:</span> <span className="font-semibold">{a.title}</span>
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
        <p className="alert-title mt-1 truncate text-[17px] font-semibold">Time to work on {a.title}</p>
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
