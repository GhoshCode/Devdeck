// Command Calendar engine — pure and React-free (the service worker imports
// the alert helpers). Puts custom events, to-do due dates, Queue / Currently
// processing due dates and their scheduled reminders on one timeline, then
// answers the questions the views ask: what overlaps, what's free, how loaded
// a day is, and what's next.

import { FIRST_SECTION, type CalendarEvent, type EventCategory, type EventPriority, type ProcessingItem, type Priority, type Todo } from '../types';
import { nextFireTime } from './schedule';
import { localDateKey } from './time';

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const TASK_SLOT_MIN = 30; // a due time takes half an hour on the grid
export const WORK_START_H = 8; // the working day used for focus time and load
export const WORK_END_H = 20;
export const FOCUS_SHIELD_MIN = 120;
export const SNAP_MIN = 15;

export type CalKind = 'event' | 'todo' | 'processing' | 'queue';

export interface CalItem {
  key: string; // unique per occurrence
  kind: CalKind;
  sourceId: string; // the event, to-do or processing item id
  title: string;
  start: number; // epoch ms
  end: number; // epoch ms, after start
  allDay: boolean; // a due date without a time
  reminder: boolean; // a scheduled reminder occurrence, not a due date
  category?: EventCategory;
  priority?: EventPriority;
  todoPriority?: Priority;
  attendees?: string[];
  location?: string;
  notes?: string;
  url?: string;
  members?: CalItem[]; // a reminder group: the reminders that fire at this same time
}

export const EVENT_CATEGORIES: ReadonlyArray<{ id: EventCategory; label: string }> = [
  { id: 'meeting', label: 'Meeting' },
  { id: 'call', label: 'Call' },
  { id: 'vip', label: 'VIP' },
  { id: 'deep-work', label: 'Deep work' },
  { id: 'deadline', label: 'Deadline' },
  { id: 'travel', label: 'Travel' },
];
export const EVENT_PRIORITIES: ReadonlyArray<{ id: EventPriority; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
  { id: 'critical', label: 'Critical' },
];
export const REMINDER_LEADS: ReadonlyArray<{ mins: number | null; label: string }> = [
  { mins: null, label: 'No alert' },
  { mins: 0, label: 'At start' },
  { mins: 5, label: '5 min before' },
  { mins: 10, label: '10 min before' },
  { mins: 15, label: '15 min before' },
  { mins: 30, label: '30 min before' },
  { mins: 60, label: '1 hour before' },
];
// Meetings take the theme accent; the rest: indigo calls, gold VIP, obsidian-silver
// focus blocks, rose deadlines, amber travel. (alertOverlay.ts keeps a copy.)
export const CATEGORY_COLOR: Record<EventCategory, string> = {
  meeting: 'var(--color-accent)', // meetings wear the theme accent
  call: '#6366f1',
  vip: '#eab308',
  'deep-work': '#94a3b8',
  deadline: '#f43f5e',
  travel: '#f97316',
};
const MEETING_LIKE = new Set<EventCategory>(['meeting', 'call', 'vip']);

export const isMeeting = (i: Pick<CalItem, 'kind' | 'category'>) => i.kind === 'event' && !!i.category && MEETING_LIKE.has(i.category);
export const isTask = (i: Pick<CalItem, 'kind'>) => i.kind !== 'event';

// ---- dates ------------------------------------------------------------------

export const dayKey = (d: Date | number): string => localDateKey(typeof d === 'number' ? new Date(d) : d);
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export const startOfDay = (d: Date | number) => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
};
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Weeks start on Monday.
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};
const pad = (n: number) => String(n).padStart(2, '0');
export const toHHMM = (mins: number) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
export const hhmmOf = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const atTime = (date: string, hhmm: string): number => parseDay(date).getTime() + minutesOf(hhmm) * MIN;

