import type { Repeat, Todo } from '../types';
import { localDateKey } from './time';

// The moment a to-do becomes overdue. A date with no time is due by the end of
// that day, so "due today" items only turn red after midnight.
export function dueTimestamp(t: Pick<Todo, 'dueDate' | 'dueTime'>): number | null {
  if (!t.dueDate) return null;
  const [y, m, d] = t.dueDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  if (t.dueTime) {
    const [hh, mm] = t.dueTime.split(':').map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
  }
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export const isOverdue = (t: Todo, now: number): boolean => {
  const due = dueTimestamp(t);
  return due !== null && now > due;
};

export const isDueToday = (t: Todo, now: number): boolean =>
  t.dueDate === localDateKey(new Date(now)) && !isOverdue(t, now);

// Red Danger Zone (spec §3.4): overdue items float to the top, most overdue
// first; everything else keeps the user's manual order.
export function sortActive(todos: readonly Todo[], now: number): Todo[] {
  const active = todos.filter((t) => t.archivedAt === null);
  const overdue = active
    .filter((t) => isOverdue(t, now))
    .sort((a, b) => dueTimestamp(a)! - dueTimestamp(b)!);
  const rest = active.filter((t) => !isOverdue(t, now)).sort((a, b) => a.order - b.order);
  return [...overdue, ...rest];
}

export const sortArchived = (todos: readonly Todo[]): Todo[] =>
  todos.filter((t) => t.archivedAt !== null).sort((a, b) => b.archivedAt! - a.archivedAt!);

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

// Compact due label: "Today 18:00", "Tomorrow", "Oct 20 09:30", "3h overdue".
export function formatDue(t: Todo, now: number): string | null {
  const due = dueTimestamp(t);
  if (due === null || !t.dueDate) return null;
  if (now > due) {
    const mins = Math.floor((now - due) / 60_000);
    if (mins < 60) return `${Math.max(1, mins)}m overdue`;
    if (mins < 60 * 24) return `${Math.floor(mins / 60)}h overdue`;
    return `${Math.floor(mins / (60 * 24))}d overdue`;
  }
  const today = new Date(now);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const day =
    t.dueDate === localDateKey(today)
      ? 'Today'
      : t.dueDate === localDateKey(tomorrow)
        ? 'Tomorrow'
        : shortDate.format(new Date(due));
  return t.dueTime ? `${day} ${t.dueTime}` : day;
}

export type TodoView = 'all' | 'today' | 'upcoming' | 'overdue';

// Expanded to-do views: today = due today or overdue, upcoming = due later,
// overdue = past due.
export function matchesView(t: Todo, view: TodoView, now: number): boolean {
  if (view === 'all') return true;
  const overdue = isOverdue(t, now);
  if (view === 'overdue') return overdue;
  if (view === 'today') return overdue || isDueToday(t, now);
  return !!t.dueDate && !overdue && !isDueToday(t, now);
}

export const REPEAT_LABEL: Record<Repeat, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

// One step of a repeat from a 'YYYY-MM-DD' date. Months keep the day where
// they can (Jan 31 → Feb 28/29), weekdays skip Saturday and Sunday.
export function stepRepeat(dateKey: string, repeat: Repeat): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (repeat === 'monthly' || repeat === 'yearly') {
    const months = repeat === 'monthly' ? 1 : 12;
    const last = new Date(y, m - 1 + months + 1, 0).getDate();
    return localDateKey(new Date(y, m - 1 + months, Math.min(d, last)));
  }
  let next = new Date(y, m - 1, d + (repeat === 'weekly' ? 7 : 1));
  if (repeat === 'weekdays') while (next.getDay() === 0 || next.getDay() === 6) next = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1);
  return localDateKey(next);
}

// The next due date after completing: one step on, then on until it is no
// longer in the past (so a weekly task ticked late lands on its next slot).
export function nextRepeatDate(t: Pick<Todo, 'dueDate' | 'dueTime'>, repeat: Repeat, now: number): string | null {
  if (!t.dueDate) return null;
  let next = stepRepeat(t.dueDate, repeat);
  for (let i = 0; i < 1000 && (dueTimestamp({ dueDate: next, dueTime: t.dueTime }) ?? 0) <= now; i++) next = stepRepeat(next, repeat);
  return next;
}
