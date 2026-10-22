import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../../store';
import { FIRST_SECTION, type EventCategory, type EventPriority, type Priority } from '../../types';
import { CATEGORY_COLOR, EVENT_CATEGORIES, EVENT_PRIORITIES, REMINDER_LEADS, dayKey, fmtRange, fmtTime, minutesOf, type CalItem } from '../../lib/calendar';
import { describeSchedule } from '../../lib/schedule';
import { openInNewTab } from '../../lib/openTab';
import { normalizeUrl } from '../../utils';
import { Select } from '../ui/Select';
import { showUndo } from '../ui/UndoToast';
import { KIND_LABEL, badgeOf, itemColor } from './meta';

export type NewKind = 'event' | 'todo' | 'queue' | 'processing';
export type DuePick = { kind: 'todo' | 'proc'; id: string };

export type ComposerState =
  | { mode: 'create'; kind: NewKind; date: string; start: string; end: string; existing?: boolean; pick?: DuePick }
  | { mode: 'edit'; eventId: string }
  | { mode: 'task'; item: CalItem };

interface Props {
  state: ComposerState;
  h24: boolean;
  onClose: () => void;
  onChange: (next: ComposerState) => void;
  onSaved: (key: string, date: string) => void; // flash the saved card
  onLeave: () => void; // closes the calendar (opening the to-do list)
}

const KINDS: ReadonlyArray<{ id: NewKind; label: string; hint: string; color: string }> = [
  { id: 'event', label: 'Calendar event', hint: 'Capsule alert', color: 'var(--color-accent)' },
  { id: 'todo', label: 'To-do', hint: 'Checklist alert', color: '#38bdf8' },
  { id: 'queue', label: 'Queue', hint: 'Up-next alert', color: '#f59e0b' },
  { id: 'processing', label: 'Processing', hint: 'Spotlight alert', color: '#10b981' },
];

