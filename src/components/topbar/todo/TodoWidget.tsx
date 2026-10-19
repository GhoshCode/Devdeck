import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { AnimatePresence } from 'motion/react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useStore } from '../../../store';
import { useNow } from '../../../hooks/useNow';
import { openBoard } from '../../../lib/workBoard';
import { isOverdue, matchesView, sortActive, sortArchived, type TodoView, matchesFocus, needsAction, type TodoFocus } from '../../../lib/todos';
import { localDateKey } from '../../../lib/time';
import { parseQuickAdd } from '../../../lib/todoParse';
import { REPEAT_LABEL } from '../../../lib/todos';
import { describeTimer } from '../../../lib/timer';
import { showUndo } from '../../ui/UndoToast';
import type { TimerChoice } from '../../ui/TimerPanel';
import type { Priority } from '../../../types';
import { PRIORITY_LABEL, TodoRow } from './TodoRow';
import { DateTimePicker, describeDue, type DueValue } from './DateTimePicker';

// TO DO widget (spec §3.4), in two places:
//   inline — the left column's lower card: smart quick-add + the task list
//   board  — the To-do tab of the big work panel (WorkBoard): views (All,
//            Today, Upcoming, Overdue) with counts, search, drag to reorder,
//            per-task details (notes, subtasks, priority, tags), and the
//            archive (restore, delete, purge)
// Quick add understands "Ship notes #launch !p1 tomorrow 5pm" and previews
// what it understood; ⚑ and 📅 set the priority and due moment explicitly.

export const TODO_IDLE_MS = 30_000;

type Mode = 'collapsed' | 'expanded' | 'archive';

const VIEWS: Array<{ id: TodoView; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
];

const ROW_PAGE = 40;
const ANIMATE_UP_TO = 60; // above this, rows skip the layout animation

interface TodoWidgetProps {
  board?: boolean; // render as the work panel's To-do tab
  onClose?: () => void; // board: close the panel
  initialFocus?: TodoFocus | null; // board: e.g. overdue first (alert Review)
  initialArchive?: boolean; // board: open on the archive
  focusInput?: boolean; // board: cursor in quick add
}

