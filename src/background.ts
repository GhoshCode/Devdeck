// MV3 service worker: Currently Processing reminders for the extension build
// (plan Phase 4). The new-tab page mirrors its items into chrome.storage.local
// (a service worker cannot read the page's localStorage); this worker keeps
// one chrome.alarms alarm per item and turns alarms into notifications.

import { nextFireTime } from './lib/schedule';
import { REMINDERS_STORAGE_KEY, type ReminderItem } from './lib/reminders-shared';

// Minimal typings for the chrome.* APIs used here (no @types/chrome needed).
interface Alarm {
  name: string;
}
declare const chrome: {
  alarms: {
    create(name: string, info: { when: number }): void;
    clearAll(): Promise<boolean>;
    onAlarm: { addListener(cb: (a: Alarm) => void): void };
  };
  notifications: {
    create(id: string, opts: { type: 'basic'; iconUrl: string; title: string; message: string }): void;
    clear(id: string): void;
    onClicked: { addListener(cb: (id: string) => void): void };
  };
  storage: {
    local: { get(key: string): Promise<Record<string, unknown>> };
    onChanged: { addListener(cb: (changes: Record<string, unknown>, area: string) => void): void };
  };
  tabs: { create(opts: { url: string }): void };
  runtime: {
    sendMessage(msg: unknown): Promise<unknown>;
    onInstalled: { addListener(cb: () => void): void };
    onStartup: { addListener(cb: () => void): void };
  };
};

const ALARM_PREFIX = 'devdeck:';

async function loadItems(): Promise<ReminderItem[]> {
  const got = await chrome.storage.local.get(REMINDERS_STORAGE_KEY);
  const items = got[REMINDERS_STORAGE_KEY];
  return Array.isArray(items) ? (items as ReminderItem[]) : [];
}

function scheduleItem(item: ReminderItem): void {
  const next = nextFireTime(item.schedule, new Date());
  if (next) chrome.alarms.create(ALARM_PREFIX + item.id, { when: next.getTime() });
}

async function rescheduleAll(): Promise<void> {
  await chrome.alarms.clearAll();
  (await loadItems()).forEach(scheduleItem);
}

chrome.runtime.onInstalled.addListener(() => void rescheduleAll());
chrome.runtime.onStartup.addListener(() => void rescheduleAll());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && REMINDERS_STORAGE_KEY in changes) void rescheduleAll();
});

// A visible DevDeck tab shows its own glass alert instead; only when none
// answers do we fall back to a system notification (never both).
async function shownInTab(id: string, at: number): Promise<boolean> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'devdeck:reminder-due', id, at })) as { shown?: boolean } | undefined;
    return !!res?.shown;
  } catch {
    return false; // no DevDeck tab open
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const id = alarm.name.slice(ALARM_PREFIX.length);
  const item = (await loadItems()).find((i) => i.id === id);
  if (!item) return;
  if (await shownInTab(item.id, (alarm as { scheduledTime?: number }).scheduledTime ?? Date.now())) {
    scheduleItem(item);
    return;
  }
  chrome.notifications.create(ALARM_PREFIX + item.id, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: `Time to work on ${item.name}`,
    message: item.url.replace(/^https?:\/\//, ''),
  });
  scheduleItem(item); // the next occurrence
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith(ALARM_PREFIX)) return;
  const item = (await loadItems()).find((i) => ALARM_PREFIX + i.id === notificationId);
  if (item) chrome.tabs.create({ url: item.url });
  chrome.notifications.clear(notificationId);
});
