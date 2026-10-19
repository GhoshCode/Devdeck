import { type WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import { FIRST_SECTION, type ProcessingItem } from '../../types';
import { useNow } from '../../hooks/useNow';
import { useIdleTimeout } from '../../hooks/useIdleTimeout';
import { describeSchedule, nextFireTime } from '../../lib/schedule';
import { dueTimestamp } from '../../lib/todos';
import { relativeAge } from '../../services/search';
import { openInNewTab } from '../../lib/openTab';
import { OPEN_BOARD_EVENT, type BoardRequest, type BoardTab } from '../../lib/workBoard';
import { getHostname } from '../../utils';
import { Favicon } from '../Favicon';
import { Countdown } from '../ui/Countdown';
import { TimerPanel } from '../ui/TimerPanel';
import { AnchoredPopover } from '../ui/AnchoredPopover';
import { SlidersIcon } from '../ui/icons';
import { showUndo } from '../ui/UndoToast';
import { TODO_IDLE_MS, TodoWidget } from '../topbar/todo/TodoWidget';
import { ProcessingManager } from './ProcessingPanel';

// The big work panel: Currently processing → Queue → To-do side by side in
// one wide box, one visible at a time. Tabs on top and dots below switch;
// a horizontal swipe / scroll or ←/→ moves too. Opened by the expand buttons
// on the left-column cards (landing on that card's tab) and by an overdue
// alert's Review (To-do, overdue first). Closes on Esc, a click outside or
// 30 s without interaction.

const TABS: ReadonlyArray<{ id: BoardTab; label: string }> = [
  { id: 'processing', label: 'Currently processing' },
  { id: 'queue', label: 'Queue' },
  { id: 'todo', label: 'To-do' },
];

type Open = BoardRequest & { nonce: number };

export function WorkBoardHost() {
  const [req, setReq] = useState<Open | null>(null);
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => setReq({ ...(e as CustomEvent<BoardRequest>).detail, nonce: Date.now() });
    window.addEventListener(OPEN_BOARD_EVENT, onOpen);
    // An overdue alert's Review on another website opens DevDeck at #review.
    if (location.hash === '#review') {
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => setReq({ tab: 'todo', focus: 'overdue', nonce: Date.now() }), 400);
    }
    return () => window.removeEventListener(OPEN_BOARD_EVENT, onOpen);
  }, []);

  return createPortal(
    <>
      <AnimatePresence>{req && !managing && <WorkBoard key="board" req={req} onClose={() => setReq(null)} onManage={() => setManaging(true)} />}</AnimatePresence>
      <AnimatePresence>{managing && <ProcessingManager onClose={() => setManaging(false)} />}</AnimatePresence>
    </>,
    document.body,
  );
}