export const TodoWidget = memo(function TodoWidget({ board = false, onClose, initialFocus = null, initialArchive = false, focusInput = false }: TodoWidgetProps) {
  const todos = useStore((s) => s.todos);
  const reorder = useStore((s) => s.reorder);
  // Re-evaluate overdue state every 15 s so items turn red on time.
  const now = useNow(15_000).getTime();
  const [mode, setMode] = useState<Mode>(board ? (initialArchive ? 'archive' : 'expanded') : 'collapsed');
  const [view, setView] = useState<TodoView>('all');
  const [query, setQuery] = useState('');
  // Long lists render in pages: every row is a drag target with a layout
  // animation, so 200+ rows made each add take ~300 ms. "Show more" adds a page.
  const [limit, setLimit] = useState(ROW_PAGE);
  // Footer chip toggled on: its tasks go to the top of the list.
  const [focus, setFocus] = useState<TodoFocus | null>(initialFocus);
  // The overdue alert's "Review" floats overdue tasks to the top.
  useEffect(() => {
    const onShow = (e: Event) => {
      if ((e as CustomEvent<{ focus?: TodoFocus }>).detail?.focus === 'overdue') setFocus('overdue');
    };
    window.addEventListener('devdeck:show-todo', onShow);
    return () => window.removeEventListener('devdeck:show-todo', onShow);
  }, []);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  const active = useMemo(() => sortActive(todos, now), [todos, now]);
  const archived = useMemo(() => sortArchived(todos), [todos]);
  const overdueCount = active.filter((t) => isOverdue(t, now)).length;
  const priorityCount = active.filter((t) => !!t.priority).length;
  const actionCount = active.filter((t) => needsAction(t, now)).length;
  const focused = useMemo(
    () => (focus ? [...active.filter((t) => matchesFocus(t, focus, now)), ...active.filter((t) => !matchesFocus(t, focus, now))] : active),
    [active, focus, now],
  );
  const todayKey = localDateKey(new Date(now));
  const doneToday = archived.filter((t) => localDateKey(new Date(t.archivedAt!)) === todayKey).length;

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      active.filter(
        (t) =>
          matchesView(t, view, now) &&
          (!q ||
            t.text.toLowerCase().includes(q) ||
            (t.tags ?? []).some((tag) => tag.includes(q.replace(/^#/, ''))) ||
            (t.notes ?? '').toLowerCase().includes(q)),
      ),
    [active, view, now, q],
  );

  useEffect(() => {
    if (board && focusInput) requestAnimationFrame(() => modalInputRef.current?.focus());
  }, [board, focusInput]);
  const close = () => (board ? onClose?.() : setMode('collapsed'));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over || dragged.id === over.id) return;
    const all = active.filter((t) => !isOverdue(t, now)).map((t) => t.id);
    const from = all.indexOf(String(dragged.id));
    const to = all.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    reorder('todo', arrayMove(all, from, to));
  };

  const expandAndFocus = () => openBoard({ tab: 'todo', focusInput: true });

  // The list, shared by the inline card and the big box.
  const list = (expanded: boolean, all: typeof active) => {
    const items = all.slice(0, limit);
    const hidden = all.length - items.length;
    const sortableIds = items.filter((t) => !isOverdue(t, now)).map((t) => t.id);
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <ul className={`mt-1.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1 ${expanded ? 'ultra-thin-scrollbar' : 'scrollbar-none'}`}>
            <AnimatePresence initial={false}>
              {items.map((t) => (
                <TodoRow key={t.id} todo={t} now={now} expanded={expanded} animate={items.length <= ANIMATE_UP_TO} />
              ))}
            </AnimatePresence>
            {hidden > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => setLimit((n) => n + ROW_PAGE)}
                  className="w-full rounded-md px-1.5 py-1 text-left font-mono text-[10.5px] text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                >
                  Show {Math.min(ROW_PAGE, hidden)} more · {hidden} hidden
                </button>
              </li>
            )}
            {active.length === 0 && <li className="px-1.5 pt-1 text-xs text-white/40">All done — add the next one above.</li>}
            {active.length > 0 && items.length === 0 && (
              <li className="px-1.5 pt-1 text-xs text-white/40">Nothing here{q ? ` for “${query}”` : ''}.</li>
            )}
          </ul>
        </SortableContext>
      </DndContext>
    );
  };

  const header = (inBox: boolean) => (
    <div className="flex shrink-0 items-center gap-2 px-1">
      {/* Inline, the card's tab already names the list and its count. */}
      {inBox && (
        <>
          <h2 className="font-display text-[13px] font-semibold tracking-[0.2em] whitespace-nowrap text-white/65">
            {mode === 'archive' ? 'ARCHIVE' : 'TO DO'}
          </h2>
          <span className="rounded-full bg-white/10 px-1.5 font-mono text-[10px] text-white/60">
            {mode === 'archive' ? archived.length : active.length}
          </span>
        </>
      )}
      {overdueCount > 0 && !(mode === 'archive' && inBox) && (
        <span className="rounded-md bg-red-500/30 px-1.5 font-mono text-[10px] font-bold whitespace-nowrap text-red-200" title={`${overdueCount} overdue`}>
          {overdueCount}
          <span className="hidden @min-[230px]:inline"> overdue</span>
        </span>
      )}
      <ProgressRing done={doneToday} left={active.length} />
      {!inBox ? (
        <button
          type="button"
          onClick={expandAndFocus}
          aria-label="Add a task"
          title="Add a task"
          className="flex size-5 items-center justify-center rounded-md text-sm leading-none text-white/45 hover:bg-white/10 hover:text-white"
        >
          +
        </button>
      ) : null}
    </div>
  );

  const footer = (inBox: boolean) => (
    <div data-card-footer className="todo-footer mt-auto flex h-9 shrink-0 items-center gap-1.5 border-t border-white/[0.06] pl-1">
      {inBox || active.length === 0 ? (
        <span data-testid={inBox ? 'todo-status-box' : 'todo-status'} className="truncate font-mono text-[11px] text-white/50">
          {inBox ? (mode === 'archive' ? `${archived.length} archived` : `${active.length} open · ${doneToday} done today`) : 'Zero pending'}
        </span>
      ) : (
        <div data-testid="todo-status" role="group" aria-label="Task summary" className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
          <StatChip label={`${active.length} to-do`} short={String(active.length)} on={focus === null} onClick={() => setFocus(null)} title={doneToday ? `${doneToday} done today` : 'All tasks in their usual order'} />
          {overdueCount > 0 && (
            <StatChip tone="danger" label={`${overdueCount} overdue`} short={`${overdueCount} late`} on={focus === 'overdue'} onClick={() => setFocus(focus === 'overdue' ? null : 'overdue')} title="Show overdue tasks first" />
          )}
          {priorityCount > 0 && (
            <StatChip tone="prio" label={`${priorityCount} priority`} short={`${priorityCount} prio`} on={focus === 'priority'} onClick={() => setFocus(focus === 'priority' ? null : 'priority')} title="Show prioritised tasks first" />
          )}
          {/* narrow card: "need action" (overdue / urgent ones, already counted above) waits for room */}
          <span className="hidden @min-[300px]/todo:contents">
            {actionCount > 0 && (
              <StatChip tone="warn" label={`${actionCount} need action`} short={`${actionCount} act`} on={focus === 'action'} onClick={() => setFocus(focus === 'action' ? null : 'action')} title="Overdue, due within the hour, or urgent and due today — shown first" />
            )}
          </span>
        </div>
      )}
      <span className="ml-auto" />
      <IconButton
        label={mode === 'archive' && inBox ? 'Back to tasks' : `Archive (${archived.length})`}
        active={mode === 'archive' && inBox}
        onClick={() => (inBox ? setMode(mode === 'archive' ? 'expanded' : 'archive') : openBoard({ tab: 'todo', archive: true }))}
      >
        <ArchiveIcon />
      </IconButton>
      <IconButton label={inBox ? 'Collapse' : 'Expand'} active={false} onClick={() => (inBox ? close() : openBoard({ tab: 'todo' }))}>
        <svg className="size-[15px]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          {inBox ? (
            <path d="M4.5 1.5v3h-3M7.5 10.5v-3h3M1.5 4.5 4.5 1.5M10.5 7.5l-3 3" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M7.5 1.5h3v3M4.5 10.5h-3v-3M10.5 1.5 7 5M1.5 10.5 5 7" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </IconButton>
    </div>
  );

  if (board) {
    const shown = focus ? [...filtered.filter((t) => matchesFocus(t, focus, now)), ...filtered.filter((t) => !matchesFocus(t, focus, now))] : filtered;
    return (
      <div data-testid="todo-board" role="region" aria-label={mode === 'archive' ? 'Archived tasks' : 'All tasks'} className="todo-box @container flex h-full min-h-0 flex-col">
        {header(true)}
        {mode === 'archive' ? (
          <ArchiveList />
        ) : (
          <>
            <div className="mt-3 shrink-0">
              <Composer inputRef={modalInputRef} />
            </div>
            <div className="mt-2.5 flex shrink-0 items-center gap-2 px-0.5">
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
                      className={`rounded px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
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
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] text-white placeholder-white/35 outline-none focus:border-white/25"
              />
            </div>
            {list(true, shown)}
          </>
        )}
        {footer(true)}
      </div>
    );
  }

  return (
    <div data-testid="todo-widget" className="@container relative flex h-full min-h-0 flex-col">
      <div role="region" aria-label="To-do" className="@container/todo flex h-full min-h-0 flex-col">
        {header(false)}
        <div className="mt-1.5 shrink-0">
          <Composer inputRef={inlineInputRef} />
        </div>
        {list(false, focused)}
        {footer(false)}
      </div>
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
  const [timer, setTimer] = useState<TimerChoice>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text) : null), [text]);

  const finalDue: DueValue = due ?? { dueDate: parsed?.dueDate ?? null, dueTime: parsed?.dueTime ?? null };
  const finalPriority: Priority = priority ?? parsed?.priority ?? 0;
  const tags = parsed?.tags ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return;
    addTodo({ text: parsed.text, ...finalDue, priority: finalPriority, tags, repeat: parsed.repeat, timer });
    setText('');
    setDue(null);
    setPriority(null);
    setTimer(null);
  };
  const cyclePriority = () => setPriority((((finalPriority + 1) % 4) as Priority));
  const showChips = !!parsed && (finalDue.dueDate || finalPriority || tags.length > 0 || timer);

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
          className={`text-xs ${picker || finalDue.dueDate || timer ? 'text-[var(--color-accent)]' : 'text-white/35 hover:text-white/70'}`}
        >
          📅
        </button>
      </div>
      {showChips && (
        <div data-testid="todo-parse" className="mt-1 flex flex-wrap items-center gap-1 px-1 font-mono text-[10px]">
          {finalDue.dueDate && (
            <span className="rounded bg-[var(--color-accent)]/15 px-1.5 py-px text-[var(--color-accent)]">📅 {describeDue(finalDue)}</span>
          )}
          {timer && (
            <span className="countdown countdown-run rounded px-1.5 py-px">⏳ {describeTimer(timer)}</span>
          )}
          {parsed?.repeat && finalDue.dueDate && (
            <span className="rounded bg-[var(--color-accent)]/15 px-1.5 py-px text-[var(--color-accent)]">↻ {REPEAT_LABEL[parsed.repeat]}</span>
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
        <DateTimePicker
          anchor={dateRef.current}
          value={finalDue}
          onChange={setDue}
          onClose={() => setPicker(false)}
          timer={timer}
          timerStart={Date.now()}
          onTimer={setTimer}
        />
      )}
    </form>
  );
}

function ArchiveList() {
  const todos = useStore((s) => s.todos);
  const restoreTodo = useStore((s) => s.restoreTodo);
  const deleteTodo = useStore((s) => s.deleteTodo);
  const reinsertTodo = useStore((s) => s.reinsertTodo);
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
            <button type="button" onClick={() => { deleteTodo(t.id); showUndo(`Deleted “${t.text}”`, () => reinsertTodo(t)); }} aria-label={`Delete "${t.text}"`} className="text-xs text-white/30 hover:text-red-300">
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
      className={`flex size-7 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function ArchiveIcon() {
  return (
    <svg className="size-[17px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
      <rect x="1.8" y="2.5" width="12.4" height="3.2" rx="0.8" />
      <path d="M3 5.7v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-7M6.3 8.6h3.4" strokeLinecap="round" />
    </svg>
  );
}

// Footer summary chip; a pressed chip glows and floats its tasks to the top.
// In a narrow card the chips use short labels so they stay on one line.
function StatChip({ label, short, on, onClick, title, tone = 'plain' }: { label: string; short?: string; on: boolean; onClick: () => void; title: string; tone?: 'plain' | 'danger' | 'prio' | 'warn' }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onClick} title={title} className={`stat-chip stat-${tone} shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] whitespace-nowrap transition-all ${on ? 'is-on' : ''}`}>
      {short ? (
        <>
          <span className="@min-[330px]/todo:hidden">{short}</span>
          <span className="hidden @min-[330px]/todo:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}
