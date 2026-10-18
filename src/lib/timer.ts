// Countdown timers on to-dos and Focus / Queue sites. A timer is a length
// ("4 days", "2 months", "90 minutes") counted from when it was set — for a
// task added with a timer, its creation — and is shown at the coarsest unit the user chose:
//   months → "3 months left" until the last month, then days
//   days   → "4 days left" until the last day, then hh:mm:ss
//   hours / minutes → hh:mm:ss throughout
// Pure functions (no React) so the maths is unit-tested on its own.

export type TimerUnit = 'minutes' | 'hours' | 'days' | 'months';

export interface Timer {
  amount: number; // ≥ 1
  unit: TimerUnit;
  start: number; // epoch ms — when the countdown began
}

export const TIMER_UNITS: TimerUnit[] = ['minutes', 'hours', 'days', 'months'];
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Calendar months, keeping the day where possible (Jan 31 + 1 month → Feb 28).
export function addMonths(at: number, n: number): number {
  const d = new Date(at);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return target.getTime();
}

export function timerEnd(t: Timer): number {
  switch (t.unit) {
    case 'minutes':
      return t.start + t.amount * MIN;
    case 'hours':
      return t.start + t.amount * HOUR;
    case 'days':
      return t.start + t.amount * DAY;
    case 'months':
      return addMonths(t.start, t.amount);
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export interface TimerView {
  text: string; // "3 months left" · "4 days left" · "05:12:09" · "Time's up"
  ticking: boolean; // showing seconds — redraw every second
  state: 'running' | 'soon' | 'done'; // soon = under an hour
  end: number;
}

export function viewTimer(t: Timer, now: number): TimerView {
  const end = timerEnd(t);
  const left = end - now;
  if (left <= 0) return { text: "Time's up", ticking: false, state: 'done', end };
  const state = left < HOUR ? 'soon' : 'running';
  if (t.unit === 'months') {
    // Whole months still to go, counting the one in progress ("2 months left"
    // right after setting 2); the last month switches to days.
    let months = 0;
    while (months < 1200 && addMonths(now, months) < end) months++;
    if (months > 1) return { text: `${months} months left`, ticking: false, state, end };
  }
  if (t.unit === 'months' || t.unit === 'days') {
    const days = Math.ceil(left / DAY);
    if (days > 1) return { text: `${days} days left`, ticking: false, state, end };
  }
  return { text: clock(left), ticking: true, state, end };
}

// Short label for pickers and chips: "4 days", "1 month", "90 min".
export function describeTimer(t: Pick<Timer, 'amount' | 'unit'>): string {
  const n = t.amount;
  if (t.unit === 'minutes') return `${n} min`;
  const word = t.unit === 'hours' ? 'hour' : t.unit === 'days' ? 'day' : 'month';
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function normalizeTimer(raw: unknown, fallbackStart: number): Timer | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const amount = Math.round(Number(r.amount));
  if (!Number.isFinite(amount) || amount < 1 || !TIMER_UNITS.includes(r.unit as TimerUnit)) return null;
  return { amount: Math.min(amount, 9999), unit: r.unit as TimerUnit, start: typeof r.start === 'number' ? r.start : fallbackStart };
}
