// MV3 service worker: every DevDeck alert that has to reach you while you're
// not looking at a DevDeck tab — even when DevDeck is closed.
//
//   • Scheduled reminders (Currently processing / Queue): the page mirrors the
//     items into chrome.storage.local; one chrome.alarms alarm per item.
//   • To-do due times and timers: the page mirrors the upcoming alert events;
//     one alarm per event.
//   • Snoozes from an alert shown on another website.
//
// deliver() picks where an alert appears:
//   1. a visible DevDeck tab shows it itself (it answers our message);
//   2. otherwise the top alert panel is drawn on the website you're viewing
//      (chrome.scripting into the active tab of the focused Chrome window);
//   3. otherwise — Chrome's own pages (chrome://…, the Web Store), PDF viewer,
//      or Chrome not in front — a system notification.

import { nextFireTime } from './lib/schedule';
import { REMINDERS_STORAGE_KEY, type ReminderItem } from './lib/reminders-shared';
import { ALERT_EVENTS_KEY, ALERT_THEME_KEY, PENDING_ACTIONS_KEY, notificationText, reminderAlert, type AlertData, type AlertEvent } from './lib/alertEvents';
import { renderAlertOverlay, type OverlayTheme } from './lib/alertOverlay';
import type { ProcessingItem } from './types';

// Minimal typings for the chrome.* APIs used here (no @types/chrome needed).
interface Alarm {
  name: string;
  scheduledTime?: number;
}
declare const chrome: {
  alarms: {
    create(name: string, info: { when: number }): void;
    clearAll(): Promise<boolean>;
    getAll(): Promise<Alarm[]>;
    clear(name: string): Promise<boolean>;
    onAlarm: { addListener(cb: (a: Alarm) => void): void };
  };
  notifications: {
    create(id: string, opts: { type: 'basic'; iconUrl: string; title: string; message: string }): void;
    clear(id: string): void;
    onClicked: { addListener(cb: (id: string) => void): void };
  };
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(v: Record<string, unknown>): Promise<void>;
    };
    onChanged: { addListener(cb: (changes: Record<string, unknown>, area: string) => void): void };
  };
  tabs: {
    create(opts: { url: string }): void;
    query(q: { active: boolean; windowId: number }): Promise<Array<{ id?: number; url?: string }>>;
  };
  windows: { getLastFocused(): Promise<{ id?: number; focused: boolean }> };
  scripting: {
    executeScript(o: { target: { tabId: number }; func: (...a: never[]) => unknown; args: unknown[] }): Promise<unknown>;
  };
  runtime: {
    getURL(path: string): string;
    sendMessage(msg: unknown): Promise<unknown>;
    onMessage: { addListener(cb: (msg: { type?: string; action?: string; alert?: AlertData; host?: string }, sender: unknown, reply: (r: unknown) => void) => boolean | void): void };
    onInstalled: { addListener(cb: () => void): void };
    onStartup: { addListener(cb: () => void): void };
  };
};

const ALARM_PREFIX = 'devdeck:'; // scheduled reminders (item id)
const EVENT_PREFIX = 'devdeck-ev:'; // to-do / timer events (alert key)
const SNOOZE_PREFIX = 'devdeck-snz:'; // snoozes (alert key)
const SNOOZES_KEY = 'devdeck:bg-snoozes';
const SNOOZE_MS = 10 * 60_000;
const NOTE_PREFIX = 'devdeck-note:';

// ---- scheduling -----------------------------------------------------------

async function loadItems(): Promise<ReminderItem[]> {
  const got = await chrome.storage.local.get(REMINDERS_STORAGE_KEY);
  const items = got[REMINDERS_STORAGE_KEY];
  return Array.isArray(items) ? (items as ReminderItem[]) : [];
}
async function loadEvents(): Promise<AlertEvent[]> {
  const got = await chrome.storage.local.get(ALERT_EVENTS_KEY);
  const ev = got[ALERT_EVENTS_KEY];
  return Array.isArray(ev) ? (ev as AlertEvent[]) : [];
}
async function loadSnoozes(): Promise<Array<{ until: number; alert: AlertData }>> {
  const got = await chrome.storage.local.get(SNOOZES_KEY);
  const s = got[SNOOZES_KEY];
  return Array.isArray(s) ? (s as Array<{ until: number; alert: AlertData }>) : [];
}

