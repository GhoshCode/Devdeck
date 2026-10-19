import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { FIRST_SECTION, type ProcessingItem, type Todo } from '../types';
import { nextFireTime, describeSchedule } from '../lib/schedule';
import { timerEnd, describeTimer } from '../lib/timer';
import { dueTimestamp } from '../lib/todos';
import { isExtension } from '../lib/env';
import { getHostname } from '../utils';
import { pushAlert, takeDueSnoozes, wasSeen, type AlertData } from '../components/ui/alertStore';

// Decides WHEN the glass alerts appear:
//   • a Currently processing / Queue reminder time arrives
//   • a to-do's due date-time arrives (date-only to-dos are covered by the
//     overdue summary instead)
//   • a to-do / Queue / Currently processing timer runs out
//   • on opening a tab: one summary if anything is overdue (at most every 30 min)
// While a DevDeck tab is visible the in-page alert is shown; otherwise a system
// notification. The extension's service worker asks visible tabs first, so a
// reminder is never shown twice.

const MAX_WAIT = 60 * 60_000;
const OVERDUE_EVERY = 30 * 60_000;
const OVERDUE_KEY = 'devdeck.alerts.overdueAt';

type Ev = { at: number; data: AlertData; reminder?: boolean };

const visible = () => typeof document !== 'undefined' && document.visibilityState === 'visible';

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

export function upcomingEvents(processing: readonly ProcessingItem[], todos: readonly Todo[], now: number): Ev[] {
  const out: Ev[] = [];
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

const subFor = (t: Todo, lead: string) => [lead, ...(t.tags ?? []).slice(0, 3).map((x) => `#${x}`)].join(' · ');

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

// A system notification for when no DevDeck tab is in view.
function notifySystem(d: AlertData) {
  const title = d.kind === 'todo' ? d.title : `Time to work on ${d.title}`;
  const body = d.sub ?? '';
  const chromeApi = (globalThis as { chrome?: { notifications?: { create: (id: string, o: object) => void } } }).chrome;
  if (isExtension() && chromeApi?.notifications) {
    chromeApi.notifications.create(`devdeck-alert:${d.key}`, { type: 'basic', iconUrl: 'icons/icon-128.png', title, message: body });
  } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, tag: `devdeck:${d.key}`, icon: 'icons/icon-128.png' });
  }
}

export function useInPageAlerts() {
  const processing = useStore((s) => s.processing);
  const todos = useStore((s) => s.todos);
  const lastCheck = useRef(Date.now());

  // Fire events as their time comes.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const plan = () => {
      const now = Date.now();
      // anything that came due since the last check (also after the laptop slept)
      const fired = upcomingEvents(processing, todos, lastCheck.current - 1).filter((e) => e.at > lastCheck.current - 1 && e.at <= now + 250);
      lastCheck.current = now;
      for (const e of fired) {
        if (visible()) pushAlert(e.data);
        else if (!wasSeen(e.data.key) && !(e.reminder && isExtension())) {
          // (extension reminders: the service worker sends the system notification)
          notifySystem(e.data);
          pushAlert(e.data); // remembered as seen; it'll be in the stack if you come back soon
        }
      }
      for (const d of takeDueSnoozes(now).due) {
        if (visible()) pushAlert(d, true);
        else notifySystem(d);
      }
      const next = upcomingEvents(processing, todos, now)[0]?.at ?? null;
      const snoozeNext = takeDueSnoozes(now).next;
      const at = Math.min(next ?? Infinity, snoozeNext ?? Infinity, now + MAX_WAIT);
      timer = setTimeout(plan, Math.max(250, at - now));
    };
    plan();
    const onVisible = () => {
      if (!visible()) return;
      clearTimeout(timer);
      plan();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [processing, todos]);

  // Overdue summary, once shortly after the tab opens (not more than every 30 min).
  useEffect(() => {
    const t = setTimeout(() => {
      if (!visible()) return;
      const now = Date.now();
      let last = 0;
      try {
        last = Number(localStorage.getItem(OVERDUE_KEY) ?? 0);
      } catch {
        // ignore
      }
      if (now - last < OVERDUE_EVERY) return;
      const s = useStore.getState();
      const summary = overdueSummary(s.processing, s.todos, now);
      if (!summary) return;
      try {
        localStorage.setItem(OVERDUE_KEY, String(now));
      } catch {
        // ignore
      }
      pushAlert(summary);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // Extension: the service worker asks before sending a system notification.
  useEffect(() => {
    const rt = (globalThis as { chrome?: { runtime?: { onMessage?: { addListener: Function; removeListener: Function } } } }).chrome?.runtime;
    if (!isExtension() || !rt?.onMessage) return;
    const onMsg = (msg: { type?: string; id?: string; at?: number }, _sender: unknown, reply: (r: unknown) => void) => {
      if (msg?.type !== 'devdeck:reminder-due' || !visible()) return false;
      const item = useStore.getState().processing.find((p) => p.id === msg.id);
      if (!item || !msg.at) return false;
      // the page's own timer may already have shown it — either way it's on screen
      pushAlert(reminderAlert(item, msg.at));
      reply({ shown: true });
      return false;
    };
    rt.onMessage.addListener(onMsg);
    return () => rt.onMessage!.removeListener(onMsg);
  }, []);
}
