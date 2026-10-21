import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import { useNow } from '../../hooks/useNow';
import type { CalendarPrefs, CalendarView } from '../../types';
import {
  DAY,
  addDays,
  autoResolve,
  briefing,
  collectItems,
  dayKey,
  findConflicts,
  fmtRange,
  focusShieldSlot,
  hhmmOf,
  isMeeting,
  overdueTodos,
  parseDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toHHMM,
  type CalItem,
  type CalKind,
} from '../../lib/calendar';
import { zoneCity } from '../../lib/zones';
import { Select } from '../ui/Select';
import { showUndo } from '../ui/UndoToast';
import { AgendaView } from './AgendaView';
import { AlertStack } from './AlertStack';
import { CalendarComposer, type ComposerState, type NewKind } from './CalendarComposer';
import { BoltIcon } from './ItemBlock';
import { SECOND_ZONES, zoneAbbr } from './meta';
import { MonthView } from './MonthView';
import { TimeGrid } from './TimeGrid';

// Command Calendar: a full-screen workspace that puts custom events
// (meetings, calls, focus blocks, travel…) and every dated to-do / Queue /
// Currently processing item on one timeline. Day (split stream), Week (time
// blocking), Month (capacity heatmap) and Agenda (briefing stream), with a
// KPI strip, conflict radar + auto-resolve, Focus Shield and the alert stack.
// Keyboard: D / W / M / A views · ← / → move · T today · N new · F Focus
// Shield · / filter · B alert stack · Esc close.

const DEFAULT_PREFS: CalendarPrefs = { view: 'day', showSecondZone: false, secondZone: 'UTC' };
const VIEWS: ReadonlyArray<{ id: CalendarView; label: string; key: string }> = [
  { id: 'day', label: 'Day split-stream', key: 'D' },
  { id: 'week', label: 'Week matrix', key: 'W' },
  { id: 'month', label: 'Month heatmap', key: 'M' },
  { id: 'agenda', label: 'Agenda stream', key: 'A' },
];
const AGENDA_DAYS = 14;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Filter = 'all' | CalKind | 'tasks';
const LEGEND: ReadonlyArray<{ id: Filter; label: string; color: string; dashed?: boolean }> = [
  { id: 'all', label: 'All items', color: '#cbd5e1' },
  { id: 'event', label: 'Calendar events', color: 'var(--color-accent)' },
  { id: 'processing', label: 'Currently processing', color: '#10b981' },
  { id: 'todo', label: 'To-do due', color: '#38bdf8' },
  { id: 'queue', label: 'Queue', color: '#f59e0b', dashed: true },
];
const passes = (f: Filter, i: CalItem) => f === 'all' || (f === 'tasks' ? i.kind === 'todo' || i.kind === 'queue' : i.kind === f);

type Target = { date?: string; eventId?: string };

// ---- launcher: the rounded bar above Currently processing -----------------------

