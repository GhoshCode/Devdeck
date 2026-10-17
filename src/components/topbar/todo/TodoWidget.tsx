import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useStore } from '../../../store';
import { useNow } from '../../../hooks/useNow';
import { useIdleTimeout } from '../../../hooks/useIdleTimeout';
import { isOverdue, matchesView, sortActive, sortArchived, type TodoView } from '../../../lib/todos';
import { localDateKey } from '../../../lib/time';
import { parseQuickAdd } from '../../../lib/todoParse';
import type { Priority } from '../../../types';
import { PRIORITY_LABEL, TodoRow } from './TodoRow';
import { DateTimePicker, describeDue, type DueValue } from './DateTimePicker';

// TO DO widget (spec §3.4), one card that grows in place:
//   collapsed — smart quick-add + the first tasks; Red Danger Zone on top
//   expanded  — the card grows over the content below: views (All, Today,
//               Upcoming, Overdue) with counts, search, drag to reorder,
//               per-task details (notes, subtasks, priority, tags); shrinks
//               back after 30 s without interaction
//   archive   — completed tasks: restore, delete, purge
// Quick add understands "Ship notes #launch !p1 tomorrow 5pm" and previews
// what it understood; 📅 and 🚩 set the due moment and priority explicitly.

export const TODO_IDLE_MS = 30_000;
const EXPANDED_MAX = 540; // px cap when expanded; also capped to 75% of the viewport

type Mode = 'collapsed' | 'expanded' | 'archive';

const VIEWS: Array<{ id: TodoView; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
];

