// Reminder schedules for Currently Processing items (plan Phase 4). Pure and
// dependency-free so the page and the extension service worker share it.

import type { Schedule } from '../types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Active on a given day: enabled, inside the from→to month span (inclusive),
// and on one of the chosen weekdays.
export function isActiveDay(s: Schedule, d: Date): boolean {
  if (!s.enabled || s.daysOfWeek.length === 0) return false;
  const m = monthKey(d);
  if (s.from && m < s.from) return false;
  if (s.to && m > s.to) return false;
  return s.daysOfWeek.includes(d.getDay());
}

const parseTime = (t: string | null): [number, number] => {
  const [h, m] = (t ?? '09:00').split(':').map(Number);
  return [Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0];
};

const inSpan = (s: Schedule, d: Date) => {
  const m = monthKey(d);
  return !(s.from && m < s.from) && !(s.to && m > s.to);
};
const every = (s: Schedule) => Math.max(1, Math.round(s.interval ?? 1));
// The span's first month anchors "every N weeks / months".
const anchor = (s: Schedule) => {
  const [y, m] = (s.from || '2000-01').split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1);
};
const weekStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());

// The first fire time strictly after `after`, or null if the schedule never
// fires again (disabled, no days, or the date span has ended).
export function nextFireTime(s: Schedule, after: Date): Date | null {
  if (!s.enabled) return null;
  const start = new Date(after.getTime());

  if (s.frequency === 'monthly') {
    // A day of the month (or its last day), every N months from the span start.
    const [h, m] = parseTime(s.timeOfDay);
    const base = anchor(s);
    for (let i = 0; i <= 120; i++) {
      const first = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const monthsIn = (first.getFullYear() - base.getFullYear()) * 12 + first.getMonth() - base.getMonth();
      if (monthsIn < 0 || monthsIn % every(s) !== 0) continue;
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const dom = s.dayOfMonth === -1 ? last : Math.min(Math.max(1, s.dayOfMonth ?? 1), last);
      const c = new Date(first.getFullYear(), first.getMonth(), dom, h, m, 0, 0);
      if (!inSpan(s, c)) {
        if (s.to && monthKey(c) > s.to) return null;
        continue;
      }
      if (c > after) return c;
    }
    return null;
  }

  if (s.daysOfWeek.length === 0) return null;

  if (s.frequency === 'weekly') {
    // The chosen weekdays, in every Nth week counted from the span start.
    const [h, m] = parseTime(s.timeOfDay);
    const base = weekStart(anchor(s)).getTime();
    for (let i = 0; i <= 800; i++) {
      const c = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, h, m, 0, 0);
      if (c <= after || !isActiveDay(s, c)) continue;
      const weeks = Math.round((weekStart(c).getTime() - base) / (7 * 86_400_000));
      if (weeks >= 0 && weeks % every(s) === 0) return c;
    }
    return null;
  }

  if (s.frequency === 'daily') {
    const [h, m] = parseTime(s.timeOfDay);
    for (let i = 0; i <= 400; i++) {
      const c = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, h, m, 0, 0);
      if (c > after && isActiveDay(s, c)) return c;
    }
    return null;
  }

  // minute / hourly: step to the next boundary, then skip whole inactive days.
  const stepMin = s.frequency === 'minute' ? 1 : 60;
  let c = new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), stepMin === 60 ? 0 : start.getMinutes(), 0, 0);
  while (c <= after) c = new Date(c.getTime() + stepMin * 60_000);
  for (let guard = 0; guard < 400; guard++) {
    if (isActiveDay(s, c)) return c;
    c = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 1, 0, 0, 0, 0);
  }
  return null;
}

// "Every hour · Mon–Fri · Oct–Dec 2026"
export function describeSchedule(s: Schedule): string {
  if (!s.enabled) return 'Reminders off';
  const at = s.timeOfDay ?? '09:00';
  const n = every(s);
  if (s.frequency === 'monthly') {
    const day = s.dayOfMonth === -1 ? 'the last day' : `the ${ordinal(s.dayOfMonth ?? 1)}`;
    const freq = n === 1 ? `Monthly on ${day} at ${at}` : `Every ${n} months on ${day} at ${at}`;
    return [freq, describeSpan(s.from, s.to)].filter(Boolean).join(' · ');
  }
  const freq =
    s.frequency === 'minute'
      ? 'Every minute'
      : s.frequency === 'hourly'
        ? 'Every hour'
        : s.frequency === 'weekly'
          ? `${n === 1 ? 'Weekly' : `Every ${n} weeks`} at ${at}`
          : `Daily at ${at}`;
  return [freq, describeDays(s.daysOfWeek), describeSpan(s.from, s.to)].filter(Boolean).join(' · ');
}

export function describeDays(days: readonly number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b);
  if (set.length === 7) return 'Every day';
  if (set.length === 0) return 'No days';
  if (set.join() === '1,2,3,4,5') return 'Mon–Fri';
  if (set.join() === '0,6') return 'Weekends';
  return set.map((d) => DAY_NAMES[d]).join(', ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function describeSpan(from: string, to: string): string {
  const fmt = (k: string) => {
    const [y, m] = k.split('-').map(Number);
    return { y, label: MONTHS[(m || 1) - 1] };
  };
  if (!from || !to) return '';
  const a = fmt(from);
  const b = fmt(to);
  if (from === to) return `${a.label} ${a.y}`;
  return a.y === b.y ? `${a.label}–${b.label} ${b.y}` : `${a.label} ${a.y}–${b.label} ${b.y}`;
}

export const DAY_LABELS = DAY_NAMES;

// 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
