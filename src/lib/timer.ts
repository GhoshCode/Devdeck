// Countdown timers on to-dos and Focus / Queue sites. A timer is a length
// ("3 days", "2 months", "90 minutes") counted from when the item was created:
// a task added on Sunday 19:33 with 2 days is due Tuesday 19:33.
//   before the last day  → "3 days left" (months: "2 months left", then days)
//   the last day         → "05:12 left"   (minute / hour timers: "00:24:59")
//   past due, same day   → "01:05 over"
//   after that day       → "2 days overdue"
// Pure functions (no React) so the maths is unit-tested on its own.

export type TimerUnit = 'minutes' | 'hours' | 'days' | 'months';

export interface Timer {
  amount: number; // ≥ 1
  unit: TimerUnit;
  start: number; // epoch ms — the item's creation
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

export function clock(ms: number, seconds = true): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hm = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}`;
  return seconds ? `${hm}:${pad(s % 60)}` : hm;
}

const dayStart = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export interface TimerView {
  text: string; // "3 days left" · "05:12 left" · "00:24:59" · "01:05 over" · "2 days overdue"
  refreshMs: number; // how often the label can change
  state: 'running' | 'soon' | 'over'; // soon = under an hour left
  end: number;
}

export function viewTimer(t: Timer, now: number): TimerView {
  const end = timerEnd(t);
  const left = end - now;
  const seconds = t.unit === 'minutes' || t.unit === 'hours';

  if (left <= 0) {
    // Same calendar day as the due moment: how long ago, as a clock.
    // Any later day: whole days overdue.
    const days = Math.round((dayStart(now) - dayStart(end)) / DAY);
    if (days < 1) return { text: `${clock(now - end, false)} over`, refreshMs: 15_000, state: 'over', end };
    return { text: `${days} day${days === 1 ? '' : 's'} overdue`, refreshMs: 60_000, state: 'over', end };
  }

  const state = left < HOUR ? 'soon' : 'running';
  if (t.unit === 'months') {
    // Whole months still to go, counting the one in progress ("2 months left"
    // right after setting 2); the last month switches to days.
    let months = 0;
    while (months < 1200 && addMonths(now, months) < end) months++;
    if (months > 1) return { text: `${months} months left`, refreshMs: 60_000, state, end };
  }
  if (!seconds && left >= DAY) {
    const days = Math.max(1, Math.round(left / DAY));
    return { text: `${days} day${days === 1 ? '' : 's'} left`, refreshMs: 60_000, state, end };
  }
  if (seconds) return { text: clock(left), refreshMs: 1000, state, end };
  return { text: `${clock(left, false)} left`, refreshMs: 15_000, state, end };
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