function scheduleItem(item: ReminderItem): void {
  const next = nextFireTime(item.schedule, new Date());
  if (next) chrome.alarms.create(ALARM_PREFIX + item.id, { when: next.getTime() });
}

async function clearPrefix(prefix: string) {
  for (const a of await chrome.alarms.getAll()) if (a.name.startsWith(prefix)) await chrome.alarms.clear(a.name);
}

async function rescheduleReminders(): Promise<void> {
  await clearPrefix(ALARM_PREFIX);
  (await loadItems()).forEach(scheduleItem);
}
async function rescheduleEvents(): Promise<void> {
  await clearPrefix(EVENT_PREFIX);
  const now = Date.now();
  for (const e of await loadEvents()) if (e.at > now) chrome.alarms.create(EVENT_PREFIX + e.data.key, { when: e.at });
}
async function rescheduleSnoozes(): Promise<void> {
  await clearPrefix(SNOOZE_PREFIX);
  for (const s of await loadSnoozes()) chrome.alarms.create(SNOOZE_PREFIX + s.alert.key, { when: Math.max(Date.now() + 1000, s.until) });
}
const rescheduleAll = () => Promise.all([rescheduleReminders(), rescheduleEvents(), rescheduleSnoozes()]);

chrome.runtime.onInstalled.addListener(() => void rescheduleAll());
chrome.runtime.onStartup.addListener(() => void rescheduleAll());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (REMINDERS_STORAGE_KEY in changes) void rescheduleReminders();
  if (ALERT_EVENTS_KEY in changes) void rescheduleEvents();
});

// ---- delivery -------------------------------------------------------------

async function shownInDevDeckTab(alert: AlertData, reminder?: { id: string; at: number }): Promise<boolean> {
  try {
    const res = (await chrome.runtime.sendMessage(
      reminder ? { type: 'devdeck:reminder-due', id: reminder.id, at: reminder.at } : { type: 'devdeck:alert-due', alert },
    )) as { shown?: boolean } | undefined;
    return !!res?.shown;
  } catch {
    return false; // no DevDeck tab is open and in view
  }
}

async function theme(): Promise<OverlayTheme> {
  const got = await chrome.storage.local.get(ALERT_THEME_KEY);
  const t = got[ALERT_THEME_KEY] as OverlayTheme | undefined;
  return t?.accent ? t : { accent: '#ec4899', light: false };
}

async function shownOnCurrentSite(alert: AlertData): Promise<boolean> {
  try {
    const win = await chrome.windows.getLastFocused();
    if (!win?.focused || win.id === undefined) return false; // Chrome isn't in front
    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    if (tab?.id === undefined) return false;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: renderAlertOverlay as (...a: never[]) => unknown, args: [alert, await theme()] });
    return true;
  } catch {
    return false; // chrome:// page, Web Store, PDF viewer… — extensions can't draw there
  }
}

function notify(alert: AlertData) {
  const { title, message } = notificationText(alert);
  chrome.notifications.create(NOTE_PREFIX + alert.key, { type: 'basic', iconUrl: 'icons/icon-128.png', title, message });
}

const lastNote = new Map<string, AlertData>();
async function deliver(alert: AlertData, reminder?: { id: string; at: number }) {
  if (await shownInDevDeckTab(alert, reminder)) return;
  if (await shownOnCurrentSite(alert)) return;
  lastNote.set(NOTE_PREFIX + alert.key, alert);
  notify(alert);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const at = alarm.scheduledTime ?? Date.now();
  if (alarm.name.startsWith(EVENT_PREFIX)) {
    const key = alarm.name.slice(EVENT_PREFIX.length);
    const ev = (await loadEvents()).find((e) => e.data.key === key);
    if (ev) await deliver(ev.data);
    return;
  }
  if (alarm.name.startsWith(SNOOZE_PREFIX)) {
    const key = alarm.name.slice(SNOOZE_PREFIX.length);
    const all = await loadSnoozes();
    const s = all.find((x) => x.alert.key === key);
    await chrome.storage.local.set({ [SNOOZES_KEY]: all.filter((x) => x.alert.key !== key) });
    if (s) await deliver({ ...s.alert, key: `${s.alert.key}:snoozed:${s.until}` });
    return;
  }
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const id = alarm.name.slice(ALARM_PREFIX.length);
  const item = (await loadItems()).find((i) => i.id === id);
  if (!item) return;
  const data = reminderAlert({ ...item, section: item.section ?? '' } as Pick<ProcessingItem, 'id' | 'name' | 'url' | 'section' | 'schedule'>, at);
  await deliver(data, { id: item.id, at });
  scheduleItem(item); // the next occurrence
});

