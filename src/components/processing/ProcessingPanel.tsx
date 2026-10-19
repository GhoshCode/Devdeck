import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import type { ProcessingItem } from '../../types';
import { useNow } from '../../hooks/useNow';
import { isExtension } from '../../lib/env';
import { describeSchedule, nextFireTime } from '../../lib/schedule';
import { relativeAge } from '../../services/search';
import { Favicon } from '../Favicon';
import { DEFAULT_SECTIONS, ProcessingEditor } from './ProcessingEditor';
import { TodoWidget } from '../topbar/todo/TodoWidget';
import { SplitPanes } from '../layout/SplitPanes';
import { Countdown } from '../ui/Countdown';
import { TimerPanel } from '../ui/TimerPanel';
import { AnchoredPopover } from '../ui/AnchoredPopover';
import { SlidersIcon } from '../ui/icons';

// D — Currently Processing (left column). Two stacked cards: the top card is
// the first section ("Currently processing" by default). The lower card scrolls sideways
// between the Queue (every other section, each collapsible; the mini settings
// cog in its corner opens the editor) and the To-do list.

export const ProcessingPanel = memo(function ProcessingPanel() {
  const processing = useStore((s) => s.processing);
  const [managerOpen, setManagerOpen] = useState(false);
  const now = useNow(60_000);

  const groups = useMemo(() => {
    const items = [...processing].sort((a, b) => a.order - b.order);
    const names = [...new Set([...DEFAULT_SECTIONS.slice(0, 1), ...items.map((i) => i.section)])];
    return names.map((name) => ({ name, items: items.filter((i) => i.section === name) }));
  }, [processing]);
  const [top, ...rest] = groups;

  return (
    <>
      <SplitPanes setting="leftSplit" label="Resize Currently processing and Queue" fitHint="fit Currently processing to its sites">
      <section aria-label={`Processing: ${top.name}`} className="glass relative flex h-full min-h-0 flex-col gap-2 p-3 pt-9">
        <PanelNotch title={top.name} count={top.items.length} />
        <ItemList items={top.items} now={now} empty={<EmptyState onAdd={() => setManagerOpen(true)} />} />
      </section>

      <QueueAndTodo queueTitle={rest.length === 1 ? rest[0].name : 'Queue'} queueCount={rest.reduce((n, g) => n + g.items.length, 0)}>
      <section aria-label="Processing: other sections" className="relative flex h-full min-h-0 flex-col gap-2">
        <div className="scrollbar-none min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
          {rest.length === 0 && <p className="px-1 text-[11px] text-white/35">Group more sites with sections in the editor.</p>}
          {rest.map((g) =>
            rest.length === 1 ? (
              <ItemList key={g.name} items={g.items} now={now} empty={<p className="px-1 text-[11px] text-white/35">Empty.</p>} />
            ) : (
              <CollapsibleSection key={g.name} name={g.name} items={g.items} now={now} />
            ),
          )}
        </div>
        <NotificationPrompt items={processing} />
        <div data-card-footer className="mt-auto flex h-10 shrink-0 items-center border-t border-white/[0.06] pl-1">
        <span className="font-mono text-[11px] text-white/45">{rest.reduce((n, g) => n + g.items.length, 0)} queued</span>
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          aria-label="Manage currently processing"
          title="Add/remove sites and set reminders"
          className="manage-btn group ml-auto flex size-8 items-center justify-center rounded-lg"
        >
          <SlidersIcon className="size-6" />
        </button>
        </div>
      </section>
      </QueueAndTodo>
      </SplitPanes>

      <AnimatePresence>{managerOpen && <ProcessingManager onClose={() => setManagerOpen(false)} />}</AnimatePresence>
    </>
  );
});

// The section name in a tab that hangs from the card's top edge, centred.
function PanelNotch({ title, count }: { title: string; count: number }) {
  return (
    <div className="panel-notch absolute top-0 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-b-xl border border-t-0 px-3.5 py-1">
      <h2 className="font-display text-[10.5px] font-semibold tracking-[0.12em] whitespace-nowrap text-white/80 uppercase">{title}</h2>
      <span className="rounded-full bg-white/10 px-1.5 font-mono text-[10px] text-white/55">{count}</span>
    </div>
  );
}

export function PanelHeader({ title, count }: { index?: number; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="truncate font-display text-[11px] font-semibold tracking-[0.18em] text-white/65 uppercase">{title}</h2>
      <span className="ml-auto font-mono text-[10px] text-white/35">{count}</span>
    </div>
  );
}

function ItemList({ items, now, empty }: { items: ProcessingItem[]; now: Date; empty: ReactNode }) {
  if (items.length === 0) return <>{empty}</>;
  return (
    <ul className="scrollbar-none min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} now={now} />
      ))}
    </ul>
  );
}

