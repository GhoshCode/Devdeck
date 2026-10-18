import { memo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Priority, Todo } from '../../../types';
import { useStore } from '../../../store';
import { REPEAT_LABEL, formatDue, isDueToday, isOverdue } from '../../../lib/todos';
import { Countdown } from '../../ui/Countdown';
import { DateTimePicker } from './DateTimePicker';

interface TodoRowProps {
  todo: Todo;
  now: number;
  expanded: boolean; // drag, detail panel, delete only when the card is expanded
  animate?: boolean; // layout animation (off for very long lists)
}

export const PRIORITY_LABEL: Record<Priority, string> = { 0: 'No priority', 1: 'P1 · Urgent', 2: 'P2 · High', 3: 'P3 · Normal' };

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// One active to-do. The leading ring (coloured by priority) completes and
// archives it (spec §3.4). Overdue rows sit in the Red Danger Zone and are not
// draggable — how overdue they are decides their position. In the expanded
// card, clicking a row opens its details: notes, subtasks, priority and tags.
export const TodoRow = memo(function TodoRow({ todo, now, expanded, animate = true }: TodoRowProps) {
  const completeTodo = useStore((s) => s.completeTodo);
  const updateTodo = useStore((s) => s.updateTodo);
  const deleteTodo = useStore((s) => s.deleteTodo);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const [details, setDetails] = useState(false);
  const [picker, setPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'due' | 'timer'>('due');
  const dueRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);

  const overdue = isOverdue(todo, now);
  const today = isDueToday(todo, now);
  const due = formatDue(todo, now);
  const priority = todo.priority ?? 0;
  const tags = todo.tags ?? [];
  const subtasks = todo.subtasks ?? [];
  const doneSubs = subtasks.filter((s) => s.done).length;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
    disabled: !expanded || overdue || editing || details,
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  const commitText = () => {
    const text = draft.trim();
    if (text && text !== todo.text) updateTodo(todo.id, { text });
    else setDraft(todo.text);
    setEditing(false);
  };

  return (
    <motion.li
      layout={animate ? 'position' : false}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 48, transition: { duration: 0.22 } }}
      data-todo-id={todo.id}
      data-overdue={overdue || undefined}
      className={`group/todo rounded-lg ${overdue ? 'todo-danger' : ''} ${details ? 'todo-open' : ''} ${isDragging ? 'opacity-60' : ''} prio-${priority}`}
    >
      <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-1.5 py-[3px]">
        <button
          type="button"
          onClick={() => completeTodo(todo.id)}
          aria-label={`Complete "${todo.text}"`}
          title={`${todo.repeat && todo.dueDate ? `Mark done — moves to its next ${REPEAT_LABEL[todo.repeat].toLowerCase()} date` : 'Mark complete (archives it)'}${priority ? ` · ${PRIORITY_LABEL[priority]}` : ''}`}
          className={`todo-bullet flex size-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
            overdue
              ? 'border-red-400 hover:bg-red-400/40'
              : priority
                ? 'border-[var(--prio)] hover:bg-[color-mix(in_srgb,var(--prio)_35%,transparent)]'
                : 'border-white/40 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/30'
          }`}
        />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText();
              if (e.key === 'Escape') {
                setDraft(todo.text);
                setEditing(false);
              }
            }}
            aria-label="Edit task"
            className="min-w-0 flex-1 rounded bg-white/10 px-1 text-[13px] text-white outline-none"
          />
        ) : (
          <span
            {...(expanded ? { ...attributes, ...listeners } : {})}
            role={expanded ? 'button' : undefined}
            tabIndex={expanded ? 0 : undefined}
            onClick={() => expanded && setDetails((d) => !d)}
            onDoubleClick={() => expanded && setEditing(true)}
            onKeyDown={(e) => expanded && e.key === 'Enter' && setDetails((d) => !d)}
            aria-expanded={expanded ? details : undefined}
            title={expanded ? 'Click for details · double-click to rename · drag to reorder' : todo.text}
            className={`flex min-w-0 flex-1 items-center gap-1.5 ${expanded && !overdue ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            <span className={`min-w-0 truncate text-[13px] ${overdue ? 'font-medium text-red-100' : 'text-white/85'}`}>{todo.text}</span>
            {todo.repeat && todo.dueDate && (
              <span data-testid="todo-repeat" title={`Repeats ${REPEAT_LABEL[todo.repeat].toLowerCase()}`} className="shrink-0 font-mono text-[10px] text-[var(--color-accent)]">
                ↻
              </span>
            )}
            {tags.slice(0, 2).map((t) => (
              <span key={t} className="todo-tag shrink-0 rounded px-1 font-mono text-[9.5px]">
                #{t}
              </span>
            ))}
            {tags.length > 2 && <span className="shrink-0 font-mono text-[9.5px] text-white/40">+{tags.length - 2}</span>}
            {subtasks.length > 0 && (
              <span className="shrink-0 font-mono text-[9.5px] text-white/50" title={`${doneSubs} of ${subtasks.length} subtasks done`}>
                ☑ {doneSubs}/{subtasks.length}
              </span>
            )}
            {todo.notes && (
              <span aria-label="Has notes" className="shrink-0 text-[10px] text-white/40" title={todo.notes}>
                ✎
              </span>
            )}
          </span>
        )}
        {priority > 0 && !overdue && (
          <span aria-hidden className="shrink-0 font-mono text-[9.5px] font-bold" style={{ color: 'var(--prio)' }}>
            P{priority}
          </span>
        )}
        {todo.timer && (
          <span ref={timerRef} className="flex shrink-0">
            <Countdown
              timer={todo.timer}
              onClick={() => {
                setPickerTab('timer');
                setPicker(true);
              }}
            />
          </span>
        )}
        {/* Compact list: a timer takes the due chip's place (the picker still has both). */}
        <button
          ref={dueRef}
          type="button"
          hidden={!!todo.timer && !expanded}
          onClick={() => {
            setPickerTab('due');
            setPicker((o) => !o);
          }}
          aria-label={due ? `Due ${due} — change` : 'Add due date'}
          className={`shrink-0 rounded-md px-1.5 py-px font-mono text-[10px] tabular-nums transition-colors ${
            overdue
              ? 'bg-red-500/30 font-bold text-red-200'
              : today
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                : due
                  ? 'bg-white/10 text-white/60'
                  : 'text-white/30 opacity-0 group-hover/todo:opacity-100 hover:text-white/70'
          }`}
        >
          {due ?? '+ due'}
        </button>
        {expanded && (
          <button
            type="button"
            onClick={() => deleteTodo(todo.id)}
            aria-label={`Delete "${todo.text}"`}
            className="shrink-0 text-xs text-white/30 opacity-0 group-hover/todo:opacity-100 hover:text-red-300"
          >
            ✕
          </button>
        )}
      </div>

      {picker && (timerRef.current ?? dueRef.current) && (
        <DateTimePicker
          anchor={(todo.timer && !expanded ? timerRef.current : dueRef.current) ?? dueRef.current!}
          value={{ dueDate: todo.dueDate, dueTime: todo.dueTime }}
          onChange={(v) => updateTodo(todo.id, v)}
          onClose={() => setPicker(false)}
          timer={todo.timer ? { amount: todo.timer.amount, unit: todo.timer.unit } : null}
          timerStart={todo.timer?.start ?? Date.now()}
          onTimer={(t) => updateTodo(todo.id, { timer: t ? { ...t, start: todo.timer?.start ?? Date.now() } : null })}
          initialTab={pickerTab}
        />
      )}

      <AnimatePresence initial={false}>
        {expanded && details && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <TodoDetails todo={todo} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
});

function TodoDetails({ todo }: { todo: Todo }) {
  const updateTodo = useStore((s) => s.updateTodo);
  const [sub, setSub] = useState('');
  const [tag, setTag] = useState('');
  const subtasks = todo.subtasks ?? [];
  const tags = todo.tags ?? [];
  const priority = todo.priority ?? 0;

  const addSub = () => {
    const text = sub.trim();
    if (!text) return;
    updateTodo(todo.id, { subtasks: [...subtasks, { id: newId(), text, done: false }] });
    setSub('');
  };
  const addTag = () => {
    const t = tag.trim().replace(/^#/, '').toLowerCase();
    if (t && !tags.includes(t)) updateTodo(todo.id, { tags: [...tags, t] });
    setTag('');
  };

  return (
    <div className="todo-details mx-1.5 mb-1.5 space-y-2 rounded-lg border p-2.5 pl-7">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] font-semibold tracking-wider text-white/50 uppercase">Priority</span>
        <div role="radiogroup" aria-label="Priority" className="segmented flex rounded-md p-0.5">
          {([0, 1, 2, 3] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={priority === p}
              onClick={() => updateTodo(todo.id, { priority: p })}
              title={PRIORITY_LABEL[p]}
              className={`prio-${p} rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                priority === p ? 'segmented-on text-white' : 'text-white/55 hover:text-white/85'
              }`}
            >
              {p === 0 ? '—' : <span style={{ color: 'var(--prio)' }}>P{p}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <span className="w-14 shrink-0 pt-0.5 text-[10px] font-semibold tracking-wider text-white/50 uppercase">Tags</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {tags.map((t) => (
            <span key={t} className="todo-tag flex items-center gap-1 rounded px-1.5 py-px font-mono text-[10px]">
              #{t}
              <button
                type="button"
                onClick={() => updateTodo(todo.id, { tags: tags.filter((x) => x !== t) })}
                aria-label={`Remove tag ${t}`}
                className="opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTag())}
            onBlur={addTag}
            placeholder="+ tag"
            aria-label="Add a tag"
            className="w-16 bg-transparent font-mono text-[10.5px] text-white/80 outline-none placeholder:text-white/35"
          />
        </div>
      </div>

      <div className="flex items-start gap-2">
        <span className="w-14 shrink-0 pt-0.5 text-[10px] font-semibold tracking-wider text-white/50 uppercase">Subtasks</span>
        <div className="min-w-0 flex-1 space-y-0.5">
          {subtasks.map((s) => (
            <label key={s.id} className="group/sub flex items-center gap-1.5 text-[12px]">
              <input
                type="checkbox"
                checked={s.done}
                onChange={() =>
                  updateTodo(todo.id, { subtasks: subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })
                }
                className="accent-[var(--color-accent)]"
              />
              <span className={`min-w-0 flex-1 truncate ${s.done ? 'text-white/40 line-through' : 'text-white/80'}`}>{s.text}</span>
              <button
                type="button"
                onClick={() => updateTodo(todo.id, { subtasks: subtasks.filter((x) => x.id !== s.id) })}
                aria-label={`Remove subtask ${s.text}`}
                className="text-[10px] text-white/30 opacity-0 group-hover/sub:opacity-100 hover:text-red-300"
              >
                ✕
              </button>
            </label>
          ))}
          <input
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSub()}
            placeholder="+ Add a subtask"
            aria-label="Add a subtask"
            className="w-full bg-transparent text-[12px] text-white/80 outline-none placeholder:text-white/35"
          />
        </div>
      </div>

      <div className="flex items-start gap-2">
        <span className="w-14 shrink-0 pt-0.5 text-[10px] font-semibold tracking-wider text-white/50 uppercase">Notes</span>
        <textarea
          value={todo.notes ?? ''}
          onChange={(e) => updateTodo(todo.id, { notes: e.target.value })}
          rows={2}
          placeholder="Links, context, acceptance criteria…"
          aria-label="Notes"
          className="min-w-0 flex-1 resize-y rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/85 outline-none placeholder:text-white/30 focus:border-white/25"
        />
      </div>
    </div>
  );
}