export function fmtTime(ms: number, h24: boolean): string {
  const d = new Date(ms);
  if (h24) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const h = d.getHours() % 12 || 12;
  return `${h}:${pad(d.getMinutes())}${d.getHours() < 12 ? 'a' : 'p'}`;
}
export const fmtRange = (a: number, b: number, h24: boolean) => `${fmtTime(a, h24)}–${fmtTime(b, h24)}`;

export function fmtDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / MIN));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// "Starts in 5m" → "Now" → "Ended".
export function countdown(startsAt: number, endsAt: number, now: number): string {
  if (now < startsAt) return `Starts in ${fmtDuration(Math.ceil((startsAt - now) / MIN) * MIN)}`;
  if (now < endsAt) return 'Now';
  return 'Ended';
}

export function eventSpan(e: Pick<CalendarEvent, 'date' | 'start' | 'end'>): { start: number; end: number } {
  const start = atTime(e.date, e.start);
  const end = atTime(e.date, e.end);
  return { start, end: end > start ? end : start + TASK_SLOT_MIN * MIN };
}

// ---- collecting -------------------------------------------------------------

export interface CalendarSources {
  events: readonly CalendarEvent[];
  todos: readonly Todo[];
  processing: readonly ProcessingItem[];
}

const MAX_OCCURRENCES = 120; // per scheduled item and range

function dueSpan(date: string, time: string | null | undefined): { start: number; end: number; allDay: boolean } {
  if (time) {
    const start = atTime(date, time);
    return { start, end: start + TASK_SLOT_MIN * MIN, allDay: false };
  }
  const start = parseDay(date).getTime();
  return { start, end: addDays(new Date(start), 1).getTime(), allDay: true };
}

// Everything that touches [from, to), sorted by start.
export function collectItems(src: CalendarSources, from: number, to: number): CalItem[] {
  const out: CalItem[] = [];
  const hits = (s: number, e: number) => s < to && e > from;

  for (const e of src.events) {
    const { start, end } = eventSpan(e);
    if (!hits(start, end)) continue;
    out.push({
      key: `event:${e.id}`,
      kind: 'event',
      sourceId: e.id,
      title: e.title,
      start,
      end,
      allDay: false,
      reminder: false,
      category: e.category,
      priority: e.priority,
      attendees: e.attendees,
      location: e.location,
      notes: e.notes,
    });
  }

  for (const t of src.todos) {
    if (t.archivedAt !== null || !t.dueDate) continue;
    const span = dueSpan(t.dueDate, t.dueTime);
    if (!hits(span.start, span.end)) continue;
    out.push({ key: `todo:${t.id}`, kind: 'todo', sourceId: t.id, title: t.text, ...span, reminder: false, todoPriority: t.priority, notes: t.notes });
  }

  for (const p of src.processing) {
    const kind: CalKind = p.section === FIRST_SECTION ? 'processing' : 'queue';
    if (p.dueDate) {
      const span = dueSpan(p.dueDate, p.dueTime);
      if (hits(span.start, span.end)) out.push({ key: `${kind}:${p.id}`, kind, sourceId: p.id, title: p.name, ...span, reminder: false, url: p.url });
    }
    // Minute / hourly reminders are a rhythm, not appointments: left off the grid.
    const s = p.schedule;
    if (!s?.enabled || s.frequency === 'minute' || s.frequency === 'hourly') continue;
    let after = new Date(from - 1);
    for (let n = 0; n < MAX_OCCURRENCES; n++) {
      const next = nextFireTime(s, after);
      if (!next || next.getTime() >= to) break;
      const start = next.getTime();
      out.push({ key: `${kind}:${p.id}:${start}`, kind, sourceId: p.id, title: p.name, start, end: start + TASK_SLOT_MIN * MIN, allDay: false, reminder: true, url: p.url });
      after = next;
    }
  }

  return out.sort((a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay) || a.title.localeCompare(b.title));
}