function WorkBoard({ req, onClose, onManage }: { req: Open; onClose: () => void; onManage: () => void }) {
  const processing = useStore((s) => s.processing);
  const todoCount = useStore((s) => s.todos.filter((t) => t.archivedAt === null).length);
  const now = useNow(30_000);
  const cardRef = useRef<HTMLDivElement>(null);
  const swipe = useRef({ sum: 0, lock: 0 });
  const [tab, setTab] = useState<number>(() => Math.max(0, TABS.findIndex((t) => t.id === req.tab)));
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const sorted = useMemo(() => [...processing].sort((a, b) => a.order - b.order), [processing]);
  const doing = sorted.filter((p) => p.section === FIRST_SECTION);
  const queued = sorted.filter((p) => p.section !== FIRST_SECTION);
  const counts = [doing.length, queued.length, todoCount];

  useIdleTimeout(cardRef, true, TODO_IDLE_MS, onClose);

  const go = useCallback((i: number) => setTab(Math.max(0, Math.min(TABS.length - 1, i))), []);

  // Land on the requested tab (again when another request arrives while open).
  useEffect(() => {
    const i = Math.max(0, TABS.findIndex((t) => t.id === req.tab));
    go(i);
  }, [req.nonce, req.tab, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        go(tabRef.current + (e.key === 'ArrowRight' ? 1 : -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, go]);

  const flip = (d: number) => {
    if (Math.abs(d) > 4) go(tabRef.current + (d > 0 ? 1 : -1));
  };
  // A sideways trackpad swipe / shift-wheel over the lists: one tab per gesture.
  const onSwipe = (e: ReactWheelEvent) => {
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (!dx) return;
    const now = Date.now();
    if (now < swipe.current.lock) return;
    swipe.current.sum += dx;
    if (Math.abs(swipe.current.sum) > 60) {
      go(tabRef.current + (swipe.current.sum > 0 ? 1 : -1));
      swipe.current = { sum: 0, lock: now + 550 };
    }
  };

  return (
    <>
      <motion.div key="board-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-[5vh] pb-6">
        <motion.div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-label="Work panel"
          data-testid="work-board"
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          className="work-board pointer-events-auto flex h-[min(86vh,860px)] w-full max-w-[1080px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[var(--color-base-elevated)]/[0.97] shadow-2xl backdrop-blur-2xl"
        >
          <header className="flex shrink-0 items-center gap-3 px-5 pt-4 pb-3">
            <div
              role="tablist"
              aria-label="Work lists"
              onWheel={(e) => flip(Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)}
              className="pane-switch @container relative grid w-full max-w-[760px] grid-cols-3 rounded-2xl border p-1"
            >
              <span
                aria-hidden
                className="pane-switch-pill work-pill absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] rounded-xl motion-reduce:transition-none"
                style={{ transform: `translateX(${tab * 100}%)` }}
              />
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === i}
                  onClick={() => go(i)}
                  className={`pane-tab relative z-10 flex min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-2 font-display text-[12px] font-semibold tracking-[0.06em] uppercase transition-colors ${tab === i ? 'is-on' : ''}`}
                >
                  <TabIcon id={t.id} />
                  <span className="truncate">
                    {t.id === 'processing' ? (
                      <>
                        <span className="hidden @min-[640px]:inline">Currently processing</span>
                        <span className="@min-[640px]:hidden">Processing</span>
                      </>
                    ) : (
                      t.label
                    )}
                  </span>
                  <span className="pane-tab-count min-w-5 rounded-md px-1.5 py-px font-mono text-[10.5px] tracking-normal">{counts[i]}</span>
                </button>
              ))}
            </div>
            <span className="ml-auto hidden font-mono text-[10.5px] text-white/35 lg:inline">← → switch · Esc close</span>
            <button type="button" onClick={onClose} aria-label="Close work panel" className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white">
              ✕
            </button>
          </header>

          <div data-testid="work-board-scroller" onWheel={onSwipe} className="relative min-h-0 flex-1 overflow-hidden">
           <div className="work-track flex h-full w-[300%]" style={{ transform: `translate3d(${(-tab * 100) / 3}%, 0, 0)` }}>
            <section aria-label="Currently processing" inert={tab !== 0} className={`work-pane h-full w-1/3 shrink-0 px-5 pb-2 ${tab === 0 ? 'is-on' : ''}`}>
              <WorkList kind="processing" items={doing} now={now} onManage={onManage} />
            </section>
            <section aria-label="Queue" inert={tab !== 1} className={`work-pane h-full w-1/3 shrink-0 px-5 pb-2 ${tab === 1 ? 'is-on' : ''}`}>
              <WorkList kind="queue" items={queued} now={now} onManage={onManage} />
            </section>
            <section aria-label="To-do" inert={tab !== 2} className={`work-pane h-full w-1/3 shrink-0 px-5 pb-2 ${tab === 2 ? 'is-on' : ''}`}>
              <TodoWidget board onClose={onClose} initialFocus={req.focus ?? null} initialArchive={!!req.archive} focusInput={!!req.focusInput} key={req.nonce} />
            </section>
           </div>
          </div>

          <div data-pane-dots onWheel={(e) => flip(Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)} className="flex shrink-0 justify-center gap-1.5 pt-1 pb-3">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show ${t.label}`}
                className={`h-1.5 rounded-full transition-all ${tab === i ? 'w-5 bg-[var(--color-accent)]' : 'w-1.5 bg-white/25 hover:bg-white/45'}`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}

// ---- Currently processing / Queue lists ------------------------------------------

function WorkList({ kind, items, now, onManage }: { kind: 'processing' | 'queue'; items: ProcessingItem[]; now: Date; onManage: () => void }) {
  const t = now.getTime();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const due = (p: ProcessingItem) => (p.dueDate ? dueTimestamp({ dueDate: p.dueDate, dueTime: p.dueTime ?? null }) : null);
  const stats = [
    { label: 'with reminders', n: items.filter((p) => p.schedule.enabled).length },
    { label: 'timers running', n: items.filter((p) => !!p.timer).length },
    { label: 'due today', n: items.filter((p) => (due(p) ?? Infinity) < todayEnd && (due(p) ?? 0) >= t).length },
    { label: 'overdue', n: items.filter((p) => (due(p) ?? Infinity) < t).length, tone: 'bad' as const },
  ].filter((s) => s.n > 0);
  const sections = kind === 'queue' ? [...new Set(items.map((p) => p.section))] : [FIRST_SECTION];
  const title = kind === 'processing' ? 'Currently processing' : 'Queue';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.07] pb-3">
        <h2 className="font-display text-[13px] font-semibold tracking-[0.2em] text-white/70 uppercase">{title}</h2>
        <span className="rounded-full bg-white/10 px-1.5 font-mono text-[10.5px] text-white/60">{items.length}</span>
        {stats.map((s) => (
          <span key={s.label} className={`work-stat rounded-full px-2 py-0.5 font-mono text-[10.5px] ${s.tone === 'bad' ? 'is-bad' : ''}`}>
            {s.n} {s.label}
          </span>
        ))}
        <button type="button" onClick={onManage} className="work-manage ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold">
          <SlidersIcon className="size-4" />
          Manage sites &amp; reminders
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="work-empty-icon flex size-14 items-center justify-center rounded-2xl">
            <TabIcon id={kind} large />
          </span>
          <p className="text-[13px] font-semibold text-white/80">{kind === 'processing' ? 'Nothing in progress' : 'The queue is empty'}</p>
          <p className="max-w-xs text-[12px] text-white/45">{kind === 'processing' ? 'Add the sites you are working on right now, with reminders and timers.' : 'Line up what comes next, so it is one click away when you are ready.'}</p>
          <button type="button" onClick={onManage} className="accent-gradient rounded-xl px-4 py-1.5 text-[12px] font-semibold text-white">
            + Add sites
          </button>
        </div>
      ) : (
        <div className="ultra-thin-scrollbar -mr-2 min-h-0 flex-1 overflow-y-auto pt-3 pr-2">
          {sections.map((name) => {
            const list = items.filter((p) => p.section === name);
            return (
              <div key={name} className="mb-4 last:mb-0">
                {sections.length > 1 && (
                  <p className="mb-2 flex items-center gap-2 px-1 text-[10.5px] font-bold tracking-[0.16em] text-white/45 uppercase">
                    {name}
                    <span className="font-mono font-normal">{list.length}</span>
                  </p>
                )}
                <ul className="@container grid grid-cols-1 gap-2.5 min-[900px]:grid-cols-2">
                  {list.map((p) => (
                    <WorkCard key={p.id} item={p} kind={kind} now={now} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WorkCard({ item, kind, now }: { item: ProcessingItem; kind: 'processing' | 'queue'; now: Date }) {
  const recordVisit = useStore((s) => s.recordVisit);
  const updateProcessingItem = useStore((s) => s.updateProcessingItem);
  const deleteProcessingItem = useStore((s) => s.deleteProcessingItem);
  const reinsertProcessingItem = useStore((s) => s.reinsertProcessingItem);
  const [timerOpen, setTimerOpen] = useState(false);
  const timerRef = useRef<HTMLButtonElement>(null);
  const t = now.getTime();
  const next = nextFireTime(item.schedule, now);
  const due = item.dueDate ? dueTimestamp({ dueDate: item.dueDate, dueTime: item.dueTime ?? null }) : null;
  const late = due !== null && due < t;
  const start = item.createdAt ?? item.timer?.start ?? Date.now();
  const accent = kind === 'processing' ? '#10b981' : '#f59e0b';

  const open = () => {
    if (item.siteId) recordVisit(item.siteId);
    openInNewTab(item.url);
  };
  const remove = () => {
    deleteProcessingItem(item.id);
    showUndo(`Removed “${item.name}”`, () => reinsertProcessingItem(item));
  };
  const move = () => updateProcessingItem(item.id, { section: kind === 'processing' ? 'Queue' : FIRST_SECTION });

  return (
    <li data-board-item={item.id} className={`work-card group/wc relative flex flex-col gap-2.5 rounded-2xl border p-3.5 ${kind === 'queue' ? 'is-queue' : ''}`} style={{ '--k': accent } as CSSProperties}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="work-fav relative flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Favicon url={item.url} name={item.name} className="size-6" />
          {kind === 'processing' && <span className="work-live absolute -top-0.5 -right-0.5 size-2.5 animate-pulse rounded-full" aria-label="In progress" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-white/95">{item.name}</span>
          <span className="block truncate font-mono text-[11px] text-white/45">{getHostname(item.url)}</span>
        </span>
        {due !== null && (
          <span className={`work-chip shrink-0 ${late ? 'is-bad' : ''}`} title={new Date(due).toLocaleString()}>
            {late ? 'Overdue' : 'Due'} {fmtDue(due, now, !!item.dueTime)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {item.timer && <Countdown timer={item.timer} className="work-chip" onClick={() => setTimerOpen(true)} />}
        {item.schedule.enabled ? (
          <span className="work-chip" title={describeSchedule(item.schedule)}>
            <BellIcon />
            {next ? `Next in ${relativeAge(t, next.getTime()).replace('now', '<1m')}` : 'Reminders ended'}
            <span className="truncate text-white/45">· {describeSchedule(item.schedule)}</span>
          </span>
        ) : (
          <span className="work-chip is-dim">No reminders</span>
        )}
        {item.createdAt && <span className="work-chip is-dim">Added {relativeAge(item.createdAt, t)} ago</span>}
      </div>

      <div className="flex items-center gap-1.5">
        <button type="button" onClick={open} className="work-btn is-primary">
          Open ↗
        </button>
        <button ref={timerRef} type="button" onClick={() => setTimerOpen((o) => !o)} className="work-btn" aria-expanded={timerOpen}>
          {item.timer ? 'Timer' : 'Set timer'}
        </button>
        <button type="button" onClick={move} className="work-btn" title={kind === 'processing' ? 'Move to the Queue' : 'Move to Currently processing'}>
          {kind === 'processing' ? 'Move to Queue' : 'Start processing'}
        </button>
        <button type="button" onClick={remove} aria-label={`Remove ${item.name}`} title="Remove (undo available)" className="work-btn is-danger ml-auto">
          Remove
        </button>
      </div>

      {timerOpen && timerRef.current && (
        <AnchoredPopover anchor={timerRef.current} onClose={() => setTimerOpen(false)} label={`Timer for ${item.name}`} width={300}>
          <p className="mb-2 truncate text-[12px] font-semibold text-white">⏳ {item.name}</p>
          <TimerPanel
            value={item.timer ? { amount: item.timer.amount, unit: item.timer.unit } : null}
            start={start}
            onChange={(v) => updateProcessingItem(item.id, { timer: v ? { ...v, start } : null, createdAt: item.createdAt ?? start })}
          />
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => setTimerOpen(false)} className="accent-gradient rounded-lg px-3.5 py-1 text-[11px] font-semibold text-white">
              Done
            </button>
          </div>
        </AnchoredPopover>
      )}
    </li>
  );
}

function fmtDue(at: number, now: Date, hasTime: boolean): string {
  const d = new Date(at);
  const sameDay = d.toDateString() === now.toDateString();
  const time = hasTime ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
  if (sameDay) return hasTime ? time : 'today';
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return hasTime ? `${day} · ${time}` : day;
}

function TabIcon({ id, large = false }: { id: BoardTab; large?: boolean }): ReactNode {
  const cls = large ? 'size-7' : 'size-4 shrink-0';
  if (id === 'processing')
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  if (id === 'queue')
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.8-5" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