export const CalendarButton = memo(function CalendarButton() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const events = useStore((s) => s.events);
  const todos = useStore((s) => s.todos);
  const processing = useStore((s) => s.processing);
  const h24 = useStore((s) => s.settings.clock24h);
  const now = useNow(30_000).getTime();
  const d0 = startOfDay(now).getTime();
  const today = useMemo(() => collectItems({ events, todos, processing }, d0, d0 + DAY), [events, todos, processing, d0]);
  const meetingsLeft = today.filter((i) => isMeeting(i) && i.end > now).length;
  const clashes = findConflicts(today).count;
  const nextUp = today.find((i) => !i.allDay && i.end > now && (i.kind === 'event' || !i.reminder));

  // "Jump to slot" on a calendar alert — here, or from another website (#cal=).
  useEffect(() => {
    const onOpen = (e: Event) => {
      setTarget(((e as CustomEvent<Target>).detail ?? {}) as Target);
      setOpen(true);
    };
    window.addEventListener('devdeck:open-calendar', onOpen);
    const m = /#cal=([\d-]*):?([\w-]*)/.exec(location.hash);
    if (m) {
      setTarget({ date: m[1] || undefined, eventId: m[2] || undefined });
      setOpen(true);
      history.replaceState(null, '', location.pathname + location.search);
    }
    return () => window.removeEventListener('devdeck:open-calendar', onOpen);
  }, []);

  const summary = nextUp ? `${nextUp.start > now ? 'Next' : 'Now'} · ${fmtRange(nextUp.start, nextUp.end, h24).split('–')[0]} ${nextUp.title}` : meetingsLeft ? `${meetingsLeft} meeting${meetingsLeft === 1 ? '' : 's'} left today` : 'Nothing else today';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTarget(null);
          setOpen(true);
        }}
        aria-label={`Command Calendar${meetingsLeft ? `, ${meetingsLeft} meeting${meetingsLeft === 1 ? '' : 's'} left today` : ''}${clashes ? ', conflicts today' : ''}`}
        title="Command Calendar"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="calendar-button"
        className="cal-launch @container glass-raised group relative flex h-[58px] min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 text-left"
      >
        <span className="cal-launch-icon flex size-9 shrink-0 items-center justify-center rounded-xl">
          <CalendarIcon className="size-5" day={new Date(now).getDate()} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-display text-[11px] font-semibold tracking-[0.14em] text-white/85 uppercase">Calendar</span>
            {clashes > 0 && (
              <span className="cal-launch-clash flex items-center gap-0.5 rounded-full px-1.5 font-mono text-[9.5px] font-bold" title="Conflicts today">
                <BoltIcon className="size-2.5" />
                {clashes}
              </span>
            )}
          </span>
          <span className="block truncate text-[11.5px] text-white/55 tabular-nums">{summary}</span>
        </span>
        {meetingsLeft > 0 && (
          <span className="cal-badge hidden h-5 min-w-5 shrink-0 @[230px]:flex items-center justify-center rounded-full px-1.5 font-mono text-[10.5px] font-bold text-white tabular-nums" title="Meetings left today">
            {meetingsLeft}
          </span>
        )}
        <svg viewBox="0 0 24 24" className="hidden size-4 shrink-0 text-white/35 transition-transform @[270px]:block group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {createPortal(<AnimatePresence>{open && <CommandCalendar target={target} onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
});

function rangeOf(view: CalendarView, cursor: Date, now: number): [number, number] {
  if (view === 'day') return [startOfDay(cursor).getTime(), addDays(startOfDay(cursor), 1).getTime()];
  if (view === 'week') {
    const a = startOfWeek(cursor);
    return [a.getTime(), addDays(a, 7).getTime()];
  }
  if (view === 'month') {
    const a = startOfWeek(startOfMonth(cursor));
    return [a.getTime(), addDays(a, 42).getTime()];
  }
  const a = startOfDay(now);
  return [a.getTime(), addDays(a, AGENDA_DAYS + 1).getTime()];
}

function titleOf(view: CalendarView, cursor: Date): string {
  if (view === 'day') return cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  if (view === 'week') {
    const a = startOfWeek(cursor);
    const b = addDays(a, 6);
    const sameMonth = a.getMonth() === b.getMonth();
    return `${a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}, ${b.getFullYear()}`;
  }
  if (view === 'month') return cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return `Today and the next ${AGENDA_DAYS} days`;
}

const matchesQuery = (i: CalItem, q: string) => !q || [i.title, i.location, i.notes, ...(i.attendees ?? [])].some((s) => s?.toLowerCase().includes(q));

// ---- the workspace ----------------------------------------------------------------

