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

// D — Currently Processing (left column). Two stacked cards: the top card is
// the first section ("Focus" by default). The lower card scrolls sideways
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
      <section aria-label={`Processing: ${top.name}`} className="glass flex min-h-0 flex-1 flex-col gap-2 p-3">
        <PanelHeader index={1} title={top.name} count={top.items.length} />
        <ItemList items={top.items} now={now} empty={<EmptyState onAdd={() => setManagerOpen(true)} />} />
      </section>

      <QueueAndTodo queueTitle={rest.length === 1 ? rest[0].name : 'Queue'} queueCount={rest.reduce((n, g) => n + g.items.length, 0)}>
      <section aria-label="Processing: other sections" className="relative flex h-full min-h-0 flex-col gap-2 pb-9">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
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
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          aria-label="Manage currently processing"
          title="Add/remove sites and set reminders"
          className="group absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"
        >
          <svg className="size-4 transition-transform duration-500 group-hover:rotate-90" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </section>
      </QueueAndTodo>

      <AnimatePresence>{managerOpen && <ProcessingManager onClose={() => setManagerOpen(false)} />}</AnimatePresence>
    </>
  );
});

function PanelHeader({ index, title, count }: { index: number; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white/55">D{index}</span>
      <h2 className="truncate font-display text-[11px] font-semibold tracking-[0.18em] text-white/65 uppercase">{title}</h2>
      <span className="ml-auto font-mono text-[10px] text-white/35">{count}</span>
    </div>
  );
}

function ItemList({ items, now, empty }: { items: ProcessingItem[]; now: Date; empty: ReactNode }) {
  if (items.length === 0) return <>{empty}</>;
  return (
    <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} now={now} />
      ))}
    </ul>
  );
}

function ItemRow({ item, now }: { item: ProcessingItem; now: Date }) {
  const recordVisit = useStore((s) => s.recordVisit);
  const next = nextFireTime(item.schedule, now);
  return (
    <li data-processing-item={item.id}>
      <a
        href={item.url}
        onClick={() => item.siteId && recordVisit(item.siteId)}
        title={`${item.url}\n${describeSchedule(item.schedule)}`}
        className="group/proc flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.07]"
      >
        <Favicon url={item.url} name={item.name} className="size-[18px] shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white/90">{item.name}</span>
          {/* The countdown leads the subtitle so the name keeps the full width. */}
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-white/45">
            {next && (
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = pane * el.clientWidth; // restore without animating
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
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
      el.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once on mount
  }, []);

  const go = (i: 0 | 1) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' });
  const tabs = [
    { label: queueTitle, count: queueCount },
    { label: 'To-do', count: todoCount },
  ];

  return (
    <section aria-label="Queue and to-do" className="glass relative flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white/55">D2</span>
        <div role="tablist" aria-label="Queue or to-do" className="segmented flex min-w-0 rounded-md p-0.5">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={pane === i}
              onClick={() => go(i as 0 | 1)}
              className={`truncate rounded px-2 py-0.5 font-display text-[10.5px] font-semibold tracking-[0.12em] uppercase ${
                pane === i ? 'segmented-on text-white' : 'text-white/55 hover:text-white/85'
              }`}
            >
              {t.label} <span className="font-mono tracking-normal text-white/45">{t.count}</span>
            </button>
          ))}
        </div>
        <span aria-hidden className="ml-auto flex gap-1">
          {[0, 1].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${pane === i ? 'w-3.5 bg-[var(--color-accent)]' : 'w-1.5 bg-white/25'}`} />
          ))}
        </span>
      </div>
      <div
        ref={ref}
        data-testid="queue-todo-scroller"
        className={`thin-autohide-scroll flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden ${scrolling ? 'is-scrolling' : ''}`}
      >
        <div className="h-full w-full shrink-0 snap-start pr-1">{children}</div>
        <div className="h-full w-full shrink-0 snap-start pl-1">
          <TodoWidget />
        </div>
      </div>
    </section>
  );
}
