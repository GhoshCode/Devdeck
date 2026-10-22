// In-page reminder alerts (the glass banners that drop from the top).
// Plain data only, so an alert can be persisted for Snooze and re-shown in a
// later tab. Keys de-duplicate across re-renders, reloads and other tabs.

import type { AlertData } from '../../lib/alertEvents';
export type { AlertData, AlertKind } from '../../lib/alertEvents';

export const SNOOZE_MS = 10 * 60_000;
const SEEN_KEY = 'devdeck.alerts.seen';
const SNOOZE_KEY = 'devdeck.alerts.snoozed';
const SEEN_TTL = 7 * 24 * 3600_000;

let alerts: AlertData[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const subscribeAlerts = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const getAlerts = () => alerts;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: alerts still work, they just aren't remembered
  }
}

export function wasSeen(key: string): boolean {
  const seen = read<Record<string, number>>(SEEN_KEY, {});
  return key in seen;
}
function markSeen(key: string) {
  const now = Date.now();
  const seen = read<Record<string, number>>(SEEN_KEY, {});
  seen[key] = now;
  for (const [k, t] of Object.entries(seen)) if (now - t > SEEN_TTL) delete seen[k];
  write(SEEN_KEY, seen);
}

// A site's reminder that fires again while its card is still up (every-minute
// and hourly reminders do) updates that card — "×N", timer restarted — rather
// than stacking another one.
const repeatOf = (a: AlertData) =>
  (a.kind === 'processing' || a.kind === 'queue') && a.itemId ? alerts.find((x) => x.kind === a.kind && x.itemId === a.itemId) : undefined;

// Shows an alert unless it's already up, or (without `force`) was shown before.
export function pushAlert(a: AlertData, force = false): boolean {
  if (alerts.some((x) => x.key === a.key)) return false;
  if (!force && wasSeen(a.key)) return false;
  markSeen(a.key);
  const same = repeatOf(a);
  if (same) {
    alerts = alerts.map((x) => (x === same ? { ...x, sub: a.sub ?? x.sub, repeat: (x.repeat ?? 1) + 1, shownAt: Date.now() } : x));
  } else {
    alerts = [{ ...a, shownAt: Date.now() }, ...alerts];
  }
  emit();
  return true;
}

// Several reminders up at once read as one card ("5 reminders now") that
// opens into the list; everything else stays its own card. The group sits
// where its newest member is.
export const GROUP_MIN = 3;
export type StackItem = { type: 'one'; a: AlertData } | { type: 'group'; key: string; members: AlertData[] };
export function stackItems(list: readonly AlertData[]): StackItem[] {
  const isReminder = (a: AlertData) => a.kind === 'processing' || a.kind === 'queue';
  const reminders = list.filter(isReminder);
  if (reminders.length < GROUP_MIN) return list.map((a) => ({ type: 'one', a }));
  const out: StackItem[] = [];
  let placed = false;
  for (const a of list) {
    if (!isReminder(a)) out.push({ type: 'one', a });
    else if (!placed) {
      out.push({ type: 'group', key: 'reminder-group', members: reminders });
      placed = true;
    }
  }
  return out;
}

export function dismissAlerts(keys: readonly string[]) {
  const drop = new Set(keys);
  if (!alerts.some((a) => drop.has(a.key))) return;
  alerts = alerts.filter((a) => !drop.has(a.key));
  emit();
}

export function dismissAlert(key: string) {
  if (!alerts.some((a) => a.key === key)) return;
  alerts = alerts.filter((a) => a.key !== key);
  emit();
}

// Every alert was marked seen when it was pushed, so cleared ones stay gone
// after a reload; pending snoozes are left alone.
export function clearAllAlerts() {
  if (!alerts.length) return;
  alerts = [];
  emit();
}

// ---- snooze: survives reloads; any open DevDeck tab re-shows it when due ----
type Snoozed = { until: number; data: AlertData };
export function snoozeAlert(a: AlertData, ms = SNOOZE_MS) {
  dismissAlert(a.key);
  const list = read<Snoozed[]>(SNOOZE_KEY, []).filter((s) => s.data.key !== a.key);
  list.push({ until: Date.now() + ms, data: a });

  write(SNOOZE_KEY, list);
}
// Due snoozes are taken out of storage (so only one tab shows them) and returned.
export function takeDueSnoozes(now = Date.now()): { due: AlertData[]; next: number | null } {
  const list = read<Snoozed[]>(SNOOZE_KEY, []);
  const due = list.filter((s) => s.until <= now).map((s) => s.data);
  const rest = list.filter((s) => s.until > now);
  if (due.length) write(SNOOZE_KEY, rest);
  return { due, next: rest.length ? Math.min(...rest.map((s) => s.until)) : null };
}

// Test helper.
export function _resetAlerts() {
  alerts = [];
  emit();
}