function ItemRow({ item, now }: { item: ProcessingItem; now: Date }) {
  const recordVisit = useStore((s) => s.recordVisit);
  const updateProcessingItem = useStore((s) => s.updateProcessingItem);
  const [timerOpen, setTimerOpen] = useState(false);
  const timerRef = useRef<HTMLButtonElement>(null);
  const next = nextFireTime(item.schedule, now);
  // A timer counts from when the site was added (older items without that date: from first use).
  const start = item.createdAt ?? item.timer?.start ?? Date.now();
  return (
    <li data-processing-item={item.id} className="group/proc relative flex items-center rounded-xl transition-colors hover:bg-white/[0.07]">
      <a
        href={item.url}
        onClick={() => item.siteId && recordVisit(item.siteId)}
        title={`${item.url}\n${describeSchedule(item.schedule)}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5"
      >
        <Favicon url={item.url} name={item.name} className="size-[18px] shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white/90">{item.name}</span>
          {/* The countdown leads the subtitle so the name keeps the full width. */}
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-white/45">
            {item.timer && <Countdown timer={item.timer} />}
            {next && !item.timer && (
              <span className="shrink-0 font-mono" title={next.toLocaleString()}>
                ⏰ in {relativeAge(now.getTime(), next.getTime()).replace('now', '<1m')}
              </span>
            )}
            <span className="truncate">
              {item.schedule.enabled ? `${next ? '· ' : ''}${describeSchedule(item.schedule)}` : 'No reminders'}
            </span>
          </span>
        </span>
      </a>
      <button
        ref={timerRef}
        type="button"
        onClick={() => setTimerOpen((o) => !o)}
        aria-label={item.timer ? `Change timer for ${item.name}` : `Set a timer for ${item.name}`}
        title={item.timer ? 'Change timer' : 'Set a countdown timer'}
        className={`mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-white/45 transition-opacity hover:bg-white/10 hover:text-white ${
          timerOpen ? 'opacity-100' : 'opacity-0 group-hover/proc:opacity-100 focus-visible:opacity-100'
        }`}
      >
        <svg viewBox="0 0 12 12" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <circle cx="6" cy="6.8" r="4.2" />
          <path d="M6 4.6v2.3l1.4 1M4.8 1.2h2.4" strokeLinecap="round" />
        </svg>
      </button>
      {timerOpen && timerRef.current && (
        <AnchoredPopover anchor={timerRef.current} onClose={() => setTimerOpen(false)} label={`Timer for ${item.name}`} width={300}>
          <p className="mb-2 truncate text-[12px] font-semibold text-white">⏳ {item.name}</p>
          <TimerPanel
            value={item.timer ? { amount: item.timer.amount, unit: item.timer.unit } : null}
            start={start}
            onChange={(t) => updateProcessingItem(item.id, { timer: t ? { ...t, start } : null, createdAt: item.createdAt ?? start })}
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

function CollapsibleSection({ name, items, now }: { name: string; items: ProcessingItem[]; now: Date }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-1 text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase hover:text-white/75"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
        {name}
        <span className="ml-auto font-mono font-normal">{items.length}</span>
      </button>
      {open && <ItemList items={items} now={now} empty={null} />}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <p className="text-[11px] text-white/40">What are you working on right now?</p>
      <button type="button" onClick={onAdd} className="rounded-lg bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/15">
        + Add a site
      </button>
    </div>
  );
}

// Web mode only: browser notifications need an explicit grant.
function NotificationPrompt({ items }: { items: ProcessingItem[] }) {
  const [permission, setPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  );
  const wantsReminders = items.some((i) => i.schedule.enabled);
  if (isExtension() || permission !== 'default' || !wantsReminders) return null;
  return (
    <button
      type="button"
      onClick={() => void Notification.requestPermission().then(setPermission)}
      className="absolute bottom-2 left-3 text-[10px] font-semibold text-[var(--color-accent)] hover:underline"
    >
      Enable reminder notifications
    </button>
  );
}

function ProcessingManager({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
      <motion.div
        role="dialog"
        aria-label="Manage currently processing"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="glass-raised fixed top-4 bottom-4 left-4 z-50 flex w-[min(400px,calc(100vw-2rem))] flex-col rounded-[var(--radius-card)] bg-[var(--color-base-elevated)]/95"
      >
        <header className="flex items-center gap-3 border-b border-white/[0.07] px-5 pt-4 pb-3">
          <div className="flex-1">
            <h2 className="font-display text-sm font-semibold tracking-[0.18em] text-white">CURRENTLY PROCESSING</h2>
            <p className="text-[11px] text-white/40">Sites you're actively working on, with reminders.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white">
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ProcessingEditor />
        </div>
      </motion.div>
    </>
  );
}

// The lower card: Queue and To-do side by side, one visible at a time. Tabs
// jump between them; a trackpad swipe or the hair-thin scrollbar (shown only
// while scrolling) moves too. The last pane is remembered.
const PANE_KEY = 'devdeck.leftPane';

function QueueAndTodo({ queueTitle, queueCount, children }: { queueTitle: string; queueCount: number; children: ReactNode }) {
  const todoCount = useStore((s) => s.todos.filter((t) => t.archivedAt === null).length);
  const ref = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState<0 | 1>(() => {
    try {
      return localStorage.getItem(PANE_KEY) === 'todo' ? 1 : 0;
    } catch {
      return 0;
    }
  });
  const [scrolling, setScrolling] = useState(false);
  const paneRef = useRef(pane);
  paneRef.current = pane;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = pane * el.clientWidth; // restore without animating
    // When the card changes width (window or column resize) the old scroll
    // offset no longer lines up with a pane: keep the chosen pane in view
    // instead of letting the stale offset flip it.
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      el.scrollLeft = paneRef.current * width;
    });
    ro.observe(el);
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      if (el.clientWidth !== width) return; // a resize clamped the offset; the observer restores it
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 900);
      const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)) as 0 | 1;
      setPane(next);
      try {
        localStorage.setItem(PANE_KEY, next ? 'todo' : 'queue');
      } catch {
        // storage unavailable — the pane just isn't remembered
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once on mount
  }, []);

  const go = (i: 0 | 1) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' });

  // An alert's Open / Review: show the to-do pane and flash the task.
  useEffect(() => {
    const onShow = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      ref.current?.scrollTo({ left: ref.current.clientWidth, behavior: 'smooth' });
      if (!id) return;
      setTimeout(() => {
        const row = document.querySelector<HTMLElement>(`[data-todo-id="${CSS.escape(id)}"]`);
        if (!row) return;
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        row.classList.remove('todo-flash');
        void row.offsetWidth;
        row.classList.add('todo-flash');
        setTimeout(() => row.classList.remove('todo-flash'), 1600);
      }, 450);
    };
    window.addEventListener('devdeck:show-todo', onShow);
    return () => window.removeEventListener('devdeck:show-todo', onShow);
  }, []);
  const tabs = [
    { label: queueTitle, count: queueCount },
    { label: 'To-do', count: todoCount },
  ];

  return (
    <section
      aria-label="Queue and to-do"
      onWheel={(e) => {
        // Scrolling over the bottom band (below the divider) flips between Queue and To-do.
        if (!(e.target as Element).closest('[data-card-footer], [data-pane-dots]')) return;
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(d) > 4) go(d > 0 ? 1 : 0);
      }}
      className="glass relative flex h-full min-h-0 flex-col gap-2 p-3 pb-5"
    >
      {/* Segmented switch: a glowing pill slides under the active pane's tab.
          Clicking a tab, or scrolling over the switch, changes the pane. */}
      <div
        role="tablist"
        aria-label="Queue or to-do"
        onWheel={(e) => {
          const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          if (Math.abs(d) > 4) go(d > 0 ? 1 : 0);
        }}
        className="pane-switch @container relative grid shrink-0 grid-cols-2 rounded-2xl border p-1"
      >
        <span
          aria-hidden
          className="pane-switch-pill absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: pane ? 'translateX(100%)' : undefined }}
        />
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={pane === i}
            onClick={() => go(i as 0 | 1)}
            className={`pane-tab relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1.5 py-1.5 font-display text-[11px] font-semibold tracking-[0.06em] uppercase @min-[300px]:gap-2 @min-[300px]:px-2 @min-[300px]:text-[11.5px] @min-[300px]:tracking-[0.12em] transition-colors ${
              pane === i ? 'is-on' : ''
            }`}
          >
            {/* icons only when there is room, so the labels never get cut */}
            <span className="hidden @min-[300px]:inline-flex">{i === 0 ? <WaveIcon /> : <CheckCircleIcon />}</span>
            <span className="truncate">{t.label}</span>
            <span className="pane-tab-count min-w-5 rounded-md px-1.5 py-px font-mono text-[10px] tracking-normal">{t.count}</span>
          </button>
        ))}
      </div>
      <div
        ref={ref}
        data-testid="queue-todo-scroller"
        className={`scrollbar-none flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden ${scrolling ? 'is-scrolling' : ''}`}
      >
        <div className="h-full w-full shrink-0 snap-start pr-1">{children}</div>
        <div className="h-full w-full shrink-0 snap-start pl-1">
          <TodoWidget />
        </div>
      </div>
      <span aria-hidden data-pane-dots className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
        {[0, 1].map((i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${pane === i ? 'w-4 bg-[var(--color-accent)]' : 'w-1.5 bg-white/25'}`} />
        ))}
      </span>
    </section>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.8-5" />
    </svg>
  );
}