export const TodoWidget = memo(function TodoWidget() {
  const todos = useStore((s) => s.todos);
  const reorder = useStore((s) => s.reorder);
  // Re-evaluate overdue state every 15 s so items turn red on time.
  const now = useNow(15_000).getTime();
  const [mode, setMode] = useState<Mode>('collapsed');
  const [view, setView] = useState<TodoView>('all');
  const [query, setQuery] = useState('');
  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [slotHeight, setSlotHeight] = useState(224);

  const active = useMemo(() => sortActive(todos, now), [todos, now]);
  const archived = useMemo(() => sortArchived(todos), [todos]);
  const overdueCount = active.filter((t) => isOverdue(t, now)).length;
  const todayKey = localDateKey(new Date(now));
  const doneToday = archived.filter((t) => localDateKey(new Date(t.archivedAt!)) === todayKey).length;
  const open = mode !== 'collapsed';

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      active.filter(
        (t) =>
          (!open || matchesView(t, view, now)) &&
          (!q ||
            t.text.toLowerCase().includes(q) ||
            (t.tags ?? []).some((tag) => tag.includes(q.replace(/^#/, ''))) ||
            (t.notes ?? '').toLowerCase().includes(q)),
      ),
    [active, open, view, now, q],
  );

  // The collapsed card exactly fills its top-bar slot; expanding animates from that height.
  useLayoutEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const measure = () => setSlotHeight(el.clientHeight || 224);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const expandedHeight = Math.max(slotHeight, Math.min(EXPANDED_MAX, Math.round(window.innerHeight * 0.75)));

  useIdleTimeout(cardRef, open, TODO_IDLE_MS, () => setMode('collapsed'));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMode('collapsed');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const sortableIds = shown.filter((t) => !isOverdue(t, now)).map((t) => t.id);
  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over || dragged.id === over.id) return;
    const all = active.filter((t) => !isOverdue(t, now)).map((t) => t.id);
    const from = all.indexOf(String(dragged.id));
    const to = all.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    reorder('todo', arrayMove(all, from, to));
  };

  const expandAndFocus = () => {
    setMode('expanded');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const status =
    mode === 'archive'
      ? `${archived.length} archived`
      : open
        ? 'Auto-shrinks after 30 s idle'
        : active.length === 0
          ? 'Zero pending'
          : `${active.length} remaining${doneToday ? ` · ${doneToday} done today` : ''}`;

  return (
    <div ref={slotRef} data-testid="todo-widget" className="relative h-full">
      <motion.div
        ref={cardRef}
        role={open ? 'dialog' : 'region'}
        aria-label={mode === 'archive' ? 'Archived tasks' : open ? 'All tasks' : 'To-do'}
        initial={false}
        // Expanded: grow to fit the content, capped; collapsed: exactly the slot.
        animate={{ height: open ? 'auto' : slotHeight }}
        style={{ maxHeight: open ? expandedHeight : undefined, minHeight: open ? slotHeight : undefined }}
        transition={{ type: 'spring', stiffness: 360, damping: 38, mass: 0.9 }}
        className={`@container absolute top-0 right-0 left-0 flex flex-col overflow-hidden px-2.5 pt-2 pb-1 ${
          open
            ? 'glass-raised z-40 rounded-[var(--radius-card)] bg-[var(--color-base-elevated)]/95 shadow-2xl'
            : 'glass z-0'
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 px-1">
          <h2 className="font-display text-[11px] font-semibold tracking-[0.2em] whitespace-nowrap text-white/60">
            {mode === 'archive' ? 'ARCHIVE' : 'TO DO'}
          </h2>
          <span className="rounded-full bg-white/10 px-1.5 font-mono text-[10px] text-white/60">
            {mode === 'archive' ? archived.length : active.length}
          </span>
          {overdueCount > 0 && mode !== 'archive' && (
            <span
              className="rounded-md bg-red-500/30 px-1.5 font-mono text-[10px] font-bold whitespace-nowrap text-red-200"
              title={`${overdueCount} overdue`}
            >
              {overdueCount}
              <span className="hidden @min-[230px]:inline"> overdue</span>
            </span>
          )}
          {mode !== 'archive' && <ProgressRing done={doneToday} left={active.length} />}
          {mode !== 'archive' && (
            <button
              type="button"
              onClick={expandAndFocus}
              aria-label="Add a task"
              title="Add a task"
              className="flex size-5 items-center justify-center rounded-md text-sm leading-none text-white/45 hover:bg-white/10 hover:text-white"
            >
              +
            </button>
          )}
        </div>

        {mode === 'archive' ? (
          <ArchiveList />
        ) : (
          <>
            {/* Quick add — usable without expanding. */}
            <div className="mt-1 shrink-0">
              <Composer inputRef={inputRef} />
            </div>

            {open && (
              <div className="mt-1.5 flex shrink-0 items-center gap-2 px-0.5">
                <div role="tablist" aria-label="Task views" className="segmented flex rounded-md p-0.5">
                  {VIEWS.map((v) => {
                    const count = active.filter((t) => matchesView(t, v.id, now)).length;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="tab"
                        aria-selected={view === v.id}
                        onClick={() => setView(v.id)}
                        className={`rounded px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap ${
                          view === v.id ? 'segmented-on text-white' : 'text-white/55 hover:text-white/85'
                        } ${v.id === 'overdue' && count ? 'text-red-300' : ''}`}
                      >
                        {v.label} <span className="font-mono text-white/45">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tasks, #tags, notes"
                  aria-label="Search tasks"
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white placeholder-white/35 outline-none focus:border-white/25"
                />
              </div>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <ul className={`mt-1 min-h-0 flex-1 space-y-0.5 pr-1 ${open ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                  <AnimatePresence initial={false}>
                    {shown.map((t) => (
                      <TodoRow key={t.id} todo={t} now={now} expanded={open} />
                    ))}
                  </AnimatePresence>
                  {active.length === 0 && (
                    <li className="px-1.5 pt-1 text-xs text-white/40">🎯 All done — add the next one above.</li>
                  )}
                  {active.length > 0 && shown.length === 0 && (
                    <li className="px-1.5 pt-1 text-xs text-white/40">Nothing here{q ? ` for “${query}”` : ''}.</li>
                  )}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}

        {/* Footer: status, then archive left of expand. */}
        <div className="mt-0.5 flex h-6 shrink-0 items-center gap-1 border-t border-white/[0.06] pl-1">
          <span data-testid="todo-status" className="truncate font-mono text-[10px] text-white/45">
            {status}
          </span>
          <span className="ml-auto" />
          <IconButton
            label={mode === 'archive' ? 'Back to tasks' : `Archive (${archived.length})`}
            active={mode === 'archive'}
            onClick={() => setMode(mode === 'archive' ? 'expanded' : 'archive')}
          >
            <ArchiveIcon />
          </IconButton>
          <IconButton label={open ? 'Collapse' : 'Expand'} active={false} onClick={() => setMode(open ? 'collapsed' : 'expanded')}>
            <svg
              className={`size-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
        </div>
      </motion.div>
    </div>
  );
});

// Today's progress: completed today vs. still open.
function ProgressRing({ done, left }: { done: number; left: number }) {
  const total = done + left;
  const pct = total ? done / total : 0;
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <span className="ml-auto flex items-center gap-1 font-mono text-[9.5px] text-white/50" title={`${done} done today · ${left} open`}>
      <svg className="size-4 -rotate-90" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <span className="hidden @min-[260px]:inline">{done} today</span>
    </span>
  );
}

// Smart quick add: natural language is parsed live and previewed as chips;
// 📅 and 🚩 override the date and priority explicitly.
function Composer({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const addTodo = useStore((s) => s.addTodo);
  const [text, setText] = useState('');
  const [due, setDue] = useState<DueValue | null>(null); // explicit pick wins over parsed
  const [priority, setPriority] = useState<Priority | null>(null);
  const [picker, setPicker] = useState(false);
  const dateRef = useRef<HTMLButtonElement>(null);
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text) : null), [text]);

  const finalDue: DueValue = due ?? { dueDate: parsed?.dueDate ?? null, dueTime: parsed?.dueTime ?? null };
  const finalPriority: Priority = priority ?? parsed?.priority ?? 0;
  const tags = parsed?.tags ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    addTodo({ text: parsed.text, ...finalDue, priority: finalPriority, tags });
    setText('');
    setDue(null);
    setPriority(null);
  };
  const cyclePriority = () => setPriority((((finalPriority + 1) % 4) as Priority));
  const showChips = !!parsed && (finalDue.dueDate || finalPriority || tags.length > 0);

  return (
    <form onSubmit={submit} className="flex flex-col">
      <div className="todo-composer flex items-center gap-1.5 rounded-lg border px-2 py-0.5">
        <span className="text-xs text-white/35">+</span>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task… try “Ship notes #launch !p1 tomorrow 5pm”"
          aria-label="New task"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={cyclePriority}
          aria-label={`Priority: ${PRIORITY_LABEL[finalPriority]}`}
          title={`${PRIORITY_LABEL[finalPriority]} — click to change`}
          className={`prio-${finalPriority} text-xs ${finalPriority ? '' : 'text-white/35 hover:text-white/70'}`}
          style={finalPriority ? { color: 'var(--prio)' } : undefined}
        >
          ⚑
        </button>
        <button
          ref={dateRef}
          type="button"
          onClick={() => setPicker((o) => !o)}
          aria-label="Attach due date"
          aria-pressed={picker}
          title="Pick a due date and time"
          className={`text-xs ${picker || finalDue.dueDate ? 'text-[var(--color-accent)]' : 'text-white/35 hover:text-white/70'}`}
        >
          📅
        </button>
      </div>
      {showChips && (
        <div data-testid="todo-parse" className="mt-1 flex flex-wrap items-center gap-1 px-1 font-mono text-[10px]">
          {finalDue.dueDate && (
            <span className="rounded bg-[var(--color-accent)]/15 px-1.5 py-px text-[var(--color-accent)]">📅 {describeDue(finalDue)}</span>
          )}
          {finalPriority > 0 && (
            <span className={`prio-${finalPriority} rounded px-1.5 py-px`} style={{ color: 'var(--prio)', background: 'color-mix(in srgb, var(--prio) 15%, transparent)' }}>
              ⚑ {PRIORITY_LABEL[finalPriority]}
            </span>
          )}
          {tags.map((t) => (
            <span key={t} className="todo-tag rounded px-1.5 py-px">
              #{t}
            </span>
          ))}
          <span className="text-white/35">↵ to add</span>
        </div>
      )}
      {picker && dateRef.current && (
        <DateTimePicker anchor={dateRef.current} value={finalDue} onChange={setDue} onClose={() => setPicker(false)} />
      )}
    </form>
  );
}

function ArchiveList() {
  const todos = useStore((s) => s.todos);
  const restoreTodo = useStore((s) => s.restoreTodo);
  const deleteTodo = useStore((s) => s.deleteTodo);
  const purge = useStore((s) => s.purgeArchivedTodos);
  const archived = useMemo(() => sortArchived(todos), [todos]);

  return (
    <>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {archived.map((t) => (
          <li key={t.id} className="group/arch flex items-center gap-2 rounded-lg px-1.5 py-[3px] hover:bg-white/5">
            <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/30 text-[8px] text-emerald-200">
              ✓
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-white/45 line-through">{t.text}</span>
            <button type="button" onClick={() => restoreTodo(t.id)} aria-label={`Restore "${t.text}"`} className="text-xs text-white/40 hover:text-white">
              ↺
            </button>
            <button type="button" onClick={() => deleteTodo(t.id)} aria-label={`Delete "${t.text}"`} className="text-xs text-white/30 hover:text-red-300">
              ✕
            </button>
          </li>
        ))}
        {archived.length === 0 && <li className="px-1.5 py-2 text-xs text-white/30">No archived tasks.</li>}
      </ul>
      {archived.length > 0 && (
        <button type="button" onClick={purge} className="mt-1 shrink-0 self-start px-1 font-mono text-[10px] text-red-300/80 hover:text-red-300">
          purge all
        </button>
      )}
    </>
  );
}

function IconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-5 items-center justify-center rounded-md transition-colors ${
        active ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function ArchiveIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
      <rect x="1.8" y="2.5" width="12.4" height="3.2" rx="0.8" />
      <path d="M3 5.7v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-7M6.3 8.6h3.4" strokeLinecap="round" />
    </svg>
  );
}
