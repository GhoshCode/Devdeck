// React-free alert logic, shared by the DevDeck page and the extension's
// service worker (which shows alerts on other websites even when DevDeck is
// closed). Decides WHAT is due and WHEN; never touches the DOM or storage.

import { FIRST_SECTION, type ProcessingItem, type Todo } from '../types';
import { describeSchedule, nextFireTime } from './schedule';
import { describeTimer, timerEnd } from './timer';
import { dueTimestamp } from './todos';
import { getHostname } from '../utils';

export type AlertKind = 'processing' | 'queue' | 'todo' | 'overdue';

export interface AlertData {
  key: string;
  kind: AlertKind;
  title: string;
  sub?: string;
  eyebrow?: string;
  url?: string;
  itemId?: string; // processing item
  todoId?: string;
  priority?: 0 | 1 | 2 | 3;
  counts?: { todos: number; queue: number; processing: number };
  list?: string[]; // overdue summary: a few names
}

export type AlertEvent = { at: number; data: AlertData; reminder?: boolean };

// chrome.storage.local keys the page mirrors for the service worker.
export const ALERT_EVENTS_KEY = 'devdeck:alert-events'; // upcoming to-do / timer alerts
export const ALERT_THEME_KEY = 'devdeck:alert-theme'; // { accent, light } for the overlay
export const PENDING_ACTIONS_KEY = 'devdeck:pending-actions'; // e.g. "mark done" while DevDeck was closed

export const OVERDUE_EVERY = 30 * 60_000;

export function reminderAlert(item: Pick<ProcessingItem, 'id' | 'name' | 'url' | 'section' | 'schedule'>, at: number): AlertData {
  const processing = item.section === FIRST_SECTION;
  return {
    key: `rem:${item.id}:${at}`,
    kind: processing ? 'processing' : 'queue',
    title: item.name,
    sub: `${describeSchedule(item.schedule)} · ${getHostname(item.url)}`,
    url: item.url,
    itemId: item.id,
  };
}

const prioLabel = (p?: number) => (p === 1 ? ' · P1' : p === 2 ? ' · P2' : p === 3 ? ' · P3' : '');
const subFor = (t: Todo, lead: string) => [lead, ...(t.tags ?? []).slice(0, 3).map((x) => `#${x}`)].join(' · ');

export function upcomingEvents(processing: readonly ProcessingItem[], todos: readonly Todo[], now: number): AlertEvent[] {
  const out: AlertEvent[] = [];
  for (const p of processing) {
    if (p.schedule?.enabled) {
      const next = nextFireTime(p.schedule, new Date(now));
      if (next) out.push({ at: next.getTime(), data: reminderAlert(p, next.getTime()), reminder: true });
    }
    if (p.timer) {
      const end = timerEnd(p.timer);
      if (end > now)
        out.push({
          at: end,
          data: {
            key: `timer:p:${p.id}:${end}`,
            kind: p.section === FIRST_SECTION ? 'processing' : 'queue',
            eyebrow: `${p.section === FIRST_SECTION ? 'CURRENTLY PROCESSING' : 'QUEUE'} · TIMER ENDED`,
            title: p.name,
            sub: `${describeTimer(p.timer)} timer is up · ${getHostname(p.url)}`,
            url: p.url,
            itemId: p.id,
          },
        });
    }
  }
  for (const t of todos) {
    if (t.archivedAt !== null) continue;
    if (t.dueDate && t.dueTime) {
      const at = dueTimestamp(t)!;
      if (at > now)
        out.push({
          at,
          data: { key: `due:${t.id}:${at}`, kind: 'todo', eyebrow: `TO-DO DUE${prioLabel(t.priority)}`, title: t.text, sub: subFor(t, `Due ${t.dueTime} today`), todoId: t.id, priority: t.priority },
        });
    }
    if (t.timer) {
      const end = timerEnd(t.timer);
      if (end > now)
        out.push({
          at: end,
          data: { key: `timer:t:${t.id}:${end}`, kind: 'todo', eyebrow: `TO-DO · TIMER ENDED${prioLabel(t.priority)}`, title: t.text, sub: subFor(t, `${describeTimer(t.timer)} timer is up`), todoId: t.id, priority: t.priority },
        });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function overdueSummary(processing: readonly ProcessingItem[], todos: readonly Todo[], now: number): AlertData | null {
  const lateTodos = todos.filter((t) => t.archivedAt === null && ((dueTimestamp(t) ?? Infinity) < now || (t.timer && timerEnd(t.timer) < now)));
  const lateItems = processing.filter((p) => p.timer && timerEnd(p.timer) < now);
  const proc = lateItems.filter((p) => p.section === FIRST_SECTION);
  const queue = lateItems.filter((p) => p.section !== FIRST_SECTION);
  const total = lateTodos.length + lateItems.length;
  if (!total) return null;
  return {
    key: `overdue:${Math.floor(now / OVERDUE_EVERY)}`,
    kind: 'overdue',
    title: `${total} overdue`,
    counts: { todos: lateTodos.length, queue: queue.length, processing: proc.length },
    list: [...lateTodos.map((t) => t.text), ...lateItems.map((p) => p.name)].slice(0, 4),
  };
}

// Title / body for a system notification (where no page can show the panel).
export function notificationText(d: AlertData): { title: string; message: string } {
  if (d.kind === 'todo') return { title: d.title, message: d.sub ?? 'To-do' };
  if (d.kind === 'overdue') return { title: `You have ${d.title} items`, message: (d.list ?? []).join(' · ') };
  return { title: `Time to work on ${d.title}`, message: d.sub ?? '' };
}