export function CalendarComposer({ state, h24, onClose, onChange, onSaved, onLeave }: Props) {
  const title = state.mode === 'edit' ? 'Edit calendar event' : state.mode === 'task' ? 'Item details' : 'Schedule';
  const sub =
    state.mode === 'create'
      ? 'Calendar events get the capsule alert; to-do, Queue and Processing keep their own alerts.'
      : state.mode === 'edit'
        ? 'Changes apply to the event and its alert.'
        : 'From your DevDeck lists.';
  const kindLabel = state.mode === 'create' ? KINDS.find((k) => k.id === state.kind)!.label.toLowerCase() : '';
  return (
    <Modal label={title} onClose={onClose}>
      <header className="cc-line mb-4 flex items-start justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <h3 className="cc-fg text-[13px] font-bold tracking-[0.12em] uppercase">{title}</h3>
          <p className="cc-fg3 mt-0.5 text-[11.5px]">{sub}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="cc-iconbtn flex size-8 shrink-0 items-center justify-center rounded-lg">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      {state.mode === 'task' ? (
        <TaskDetail item={state.item} h24={h24} onClose={onClose} onLeave={onLeave} onReschedule={(pick, kind, date, time) => onChange({ mode: 'create', kind, date, start: time, end: time, existing: true, pick })} />
      ) : state.mode === 'edit' ? (
        <EventForm eventId={state.eventId} onClose={onClose} onSaved={onSaved} />
      ) : (
        <>
          <div role="radiogroup" aria-label="What to schedule" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={state.kind === k.id}
                onClick={() => onChange({ ...state, kind: k.id, pick: undefined })}
                style={{ '--k': k.color } as CSSProperties}
                className={`cc-typecard rounded-xl border p-2.5 text-left ${state.kind === k.id ? 'is-on' : ''}`}
              >
                <span className="flex items-center gap-1.5 text-[12px] font-bold">
                  <span className="size-2 rounded-full bg-[var(--k)]" />
                  {k.label}
                </span>
                <span className="cc-fg3 mt-0.5 block text-[10.5px]">{k.hint}</span>
              </button>
            ))}
          </div>
          {state.kind === 'event' ? (
            <EventForm draft={{ date: state.date, start: state.start, end: state.end }} onClose={onClose} onSaved={onSaved} />
          ) : (
            <>
              <div role="tablist" aria-label="New or existing" className="cc-seg mb-3 grid grid-cols-2 gap-1 rounded-xl p-1">
                {[false, true].map((ex) => (
                  <button
                    key={String(ex)}
                    type="button"
                    role="tab"
                    aria-selected={!!state.existing === ex}
                    onClick={() => onChange({ ...state, existing: ex })}
                    className={`cc-seg-btn rounded-lg px-2 py-1.5 text-[12px] font-semibold ${!!state.existing === ex ? 'is-on' : ''}`}
                  >
                    {ex ? 'Schedule an existing item' : `New ${kindLabel}`}
                  </button>
                ))}
              </div>
              {state.existing ? (
                <AssignDueForm key={state.kind} kind={state.kind} date={state.date} time={state.start} pick={state.pick} onClose={onClose} onSaved={onSaved} />
              ) : (
                <NewTaskForm key={state.kind} kind={state.kind} date={state.date} time={state.start} onClose={onClose} onSaved={onSaved} />
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}

// ---- modal ---------------------------------------------------------------------

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.dropdown-menu[role="listbox"]')) return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <>
      <motion.div key="cc-modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[112] bg-black/60 backdrop-blur-sm" />
      <div className="pointer-events-none fixed inset-0 z-[115] flex items-center justify-center p-4">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          data-testid="cal-composer"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 4 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="cc-pop cc-scroll pointer-events-auto max-h-[calc(calc(100vh/var(--ui-zoom,1))-32px)] w-full max-w-[560px] overflow-y-auto rounded-2xl border p-5"
        >
          {children}
        </motion.div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="cc-eyebrow">{label}</span>
      {children}
    </label>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="cc-line mt-2 flex items-center gap-2 border-t pt-3">{children}</div>;
}

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="cc-error rounded-lg px-2.5 py-1.5 text-[12px] font-medium">
      {text}
    </p>
  );
}

const parseList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const remindValue = (m: number | null) => (m === null ? 'none' : String(m));

// ---- calendar event --------------------------------------------------------------

function EventForm({ eventId, draft, onClose, onSaved }: { eventId?: string; draft?: { date: string; start: string; end: string }; onClose: () => void; onSaved: Props['onSaved'] }) {
  const existing = useStore((s) => (eventId ? s.events.find((e) => e.id === eventId) : undefined));
  const addEvent = useStore((s) => s.addEvent);
  const updateEvent = useStore((s) => s.updateEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const reinsertEvent = useStore((s) => s.reinsertEvent);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? draft?.date ?? dayKey(new Date()));
  const [start, setStart] = useState(existing?.start ?? draft?.start ?? '09:00');
  const [end, setEnd] = useState(existing?.end ?? draft?.end ?? '10:00');
  const [category, setCategory] = useState<EventCategory>(existing?.category ?? 'meeting');
  const [priority, setPriority] = useState<EventPriority>(existing?.priority ?? 'normal');
  const [remind, setRemind] = useState(remindValue(existing ? existing.remindMins : 10));
  const [people, setPeople] = useState(existing?.attendees.join(', ') ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Give the event a title.');
    if (!date || !start || !end) return setError('Pick a date, start and end.');
    if (minutesOf(end) <= minutesOf(start)) return setError('The end must be after the start (same day).');
    const data = { title: title.trim(), date, start, end, category, priority, remindMins: remind === 'none' ? null : Number(remind), attendees: parseList(people), location: location.trim(), notes: notes.trim() };
    if (existing) {
      updateEvent(existing.id, data);
      onSaved(`event:${existing.id}`, date);
    } else {
      const ev = addEvent(data);
      onSaved(`event:${ev.id}`, date);
    }
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    deleteEvent(existing.id);
    showUndo(`Deleted “${existing.title}”`, () => reinsertEvent(existing));
    onClose();
  };

  if (eventId && !existing) return <p className="cc-fg2 text-sm">This event no longer exists.</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label={existing ? 'Edit calendar event' : 'New calendar event'}>
      <Field label="Title / objective">
        <input
          autoFocus
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder="Board call, architecture sync, flight to SFO…"
          aria-label="Event title"
          className="cc-input text-[14px] font-semibold"
        />
      </Field>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="cc-input tabular-nums" required />
        </Field>
        <Field label="Start">
          <input type="time" value={start} step={900} onChange={(e) => setStart(e.target.value)} aria-label="Start time" className="cc-input tabular-nums" required />
        </Field>
        <Field label="End">
          <input type="time" value={end} step={900} onChange={(e) => setEnd(e.target.value)} aria-label="End time" className="cc-input tabular-nums" required />
        </Field>
      </div>
      <Field label="Category">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
          {EVENT_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={category === c.id}
              onClick={() => setCategory(c.id)}
              style={{ '--cat': CATEGORY_COLOR[c.id] } as CSSProperties}
              className={`cc-cat flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold ${category === c.id ? 'is-on' : ''}`}
            >
              <span className="size-2 rounded-full bg-[var(--cat)]" />
              {c.label}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Priority">
          <Select<EventPriority> size="sm" ariaLabel="Priority" value={priority} onChange={setPriority} options={EVENT_PRIORITIES.map((p) => ({ value: p.id, label: p.label }))} />
        </Field>
        <Field label="Alert">
          <Select size="sm" ariaLabel="Reminder lead time" value={remind} onChange={setRemind} options={REMINDER_LEADS.map((r) => ({ value: remindValue(r.mins), label: r.label }))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Attendees / tags">
          <input value={people} onChange={(e) => setPeople(e.target.value)} placeholder="Sarah Chen, Board, #q4" aria-label="Attendees or tags, comma separated" className="cc-input" />
        </Field>
        <Field label="Location / link">
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room Alpha · meet.google.com/…" aria-label="Location" className="cc-input" />
        </Field>
      </div>
      <Field label="Context / notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Agenda, prep, dial-in…" aria-label="Notes" className="cc-input cc-scroll resize-none" />
      </Field>
      <ErrorLine text={error} />
      <Actions>
        {existing && (
          <button type="button" onClick={remove} className="cc-btn is-danger">
            Delete
          </button>
        )}
        <span className="cc-fg3 ml-auto hidden font-mono text-[10.5px] sm:inline">↵ save · Esc cancel</span>
        <button type="button" onClick={onClose} className="cc-btn">
          Cancel
        </button>
        <button type="submit" className="cc-btn is-primary">
          {existing ? 'Save changes' : 'Save to calendar'}
        </button>
      </Actions>
    </form>
  );
}

// ---- new to-do / Queue / Processing item -------------------------------------------

function NewTaskForm({ kind, date: initDate, time: initTime, onClose, onSaved }: { kind: Exclude<NewKind, 'event'>; date: string; time: string; onClose: () => void; onSaved: Props['onSaved'] }) {
  const addTodo = useStore((s) => s.addTodo);
  const updateTodo = useStore((s) => s.updateTodo);
  const addProcessingItem = useStore((s) => s.addProcessingItem);
  const updateProcessingItem = useStore((s) => s.updateProcessingItem);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [date, setDate] = useState(initDate);
  const [time, setTime] = useState(initTime);
  const [allDay, setAllDay] = useState(false);
  const [priority, setPriority] = useState<'0' | '1' | '2' | '3'>('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isTodo = kind === 'todo';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError(isTodo ? 'What needs doing?' : 'Give the item a name.');
    if (!date) return setError('Pick a due date.');
    const dueTime = allDay || !time ? null : time;
    if (isTodo) {
      const t = addTodo({ text: title.trim(), dueDate: date, dueTime, priority: Number(priority) as Priority });
      if (notes.trim()) updateTodo(t.id, { notes: notes.trim() });
      onSaved(`todo:${t.id}`, date);
    } else {
      const link = normalizeUrl(url);
      if (!link) return setError('Add the site or link to work on.');
      const p = addProcessingItem({ name: title.trim(), url: link, section: kind === 'processing' ? FIRST_SECTION : 'Queue' });
      updateProcessingItem(p.id, { dueDate: date, dueTime });
      onSaved(`${kind}:${p.id}`, date);
    }
    onClose();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label={`New ${KIND_LABEL[kind]} item`}>
      <Field label={isTodo ? 'To-do' : 'Name'}>
        <input
          autoFocus
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder={isTodo ? 'Approve Q4 compute allocation…' : kind === 'processing' ? 'Vector index rebuild…' : 'Triage open pull requests…'}
          aria-label={isTodo ? 'To-do text' : 'Item name'}
          className="cc-input text-[14px] font-semibold"
        />
      </Field>
      {!isTodo && (
        <Field label="Site / link">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="github.com/org/repo/pulls" aria-label="Site or link" className="cc-input" />
        </Field>
      )}
      <div className="grid grid-cols-[1.4fr_1fr_auto] items-end gap-2">
        <Field label="Due date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Due date" className="cc-input tabular-nums" required />
        </Field>
        <Field label="Time">
          <input type="time" value={time} step={900} disabled={allDay} onChange={(e) => setTime(e.target.value)} aria-label="Due time" className="cc-input tabular-nums disabled:opacity-40" />
        </Field>
        <label className="cc-fg2 flex h-[34px] items-center gap-1.5 text-[12px] font-medium">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[var(--cc-primary)]" />
          All day
        </label>
      </div>
      {isTodo && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Priority">
            <Select
              size="sm"
              ariaLabel="Priority"
              value={priority}
              onChange={setPriority}
              options={[
                { value: '0', label: 'None' },
                { value: '1', label: 'P1 · Urgent' },
                { value: '2', label: 'P2 · High' },
                { value: '3', label: 'P3 · Normal' },
              ]}
            />
          </Field>
          <Field label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" aria-label="Notes" className="cc-input" />
          </Field>
        </div>
      )}
      <ErrorLine text={error} />
      <Actions>
        <span className="cc-fg3 hidden text-[11px] sm:inline">Saved to your {isTodo ? 'To-do list' : kind === 'processing' ? 'Currently processing list' : 'Queue'}.</span>
        <button type="button" onClick={onClose} className="cc-btn ml-auto">
          Cancel
        </button>
        <button type="submit" className="cc-btn is-primary">
          Save to calendar
        </button>
      </Actions>
    </form>
  );
}

// ---- due dates for existing items ------------------------------------------------

function AssignDueForm({ kind, date: initDate, time: initTime, pick: initPick, onClose, onSaved }: { kind: Exclude<NewKind, 'event'>; date: string; time: string; pick?: DuePick; onClose: () => void; onSaved: Props['onSaved'] }) {
  const todos = useStore((s) => s.todos);
  const processing = useStore((s) => s.processing);
  const updateTodo = useStore((s) => s.updateTodo);
  const updateProcessingItem = useStore((s) => s.updateProcessingItem);
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<DuePick | null>(initPick ?? null);
  const [date, setDate] = useState(initDate);
  const [time, setTime] = useState(initTime);
  const [allDay, setAllDay] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    const due = (d?: string | null, t?: string | null) => (d ? `${d}${t ? ` ${t}` : ''}` : 'No due date');
    if (kind === 'todo') return todos.filter((t) => t.archivedAt === null && match(t.text)).map((t) => ({ id: t.id, name: t.text, due: due(t.dueDate, t.dueTime) }));
    return processing.filter((p) => (kind === 'processing' ? p.section === FIRST_SECTION : p.section !== FIRST_SECTION) && match(p.name)).map((p) => ({ id: p.id, name: p.name, due: due(p.dueDate, p.dueTime) }));
  }, [todos, processing, query, kind]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!pick || !date) return;
    const dueTime = allDay || !time ? null : time;
    if (pick.kind === 'todo') updateTodo(pick.id, { dueDate: date, dueTime });
    else updateProcessingItem(pick.id, { dueDate: date, dueTime });
    onSaved(`${kind}:${pick.id}`, date);
    onClose();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3" aria-label="Set a due date">
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find a ${KIND_LABEL[kind].toLowerCase()} item…`} aria-label="Find an item" className="cc-input" />
      <div className="cc-list cc-scroll max-h-[220px] overflow-y-auto rounded-xl border" role="listbox" aria-label="Items">
        {rows.length === 0 && <p className="cc-fg3 px-3 py-5 text-center text-[12px]">Nothing here yet. Switch to “New” to add one.</p>}
        {rows.map((r) => {
          const on = pick?.id === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => setPick({ kind: kind === 'todo' ? 'todo' : 'proc', id: r.id })}
              className={`cc-row flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] ${on ? 'is-on' : ''}`}
            >
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="cc-fg3 shrink-0 font-mono text-[10.5px] tabular-nums">{r.due}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[1.4fr_1fr_auto] items-end gap-2">
        <Field label="Due date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Due date" className="cc-input tabular-nums" required />
        </Field>
        <Field label="Time">
          <input type="time" value={time} step={900} disabled={allDay} onChange={(e) => setTime(e.target.value)} aria-label="Due time" className="cc-input tabular-nums disabled:opacity-40" />
        </Field>
        <label className="cc-fg2 flex h-[34px] items-center gap-1.5 text-[12px] font-medium">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[var(--cc-primary)]" />
          All day
        </label>
      </div>
      <Actions>
        <button type="button" onClick={onClose} className="cc-btn ml-auto">
          Cancel
        </button>
        <button type="submit" disabled={!pick} className="cc-btn is-primary disabled:opacity-40">
          Set due date
        </button>
      </Actions>
    </form>
  );
}

// ---- to-do / Queue / Processing details ----------------------------------------------

function TaskDetail({ item, h24, onClose, onLeave, onReschedule }: { item: CalItem; h24: boolean; onClose: () => void; onLeave: () => void; onReschedule: (pick: DuePick, kind: Exclude<NewKind, 'event'>, date: string, time: string) => void }) {
  const completeTodo = useStore((s) => s.completeTodo);
  const updateTodo = useStore((s) => s.updateTodo);
  const updateProcessingItem = useStore((s) => s.updateProcessingItem);
  const proc = useStore((s) => (item.kind === 'todo' ? undefined : s.processing.find((p) => p.id === item.sourceId)));
  const slot = `${new Date(item.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${item.allDay ? 'All day' : item.reminder ? fmtTime(item.start, h24) : fmtRange(item.start, item.end, h24)}`;
  const pick: DuePick = { kind: item.kind === 'todo' ? 'todo' : 'proc', id: item.sourceId };

  const clearDue = () => {
    if (item.kind === 'todo') updateTodo(item.sourceId, { dueDate: null, dueTime: null });
    else updateProcessingItem(item.sourceId, { dueDate: null, dueTime: null });
    onClose();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="cc-kind rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider" style={{ '--k': itemColor(item) } as CSSProperties}>
          {badgeOf(item)}
        </span>
        <p className="cc-fg mt-2 text-[16px] leading-snug font-bold">{item.title}</p>
      </div>
      <div className="cc-panel grid grid-cols-2 gap-3 rounded-xl border p-3 text-[12px]">
        <div>
          <span className="cc-fg3 block text-[11px]">{item.reminder ? 'Reminder' : 'Due'}</span>
          <span className="cc-fg font-mono font-semibold tabular-nums">{slot}</span>
        </div>
        <div>
          <span className="cc-fg3 block text-[11px]">{item.kind === 'todo' ? 'Priority' : 'List'}</span>
          <span className="cc-fg font-semibold">{item.kind === 'todo' ? (item.todoPriority ? `P${item.todoPriority}` : 'None') : (proc?.section ?? KIND_LABEL[item.kind])}</span>
        </div>
      </div>
      {item.reminder && proc && <p className="cc-fg2 text-[12px]">Repeats: {describeSchedule(proc.schedule)}</p>}
      {item.notes && <p className="cc-panel cc-fg2 rounded-xl border p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap">{item.notes}</p>}
      <Actions>
        {!item.reminder && (
          <button type="button" className="cc-btn is-danger" onClick={clearDue}>
            Clear due date
          </button>
        )}
        <span className="ml-auto" />
        {!item.reminder && (
          <button type="button" className="cc-btn" onClick={() => onReschedule(pick, item.kind as Exclude<NewKind, 'event'>, dayKey(item.start), item.allDay ? '09:00' : fmtTime(item.start, true))}>
            Reschedule
          </button>
        )}
        {item.kind === 'todo' ? (
          <>
            <button
              type="button"
              className="cc-btn"
              onClick={() => {
                onLeave();
                setTimeout(() => window.dispatchEvent(new CustomEvent('devdeck:show-todo', { detail: { id: item.sourceId } })), 250);
              }}
            >
              Open in To-do
            </button>
            <button
              type="button"
              className="cc-btn is-primary"
              onClick={() => {
                completeTodo(item.sourceId);
                onClose();
              }}
            >
              Mark done
            </button>
          </>
        ) : (
          item.url && (
            <button type="button" className="cc-btn is-primary" onClick={() => openInNewTab(item.url!)}>
              Open site ↗
            </button>
          )
        )}
      </Actions>
    </div>
  );
}