// Reminders are a rhythm, and with hundreds of scheduled sites many fire at the
// same minute: those become one item ("9:00 · 14 reminders") that opens the
// list, instead of hundreds of slivers. Due dates, events and to-dos stay as
// they are, and so does a reminder that is alone at its time.
export function groupReminders(items: readonly CalItem[]): CalItem[] {
  const byStart = new Map<number, CalItem[]>();
  const out: CalItem[] = [];
  for (const i of items) {
    if (!i.reminder || i.members) {
      out.push(i);
      continue;
    }
    const list = byStart.get(i.start);
    if (list) list.push(i);
    else byStart.set(i.start, [i]);
  }
  for (const [start, list] of byStart) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const processing = list.filter((i) => i.kind === 'processing').length;
    const names = list.slice(0, 3).map((i) => i.title).join(', ');
    out.push({
      key: `reminders:${start}`,
      kind: processing >= list.length - processing ? 'processing' : 'queue',
      sourceId: '',
      title: `${list.length} reminders · ${names}${list.length > 3 ? '…' : ''}`,
      start,
      end: Math.max(...list.map((i) => i.end)),
      allDay: false,
      reminder: true,
      members: list,
    });
  }
  return out.sort((a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay) || a.title.localeCompare(b.title));
}

export const onDay = (items: readonly CalItem[], day: Date) => {
  const a = startOfDay(day).getTime();
  const b = addDays(new Date(a), 1).getTime();
  return items.filter((i) => i.start < b && i.end > a);
};

// ---- layout -----------------------------------------------------------------

export interface Placed {
  item: CalItem;
  col: number;
  cols: number;
}

