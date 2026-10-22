// React-free alert logic, shared by the DevDeck page and the extension's
// service worker (which shows alerts on other websites even when DevDeck is
// closed). Decides WHAT is due and WHEN; never touches the DOM or storage.

import { FIRST_SECTION, type CalendarEvent, type EventCategory, type EventPriority, type ProcessingItem, type Todo } from '../types';
import { EVENT_CATEGORIES, countdown, eventSpan, fmtRange } from './calendar';
import { describeSchedule, nextFireTime } from './schedule';
import { describeTimer, timerEnd } from './timer';
import { dueTimestamp } from './todos';
import { getHostname } from '../utils';

// 'calendar' is the capsule alert for custom calendar events; the other four
// keep their own designs.
export type AlertKind = 'processing' | 'queue' | 'todo' | 'overdue' | 'calendar';

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
  // calendar events
  eventId?: string;
  date?: string; // 'YYYY-MM-DD' — "Jump to slot"
  startsAt?: number;
  endsAt?: number;
  category?: EventCategory;
  eventPriority?: EventPriority;
  // set by the stack: when it went up, and how many times the same site's
  // reminder has fired while it was up (one card with "×N" instead of N cards)
  shownAt?: number;
  repeat?: number;
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

export const CALENDAR_SNOOZE_MS = 5 * 60_000;

export function calendarAlert(e: CalendarEvent, h24 = true): AlertData {
  const { start, end } = eventSpan(e);
  const cat = EVENT_CATEGORIES.find((c) => c.id === e.category)?.label ?? 'Event';
  const who = e.attendees.length ? `${e.attendees.length} attendee${e.attendees.length === 1 ? '' : 's'}` : '';
  return {
    key: `cal:${e.id}:${start}:${e.remindMins ?? 'x'}`,
    kind: 'calendar',
    title: e.title,
    sub: [fmtRange(start, end, h24), e.location, who].filter(Boolean).join(' · '),
    eyebrow: cat.toUpperCase() + (e.priority === 'high' || e.priority === 'critical' ? ` · ${e.priority.toUpperCase()}` : ''),
    eventId: e.id,
    date: e.date,
    startsAt: start,
    endsAt: end,
    category: e.category,
    eventPriority: e.priority,
  };
}

const prioLabel = (p?: number) => (p === 1 ? ' · P1' : p === 2 ? ' · P2' : p === 3 ? ' · P3' : '');
const subFor = (t: Todo, lead: string) => [lead, ...(t.tags ?? []).slice(0, 3).map((x) => `#${x}`)].join(' · ');

export function upcomingEvents(processing: readonly ProcessingItem[], todos: readonly Todo[], now: number, events: readonly CalendarEvent[] = []): AlertEvent[] {
  const out: AlertEvent[] = [];
  for (const e of events) {
    if (e.remindMins === null) continue;
    const at = eventSpan(e).start - e.remindMins * 60_000;
    if (at > now) out.push({ at, data: calendarAlert(e) });
  }
  for (const p of processing) {
    // A due time set from the calendar uses the item's usual alert design.
    if (p.dueDate && p.dueTime) {
      const at = dueTimestamp({ dueDate: p.dueDate, dueTime: p.dueTime })!;
      const proc = p.section === FIRST_SECTION;
      if (at > now)
        out.push({
          at,
          data: {
            key: `pdue:${p.id}:${at}`,
            kind: proc ? 'processing' : 'queue',
            eyebrow: `${proc ? 'CURRENTLY PROCESSING' : 'QUEUE'} · DUE`,
            title: p.name,
            sub: `Due ${p.dueTime} · ${getHostname(p.url)}`,
            url: p.url,
            itemId: p.id,
          },
        });
    }
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
  if (d.kind === 'calendar') {
    const when = d.startsAt && d.endsAt ? countdown(d.startsAt, d.endsAt, Date.now()) : '';
    return { title: d.title, message: [when, d.sub].filter(Boolean).join(' · ') };
  }

  return { title: `Time to work on ${d.title}`, message: d.sub ?? '' };
}