function CommandCalendar({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const prefs = useStore((s) => s.settings.calendar) ?? DEFAULT_PREFS;
  const clockZones = useStore((s) => s.settings.clockZones);
  const updateSettings = useStore((s) => s.updateSettings);
  const h24 = useStore((s) => s.settings.clock24h);
  const events = useStore((s) => s.events);
  const todos = useStore((s) => s.todos);
  const processing = useStore((s) => s.processing);
  const completeTodo = useStore((s) => s.completeTodo);
  const restoreTodo = useStore((s) => s.restoreTodo);
  const updateTodo = useStore((s) => s.updateTodo);
  const updateProcessingItem = useStore((s) => s.updateProcessingItem);
  const addEvent = useStore((s) => s.addEvent);
  const now = useNow(30_000).getTime();

  const [view, setView] = useState<CalendarView>(target?.date ? 'day' : prefs.view);
  const [cursor, setCursor] = useState<Date>(() => (target?.date ? parseDay(target.date) : startOfDay(new Date())));
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [stackOpen, setStackOpen] = useState(true);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(target?.eventId ? `event:${target.eventId}` : null);
  const [toast, setToast] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);

  // Focus moves into the workspace, and back to whatever opened it on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => opener?.focus?.({ preventScroll: true });
  }, []);

  // A second "Jump to slot" while open moves to that event.
  useEffect(() => {
    if (!target?.date) return;
    setView('day');
    setCursor(parseDay(target.date));
    if (target.eventId) setFlashKey(`event:${target.eventId}`);
  }, [target]);
  useEffect(() => {
    if (!flashKey) return;
    const t = setTimeout(() => setFlashKey(null), 2600);
    return () => clearTimeout(t);
  }, [flashKey]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const setPrefs = useCallback((p: Partial<CalendarPrefs>) => updateSettings({ calendar: { ...prefs, ...p } }), [prefs, updateSettings]);
  const changeView = useCallback(
    (v: CalendarView) => {
      setView(v);
      setPrefs({ view: v });
    },
    [setPrefs],
  );

  const src = useMemo(() => ({ events, todos, processing }), [events, todos, processing]);
  const [from, to] = rangeOf(view, cursor, now);
  const q = query.trim().toLowerCase();
  const all = useMemo(() => collectItems(src, from, to), [src, from, to]);
  const items = useMemo(() => all.filter((i) => passes(filter, i) && matchesQuery(i, q)), [all, filter, q]);
  const conflicts = useMemo(() => findConflicts(items), [items]);
  const dayBucket = startOfDay(now).getTime();
  const todayItems = useMemo(() => collectItems(src, dayBucket, dayBucket + DAY), [src, dayBucket]);
  const minute = Math.floor(now / 60_000);
  const brief = useMemo(() => briefing(todayItems, new Date(dayBucket), minute * 60_000), [todayItems, dayBucket, minute]);
  const procDue = todayItems.filter((i) => i.kind === 'processing' && !i.reminder).length;
  const listDue = todayItems.filter((i) => (i.kind === 'todo' || i.kind === 'queue') && !i.reminder).length;
  const overdue = useMemo(() => (filter === 'all' || filter === 'todo' || filter === 'tasks' ? overdueTodos(todos, now).filter((i) => matchesQuery(i, q)) : []), [todos, now, filter, q]);

  // Conflict radar: the day in focus (the open day, otherwise today).
  const radarDay = view === 'day' ? startOfDay(cursor).getTime() : dayBucket;
  const radarItems = useMemo(() => collectItems(src, radarDay, radarDay + DAY), [src, radarDay]);
  const radar = useMemo(() => findConflicts(radarItems).count, [radarItems]);
  const radarLabel = radarDay === dayBucket ? 'today' : new Date(radarDay).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

  const resolve = useCallback(() => {
    const moves = autoResolve(radarItems, Date.now());
    if (!moves.length) {
      setToast(radar ? 'Only meetings collide. Move one of them to clear the conflict.' : 'No collisions to resolve.');
      return;
    }
    for (const { item, start } of moves) {
      const patch = { dueDate: dayKey(start), dueTime: hhmmOf(start) };
      if (item.kind === 'todo') updateTodo(item.sourceId, patch);
      else updateProcessingItem(item.sourceId, patch);
    }
    setFlashKey(moves[0].item.key);
    setToast(`Moved ${moves.length} due date${moves.length === 1 ? '' : 's'} into free slots`);
  }, [radarItems, radar, updateTodo, updateProcessingItem]);

  const step = useCallback(
    (dir: -1 | 1) => {
      if (view === 'agenda') return;
      setCursor((c) => (view === 'day' ? addDays(c, dir) : view === 'week' ? addDays(c, 7 * dir) : new Date(c.getFullYear(), c.getMonth() + dir, 1)));
    },
    [view],
  );
  const goToday = useCallback(() => setCursor(startOfDay(new Date())), []);

  const openCreate = useCallback(
    (kind: NewKind = 'event') => {
      const base = view === 'agenda' ? startOfDay(now) : cursor;
      const isToday = dayKey(base) === dayKey(now);
      const start = isToday ? Math.min(22 * 60, (new Date(now).getHours() + 1) * 60) : 9 * 60;
      setComposer({ mode: 'create', kind, date: dayKey(base), start: toHHMM(start), end: toHHMM(start + 60) });
    },
    [view, cursor, now],
  );

  const shield = useCallback(() => {
    const slot = focusShieldSlot(todayItems, Date.now());
    if (!slot) {
      setToast('No free two-hour stretch left today.');
      return;
    }
    const ev = addEvent({
      title: 'Focus Shield · Deep work',
      date: dayKey(slot.start),
      start: hhmmOf(slot.start),
      end: hhmmOf(slot.end),
      category: 'deep-work',
      priority: 'high',
      remindMins: 0,
      notes: 'Do not disturb. Blocked with Focus Shield.',
    });
    setView('day');
    setCursor(startOfDay(slot.start));
    setFlashKey(`event:${ev.id}`);
    setToast(`Focus Shield set ${fmtRange(slot.start, slot.end, h24)}`);
  }, [todayItems, addEvent, h24]);

  const onCreate = useCallback((date: string, startMin: number, endMin: number) => {
    setComposer({ mode: 'create', kind: 'event', date, start: toHHMM(startMin), end: toHHMM(endMin) });
  }, []);
  const onOpen = useCallback((item: CalItem) => {
    setComposer(item.kind === 'event' ? { mode: 'edit', eventId: item.sourceId } : { mode: 'task', item });
  }, []);
  const onToggleTodo = useCallback(
    (id: string) => {
      const t = useStore.getState().todos.find((x) => x.id === id);
      if (!t) return;
      completeTodo(id);
      if (!t.repeat) showUndo(`Completed “${t.text}”`, () => restoreTodo(id));
    },
    [completeTodo, restoreTodo],
  );
  const onSaved = useCallback(
    (key: string, date: string) => {
      setFlashKey(key);
      if (view !== 'agenda') setCursor(parseDay(date));
    },
    [view],
  );
  const pickDay = useCallback(
    (d: Date) => {
      setCursor(startOfDay(d));
      changeView('day');
    },
    [changeView],
  );
  const jump = useCallback((date: string, eventId: string) => {
    setView('day');
    setCursor(parseDay(date));
    setFlashKey(`event:${eventId}`);
  }, []);

  // Keyboard-first. Capture phase, so DevDeck's page hotkeys stay quiet while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (composer) return; // the modal handles its own keys
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (e.key === 'Escape') {
        if (document.querySelector('.dropdown-menu[role="listbox"]')) return;
        e.stopImmediatePropagation();
        if (typing && el === queryRef.current && query) setQuery('');
        else if (typing) el?.blur();
        else onClose();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      const act: Record<string, () => void> = {
        d: () => changeView('day'),
        w: () => changeView('week'),
        m: () => changeView('month'),
        a: () => changeView('agenda'),
        t: goToday,
        n: () => openCreate(),
        f: shield,
        b: () => setStackOpen((v) => !v),
        arrowleft: () => step(-1),
        arrowright: () => step(1),
        '/': () => queryRef.current?.focus(),
        ',': () => {},
      };
      const fn = act[e.key.toLowerCase()];
      if (!fn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      fn();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [composer, query, onClose, changeView, goToday, openCreate, shield, step]);

  const zones = useMemo(() => [...new Set([...SECOND_ZONES, ...(clockZones ?? [])])], [clockZones]);
  const zone = prefs.showSecondZone && (view === 'day' || view === 'week') ? prefs.secondZone : null;
  const weekDays = useMemo(() => (view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)) : [startOfDay(cursor)]), [view, cursor]);
  const chips = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)), [cursor]);
  const cursorIsNow = view === 'week' ? from <= now && now < to : view === 'month' ? cursor.getMonth() === new Date(now).getMonth() && cursor.getFullYear() === new Date(now).getFullYear() : dayKey(cursor) === dayKey(now);

  return (
    <motion.div
      key="cal-dialog"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Command Calendar"
      data-testid="command-calendar"
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="cmdcal fixed inset-0 z-[85] flex flex-col overflow-hidden outline-none"
    >
      <div className="cc-glow pointer-events-none absolute inset-0" aria-hidden />

      {/* Command bar */}
      <header className="cc-bar cc-line relative z-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="cc-logo flex size-11 shrink-0 items-center justify-center rounded-xl">
            <MatteCalendarIcon className="size-7" day={new Date(now).getDate()} />
          </span>
          <div className="min-w-0">
            <p className="cc-fg truncate text-[13.5px] font-bold tracking-tight">
              {new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="cc-fg3 hidden truncate text-[11px] sm:block">Events · To-do · Processing · Queue on one timeline</p>
          </div>
        </div>

        <label className="cc-search relative mx-auto flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border px-3 py-2 lg:max-w-[560px]">
          <SearchIcon />
          <input
            ref={queryRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, attendee, tag or place…"
            aria-label="Filter calendar"
            className="cc-fg min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--cc-fg3)]"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear filter" className="cc-iconbtn flex size-5 items-center justify-center rounded-md">
              <XIcon className="size-3" />
            </button>
          ) : (
            <kbd className="cc-kbd rounded px-1.5 font-mono text-[10px]">/</kbd>
          )}
        </label>

        <div className="flex items-center gap-2">
          <button type="button" onClick={shield} title="Find the next free 2 hours today and block them as Deep Work / Do Not Disturb (F)" data-testid="focus-shield" className="cc-shield flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-semibold">
            <ShieldIcon />
            <span className="hidden md:inline">Focus Shield</span>
          </button>
          <button type="button" onClick={() => openCreate()} title="Schedule an event or task (N)" className="cc-btn is-primary h-9 rounded-xl px-3.5">
            <PlusIcon />
            New item
          </button>
          <button
            type="button"
            onClick={() => setStackOpen((v) => !v)}
            aria-pressed={stackOpen}
            aria-label="Alert stack"
            title="Alert stack (B)"
            className={`cc-toggle relative hidden size-9 items-center justify-center rounded-xl border xl:flex ${stackOpen ? 'is-on' : ''}`}
          >
            <BellIcon />
          </button>
          <button type="button" onClick={onClose} aria-label="Close calendar" title="Close (Esc)" className="cc-iconbtn flex size-9 items-center justify-center rounded-xl">
            <XIcon className="size-4" />
          </button>
        </div>
      </header>

      {/* Daily briefing strip */}
      <section className="cc-strip cc-line relative z-10 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-2.5" aria-label="Today's briefing" data-testid="cal-briefing">
        <div className="flex flex-wrap items-center gap-2">
          <Kpi label="Meetings today" value={brief.meetings} color="var(--color-accent)" active={filter === 'event'} onClick={() => setFilter(filter === 'event' ? 'all' : 'event')} />
          <Kpi label="Processing due" value={procDue} color="#10b981" pulse active={filter === 'processing'} onClick={() => setFilter(filter === 'processing' ? 'all' : 'processing')} />
          <Kpi label="Queue & to-do due" value={listDue} color="#38bdf8" active={filter === 'tasks'} onClick={() => setFilter(filter === 'tasks' ? 'all' : 'tasks')} />
          <Kpi label="Focus left" value={`${brief.focusHours}h`} color="color-mix(in srgb, var(--color-accent) 70%, #fff)" />
          <Kpi label="Overload risk" value={brief.risk} color={brief.risk === 'High' ? '#f43f5e' : brief.risk === 'Med' ? '#f59e0b' : '#10b981'} tone={brief.risk === 'High' ? 'bad' : brief.risk === 'Med' ? 'warn' : 'good'} />
          {radar > 0 ? (
            <span data-testid="cal-conflicts-today" className="cc-radar is-hot flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-semibold tabular-nums">
              <BoltIcon className="size-3.5" />
              Conflict ({radar}) {radarLabel}
              <button type="button" onClick={resolve} className="cc-radar-fix underline decoration-1 underline-offset-2" title="Move colliding to-do / Queue / Processing due dates into free slots">
                Auto-resolve
              </button>
            </span>
          ) : (
            <span className="cc-radar is-clear flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold">
              <CheckIcon />
              Zero collisions {radarLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(view === 'day' || view === 'week') && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={prefs.showSecondZone}
                onClick={() => setPrefs({ showSecondZone: !prefs.showSecondZone })}
                title="Show a second time zone beside the hours"
                className={`cc-toggle flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-semibold ${prefs.showSecondZone ? 'is-on' : ''}`}
              >
                <GlobeIcon />
                {prefs.showSecondZone ? `Local + ${zoneAbbr(prefs.secondZone, now)} rail` : 'Dual time zone'}
              </button>
              {prefs.showSecondZone && (
                <Select
                  size="sm"
                  ariaLabel="Second time zone"
                  value={prefs.secondZone}
                  onChange={(z) => setPrefs({ secondZone: z })}
                  menuWidth={240}
                  className="w-[136px]"
                  options={zones.map((z) => ({ value: z, label: z === 'UTC' ? 'UTC' : zoneCity(z), hint: zoneAbbr(z, now) }))}
                />
              )}
            </div>
          )}
          <div role="tablist" aria-label="Calendar view" className="cc-seg flex gap-0.5 rounded-xl p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => changeView(v.id)}
                title={`${v.label} (${v.key})`}
                className={`cc-seg-btn rounded-lg px-3 py-1 text-[12px] font-semibold whitespace-nowrap ${view === v.id ? 'is-on' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Workspace */}
      <main className="relative z-10 flex min-h-0 flex-1 gap-4 p-4">
        <div className="cc-canvas flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border">
          <div className="cc-sub cc-line flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              {view !== 'agenda' && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => step(-1)} aria-label="Previous" title="Previous (←)" className="cc-iconbtn flex size-8 items-center justify-center rounded-lg">
                    <Chevron dir="left" />
                  </button>
                  <button type="button" onClick={goToday} disabled={cursorIsNow} title="Today (T)" className="cc-btn h-8 disabled:opacity-40">
                    Today
                  </button>
                  <button type="button" onClick={() => step(1)} aria-label="Next" title="Next (→)" className="cc-iconbtn flex size-8 items-center justify-center rounded-lg">
                    <Chevron dir="right" />
                  </button>
                </div>
              )}
              {view === 'day' && (
                <div className="cc-daychips flex items-center gap-0.5 rounded-lg border p-0.5" role="tablist" aria-label="Day of this week">
                  {chips.map((d) => {
                    const on = dayKey(d) === dayKey(cursor);
                    const isToday = dayKey(d) === dayKey(now);
                    return (
                      <button
                        key={dayKey(d)}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setCursor(d)}
                        className={`cc-daychip rounded-md px-2.5 py-1 text-[11.5px] font-semibold tabular-nums ${on ? 'is-on' : ''} ${isToday ? 'is-today' : ''}`}
                      >
                        {DOW[d.getDay()]} {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              )}
              <h3 className="cc-fg2 truncate text-[12px] font-semibold tabular-nums" data-testid="cal-range-title">
                {titleOf(view, cursor)}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Show">
              {LEGEND.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  style={{ '--k': f.color } as CSSProperties}
                  className={`cc-filter flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${filter === f.id ? 'is-on' : ''}`}
                >
                  <span className={`cc-filter-dot size-2 rounded-full ${f.dashed ? 'is-dashed' : ''}`} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {view === 'month' ? (
              <MonthView cursor={cursor} items={items} conflicts={conflicts} now={now} h24={h24} flashKey={flashKey} onCreate={onCreate} onOpen={onOpen} onToggleTodo={onToggleTodo} onPickDay={pickDay} />
            ) : view === 'agenda' ? (
              <AgendaView items={items} overdue={overdue} conflicts={conflicts} now={now} h24={h24} flashKey={flashKey} onOpen={onOpen} onToggleTodo={onToggleTodo} onAdd={() => openCreate()} />
            ) : (
              <TimeGrid
                days={weekDays}
                items={items}
                conflicts={conflicts}
                hourPx={view === 'day' ? 72 : 52}
                now={now}
                h24={h24}
                zone={zone}
                flashKey={flashKey}
                onCreate={onCreate}
                onOpen={onOpen}
                onToggleTodo={onToggleTodo}
                onPickDay={view === 'week' ? pickDay : undefined}
              />
            )}
          </div>
        </div>

        {stackOpen && <AlertStack events={events} todos={todos} processing={processing} now={now} h24={h24} onJump={jump} />}
      </main>

      <AnimatePresence>
        {toast && (
          <motion.p
            key={toast}
            role="status"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="cc-toast pointer-events-none absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] font-semibold tabular-nums"
          >
            <SparkIcon />
            {toast}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {composer && <CalendarComposer state={composer} h24={h24} onClose={() => setComposer(null)} onChange={setComposer} onSaved={onSaved} onLeave={onClose} />}
      </AnimatePresence>
    </motion.div>
  );
}

function Kpi({ label, value, color, tone, pulse, active, onClick }: { label: string; value: ReactNode; color: string; tone?: 'good' | 'warn' | 'bad'; pulse?: boolean; active?: boolean; onClick?: () => void }) {
  const inner = (
    <>
      <span className={`size-2 shrink-0 rounded-full ${pulse ? 'animate-pulse' : ''}`} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      <span className="cc-kpi-label text-[11.5px]">{label}</span>
      <span className={`cc-kpi-value text-[13px] font-bold tabular-nums ${tone ? `is-${tone}` : ''}`}>{value}</span>
    </>
  );
  const cls = `cc-kpi flex items-center gap-2 rounded-lg border px-3 py-1.5 ${active ? 'is-active' : ''}`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={!!active} title={`Show only: ${label}`} className={`${cls} transition-colors`} style={{ '--k': color } as CSSProperties}>
      {inner}
    </button>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

function CalendarIcon({ className, day }: { className: string; day: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <text x="12" y="18" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="ui-monospace, monospace">
        {day}
      </text>
    </svg>
  );
}

// The full-screen panel's mark: a matte, chamfered calendar slab with
// binding clips, a status rail in the accent and today's date in mono.
function MatteCalendarIcon({ className, day }: { className: string; day: number }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <path d="M7 6h18l3 3v16l-3 3H7l-3-3V9z" className="cc-mark-body" />
      <path d="M4 12h24" className="cc-mark-line" strokeWidth="1" />
      <rect x="9.5" y="3.5" width="2.5" height="5" rx="1" className="cc-mark-clip" />
      <rect x="20" y="3.5" width="2.5" height="5" rx="1" className="cc-mark-clip" />
      <path d="M7.5 9.2h7" className="cc-mark-rail" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="24.5" cy="9.2" r="0.9" className="cc-mark-led" />
      <text x="16" y="23.6" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="-0.3" className="cc-mark-day" fontFamily="ui-monospace, 'JetBrains Mono', monospace">
        {String(day).padStart(2, '0')}
      </text>
    </svg>
  );
}

const svg = (d: ReactNode, cls = 'size-3.5', sw = 2) => (
  <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
const Chevron = ({ dir }: { dir: 'left' | 'right' }) => svg(<path d={dir === 'left' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />, 'size-4', 2.2);
const GlobeIcon = () =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.7 5.7 3.7 9s-1.2 6.3-3.7 9c-2.5-2.7-3.7-5.7-3.7-9S9.5 5.7 12 3z" />
    </>,
  );
const ShieldIcon = () =>
  svg(
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6L12 3z" />
      <path d="m9 12 2 2 4-4" />
    </>,
  );
const SearchIcon = () =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>,
    'cc-search-icon size-4 shrink-0',
  );
const XIcon = ({ className }: { className: string }) => svg(<path d="M6 6l12 12M18 6 6 18" />, className, 2.4);
const PlusIcon = () => svg(<path d="M12 5v14M5 12h14" />, 'size-4', 2.4);
const CheckIcon = () =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>,
  );
const BellIcon = () =>
  svg(
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>,
    'size-4',
  );
const SparkIcon = () => svg(<path d="M12 3c.5 4.2 3.8 7.5 8 8-4.2.5-7.5 3.8-8 8-.5-4.2-3.8-7.5-8-8 4.2-.5 7.5-3.8 8-8z" />, 'cc-spark size-4 shrink-0', 1.8);