// ---- actions --------------------------------------------------------------

const devdeckUrl = (todoId?: string) => chrome.runtime.getURL('index.html') + (todoId ? `#todo=${todoId}` : '');

async function act(action: string, alert: AlertData) {
  if (action === 'open') {
    chrome.tabs.create({ url: alert.url ?? devdeckUrl(alert.todoId) });
  } else if (action === 'snooze') {
    const all = (await loadSnoozes()).filter((x) => x.alert.key !== alert.key);
    const until = Date.now() + SNOOZE_MS;
    all.push({ until, alert });
    await chrome.storage.local.set({ [SNOOZES_KEY]: all });
    chrome.alarms.create(SNOOZE_PREFIX + alert.key, { when: until });
  } else if (action === 'done' && alert.todoId) {
    // An open DevDeck tab completes it now; otherwise on the next open.
    let ok = false;
    try {
      ok = !!((await chrome.runtime.sendMessage({ type: 'devdeck:complete-todo', id: alert.todoId })) as { ok?: boolean } | undefined)?.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      const got = await chrome.storage.local.get(PENDING_ACTIONS_KEY);
      const list = (got[PENDING_ACTIONS_KEY] as Array<{ type: string; id: string }>) ?? [];
      list.push({ type: 'done', id: alert.todoId });
      await chrome.storage.local.set({ [PENDING_ACTIONS_KEY]: list });
    }
  }
}

// Site icons for the page: fetched here so a missing icon never shows up as a
// failed request in DevDeck's own console. Returned as a data: URL.
async function faviconData(host: string): Promise<{ ok: boolean; data?: string }> {
  try {
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`);
    if (!res.ok) return { ok: false };
    const type = res.headers.get('content-type') ?? 'image/png';
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { ok: true, data: `data:${type};base64,${btoa(bin)}` };
  } catch {
    return { ok: false };
  }
}

// Network requests for the page (feeds, GitHub, weather, suggestions): made
// here so a refused request never shows up as an error in DevDeck's console.
async function proxyFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) {
  if (!/^https?:/i.test(url)) return { status: 0, error: 'Only web requests can be proxied' };
  try {
    const res = await fetch(url, { method: init.method ?? 'GET', headers: init.headers, body: init.body });
    return { status: res.status, statusText: res.statusText, headers: [...res.headers.entries()], body: await res.text() };
  } catch (e) {
    return { status: 0, error: e instanceof Error ? e.message : 'Network request failed' };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'devdeck:overlay-action' && msg.action && msg.alert) void act(msg.action, msg.alert);
  if (msg?.type === 'devdeck:fetch' && (msg as { url?: string }).url) {
    const m = msg as { url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } };
    void proxyFetch(m.url, m.init ?? {}).then(reply);
    return true; // answer asynchronously
  }
  if (msg?.type === 'devdeck:favicon' && (msg as { host?: string }).host) {
    void faviconData((msg as { host: string }).host).then(reply);
    return true; // answer asynchronously
  }
  return false;
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const alert = lastNote.get(notificationId);
  if (alert) void act('open', alert);
  else if (notificationId.startsWith(ALARM_PREFIX)) {
    const item = (await loadItems()).find((i) => ALARM_PREFIX + i.id === notificationId);
    if (item) chrome.tabs.create({ url: item.url });
  }
  chrome.notifications.clear(notificationId);
});