// Side-by-side columns for overlapping blocks (each cluster of overlaps is
// split evenly), so concurrent meetings and tasks are all visible.
export function layoutColumns(items: readonly CalItem[]): Placed[] {
  const timed = items.filter((i) => !i.allDay).sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const cols = Math.max(1, colEnds.length);
    for (const p of cluster) p.cols = cols;
    placed.push(...cluster);
    cluster = [];
    colEnds = [];
  };
  for (const item of timed) {
    if (item.start >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= item.start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.end);
    } else colEnds[col] = item.end;
    cluster.push({ item, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return placed;
}

// ---- conflicts --------------------------------------------------------------

export interface ConflictReport {
  count: number; // overlapping pairs + overloaded hours
  pairs: Array<[string, string]>;
  hotHours: number[]; // start of each hour with more than three due dates
  byKey: Map<string, number>; // how many conflicts each item is part of
}

export const MAX_DUES_PER_HOUR = 3;

// Two blocks collide when they overlap and at least one is a custom event
// (tasks alone are due points, not bookings). More than three due dates in
// the same hour is an overload.
export function findConflicts(items: readonly CalItem[]): ConflictReport {
  const timed = items.filter((i) => !i.allDay).sort((a, b) => a.start - b.start);
  const pairs: Array<[string, string]> = [];
  const byKey = new Map<string, number>();
  const bump = (k: string) => byKey.set(k, (byKey.get(k) ?? 0) + 1);
  for (let i = 0; i < timed.length; i++) {
    const a = timed[i];
    for (let j = i + 1; j < timed.length && timed[j].start < a.end; j++) {
      const b = timed[j];
      if (a.kind !== 'event' && b.kind !== 'event') continue;
      pairs.push([a.key, b.key]);
      bump(a.key);
      bump(b.key);
    }
  }
  const perHour = new Map<number, CalItem[]>();
  for (const i of timed) {
    if (i.kind === 'event' || i.reminder) continue;
    // Local clock hour (zones like UTC+5:30 don't line up with epoch hours).
    const d = new Date(i.start);
    const h = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
    perHour.set(h, [...(perHour.get(h) ?? []), i]);
  }
  const hotHours: number[] = [];
  for (const [h, list] of perHour) {
    if (list.length <= MAX_DUES_PER_HOUR) continue;
    hotHours.push(h);
    list.forEach((i) => bump(i.key));
  }
  return { count: pairs.length + hotHours.length, pairs, hotHours: hotHours.sort((a, b) => a - b), byKey };
}

// ---- free time --------------------------------------------------------------

const busyBlocks = (items: readonly CalItem[]) =>
  items
    .filter((i) => !i.allDay)
    .map((i) => [i.start, i.end] as [number, number])
    .sort((a, b) => a[0] - b[0]);

// Unbooked stretches inside [from, to).
export function freeGaps(items: readonly CalItem[], from: number, to: number): Array<[number, number]> {
  const gaps: Array<[number, number]> = [];
  let cursor = from;
  for (const [s, e] of busyBlocks(items)) {
    if (e <= cursor) continue;
    if (s >= to) break;
    if (s > cursor) gaps.push([cursor, Math.min(s, to)]);
    cursor = Math.max(cursor, e);
    if (cursor >= to) break;
  }
  if (cursor < to) gaps.push([cursor, to]);
  return gaps.filter(([a, b]) => b > a);
}

const ceilTo = (ms: number, step: number) => Math.ceil(ms / step) * step;

// Focus Shield: the first free two hours left today, starting on a quarter hour.
export function focusShieldSlot(itemsToday: readonly CalItem[], now: number, minutes = FOCUS_SHIELD_MIN): { start: number; end: number } | null {
  const dayEnd = addDays(startOfDay(now), 1).getTime() - SNAP_MIN * MIN; // a block must end by 23:45
  const need = minutes * MIN;
  for (const [a, b] of freeGaps(itemsToday, now, dayEnd)) {
    const start = ceilTo(a, SNAP_MIN * MIN);
    if (b - start >= need) return { start, end: start + need };
  }
  return null;
}

// ---- briefing ---------------------------------------------------------------

export type Risk = 'Low' | 'Med' | 'High';

export interface Briefing {
  meetings: number;
  tasksDue: number;
  focusHours: number; // rounded to 0.5h
  risk: Risk;
  conflicts: number;
}

// KPIs for one day. Focus time = free stretches of 30 min+ left in the working
// day, plus what's left of deep-work blocks; load = booked share of the
// working day, raised by conflicts and a pile of due dates.
export function briefing(itemsOfDay: readonly CalItem[], day: Date, now: number): Briefing {
  const d0 = startOfDay(day).getTime();
  const workStart = d0 + WORK_START_H * HOUR;
  const workEnd = d0 + WORK_END_H * HOUR;
  const meetings = itemsOfDay.filter(isMeeting).length;
  const tasksDue = itemsOfDay.filter((i) => isTask(i) && !i.reminder).length;
  const conflicts = findConflicts(itemsOfDay).count;

  // Deep-work blocks count once, as focus — not again as free time.
  const from = Math.max(workStart, Math.min(now, workEnd));
  const isPastDay = now >= d0 + DAY;
  let focus = 0;
  if (!isPastDay) {
    for (const [a, b] of freeGaps(itemsOfDay, now < d0 ? workStart : from, workEnd)) if (b - a >= 30 * MIN) focus += b - a;

    for (const i of itemsOfDay)
      if (i.kind === 'event' && i.category === 'deep-work') focus += Math.max(0, Math.min(i.end, workEnd) - Math.max(i.start, now < d0 ? workStart : from));
  }

  let booked = 0;
  for (const [a, b] of busyBlocks(itemsOfDay.filter((i) => i.kind === 'event'))) booked += Math.max(0, Math.min(b, workEnd) - Math.max(a, workStart));
  const load = booked / (workEnd - workStart) + conflicts * 0.2 + Math.max(0, tasksDue - 3) * 0.05;
  const risk: Risk = load >= 0.75 ? 'High' : load >= 0.45 ? 'Med' : 'Low';

  return { meetings, tasksDue, focusHours: Math.round((focus / HOUR) * 2) / 2, risk, conflicts };
}

// Month heatmap: meetings, due dates, deadlines and conflicts.
// 0 free · 1 light · 2 busy · 3 overloaded.
export type Workload = 0 | 1 | 2 | 3;
export function workload(itemsOfDay: readonly CalItem[]): { level: Workload; score: number } {
  const score = itemsOfDay.filter((i) => isMeeting(i) || i.category === 'deadline' || (isTask(i) && !i.reminder)).length + findConflicts(itemsOfDay).count;
  return { level: score === 0 ? 0 : score <= 3 ? 1 : score <= 6 ? 2 : 3, score };
}

// ---- agenda -----------------------------------------------------------------

export interface Agenda {
  next: CalItem[]; // running now or starting within two hours
  later: CalItem[]; // the rest of today
  deadlines: CalItem[]; // due dates and deadline events in the next two weeks (overdue to-dos first)
}

export function agenda(items: readonly CalItem[], now: number, overdue: readonly CalItem[] = []): Agenda {
  const dayEnd = addDays(startOfDay(now), 1).getTime();
  const soon = now + 2 * HOUR;
  const next: CalItem[] = [];
  const later: CalItem[] = [];
  const deadlines: CalItem[] = [...overdue];
  const listed = new Set(overdue.map((i) => i.key));
  for (const i of items) {
    const isDue = isTask(i) && !i.reminder;
    // A due time that has passed is overdue, not "next".
    if (isDue && !i.allDay && i.start < now) {
      if (!listed.has(i.key)) deadlines.push(i);
      listed.add(i.key);
    } else if (!i.allDay && i.end > now && i.start < soon) next.push(i);
    else if (!i.allDay && i.start >= soon && i.start < dayEnd) later.push(i);
    else if ((isDue || i.category === 'deadline') && i.end > now && !listed.has(i.key)) {
      deadlines.push(i);
      listed.add(i.key);
    }
  }
  return { next, later, deadlines: deadlines.sort((a, b) => a.start - b.start) };

}

// To-dos already past due (they no longer show on future days).
export function overdueTodos(todos: readonly Todo[], now: number): CalItem[] {
  const out: CalItem[] = [];
  for (const t of todos) {
    if (t.archivedAt !== null || !t.dueDate) continue;
    const span = dueSpan(t.dueDate, t.dueTime);
    const due = span.allDay ? span.end : span.start;
    if (due < now) out.push({ key: `todo:${t.id}`, kind: 'todo', sourceId: t.id, title: t.text, ...span, reminder: false, todoPriority: t.priority });
  }
  return out.sort((a, b) => a.start - b.start);
}

// ---- grid geometry ----------------------------------------------------------

// Minutes from midnight for a y offset, snapped to the quarter hour.
export const snapMinutes = (y: number, hourPx: number) => Math.max(0, Math.min(24 * 60, Math.round((y / hourPx) * 60 / SNAP_MIN) * SNAP_MIN));

// Conflict radar "Auto-resolve": each colliding due date (to-do / Queue /
// Currently processing — never a meeting or a scheduled reminder) moves to the
// first free stretch of the same length later that day, on a quarter hour.
// Returns the new start per moved item; anything with no room stays put.
export function autoResolve(itemsOfDay: readonly CalItem[], now: number): Array<{ item: CalItem; start: number }> {
  const { byKey } = findConflicts(itemsOfDay);
  const movable = itemsOfDay.filter((i) => isTask(i) && !i.reminder && !i.allDay && byKey.has(i.key));
  const placed: CalItem[] = itemsOfDay.filter((i) => !movable.includes(i));
  const step = SNAP_MIN * MIN;
  const moves: Array<{ item: CalItem; start: number }> = [];
  for (const it of movable) {
    const dur = it.end - it.start;
    const dayEnd = addDays(startOfDay(it.start), 1).getTime() - step;
    const from = Math.max(it.start, Math.ceil(now / step) * step);
    const gap = freeGaps(placed, from, dayEnd).find(([a, b]) => b - Math.ceil(a / step) * step >= dur);
    if (!gap) {
      placed.push(it);
      continue;
    }
    const start = Math.ceil(gap[0] / step) * step;
    if (start !== it.start) moves.push({ item: it, start });
    placed.push({ ...it, start, end: start + dur });
  }
  return moves;
}
