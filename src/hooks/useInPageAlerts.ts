import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { isExtension } from '../lib/env';
import {
  ALERT_EVENTS_KEY,
  ALERT_THEME_KEY,
  OVERDUE_EVERY,
  PENDING_ACTIONS_KEY,
  notificationText,
  overdueSummary,
  reminderAlert,
  upcomingEvents,
  type AlertData,
} from '../lib/alertEvents';
import { pushAlert, takeDueSnoozes, wasSeen } from '../components/ui/alertStore';
import { ALERT_PREFS_KEY, alertPrefs } from '../lib/alertPrefs';

export { overdueSummary, upcomingEvents, reminderAlert } from '../lib/alertEvents';

// Decides WHEN the alerts appear (the WHAT lives in lib/alertEvents.ts):
//   • a Currently processing / Queue reminder time arrives
//   • a to-do's due date-time arrives
//   • a to-do / Queue / Currently processing timer runs out
//   • on opening a tab: one overdue summary (at most every 30 min)
// Where they appear:
//   • a visible DevDeck tab shows the top panel itself;
//   • extension, DevDeck not in view (or closed): the service worker drops the
//     same top panel onto the website you're viewing, or — on pages extensions
//     can't draw on (chrome:// pages, the Web Store) or with Chrome in the
//     background — sends a system notification. The worker asks a visible
//     DevDeck tab first, so nothing shows twice;
//   • website build: a system Notification when the tab is hidden.

const MAX_WAIT = 60 * 60_000;
const OVERDUE_KEY = 'devdeck.alerts.overdueAt';
const MIRROR_DAYS = 35;

const visible = () => typeof document !== 'undefined' && document.visibilityState === 'visible';

interface ChromeLike {
  storage?: { local?: { set(v: Record<string, unknown>): Promise<void>; get(k: string): Promise<Record<string, unknown>>; remove(k: string): Promise<void> } };
  runtime?: { onMessage?: { addListener: (fn: OnMsg) => void; removeListener: (fn: OnMsg) => void } };
}
type OnMsg = (msg: { type?: string; id?: string; at?: number; alert?: AlertData }, sender: unknown, reply: (r: unknown) => void) => boolean | void;
const chromeApi = () => (globalThis as { chrome?: ChromeLike }).chrome;

// Website build only: a system notification while the tab is hidden.
function notifyWeb(d: AlertData) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const { title, message } = notificationText(d);
  new Notification(title, { body: message, tag: `devdeck:${d.key}`, icon: 'icons/icon-128.png' });
}

export function useInPageAlerts() {
  const processing = useStore((s) => s.processing);
  const todos = useStore((s) => s.todos);
  const events = useStore((s) => s.events);
  // Settings → Notifications: pop-ups (in-page and on other sites) and Chrome notifications.
  const popups = useStore((s) => alertPrefs(s.settings).popups);
  const chromeOn = useStore((s) => alertPrefs(s.settings).chrome);
  const lastCheck = useRef(Date.now());
  const ext = isExtension();

  // Fire events as their time comes (in view: the top panel here).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const plan = () => {
      const now = Date.now();
      const fired = upcomingEvents(processing, todos, lastCheck.current - 1, events).filter((e) => e.at > lastCheck.current - 1 && e.at <= now + 250);
      lastCheck.current = now;
      for (const e of fired) {
        if (visible()) {
          if (popups) pushAlert(e.data);
          else if (chromeOn && !wasSeen(e.data.key)) notifyWeb(e.data);
        } else if (!ext) {
          if (chromeOn && !wasSeen(e.data.key)) notifyWeb(e.data);
          if (popups) pushAlert(e.data); // remembered; still in the stack if you come back soon
        }
        // extension + not in view: the service worker shows it on the site you're on
      }
      for (const d of takeDueSnoozes(now).due) {
        if (visible() && popups) pushAlert(d, true);
        else if (chromeOn && (visible() || !ext)) notifyWeb(d);
      }
      const next = upcomingEvents(processing, todos, now, events)[0]?.at ?? null;
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
  }, [processing, todos, events, ext, popups, chromeOn]);

  // Extension: give the service worker the upcoming to-do / timer alerts (it
  // already has the scheduled reminders) and the theme colours for the overlay.
  useEffect(() => {
    const storage = chromeApi()?.storage?.local;
    if (!ext || !storage) return;
    const now = Date.now();
    const upcoming = upcomingEvents(processing, todos, now, events).filter((e) => !e.reminder && e.at < now + MIRROR_DAYS * 864e5).slice(0, 200);
    void storage.set({ [ALERT_EVENTS_KEY]: upcoming });
  }, [processing, todos, events, ext]);
  useEffect(() => {
    const storage = chromeApi()?.storage?.local;
    if (!ext || !storage) return;
    void storage.set({ [ALERT_PREFS_KEY]: { popups, chrome: chromeOn } });
  }, [ext, popups, chromeOn]);
  useEffect(() => {
    const storage = chromeApi()?.storage?.local;
    if (!ext || !storage) return;
    const push = () => {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#ec4899';
      const light = document.documentElement.dataset.theme === 'light';
      void storage.set({ [ALERT_THEME_KEY]: { accent, light } });
    };
    push();
    const mo = new MutationObserver(push);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    return () => mo.disconnect();
  }, [ext]);

  // Extension: actions taken on an alert shown on another website.
  useEffect(() => {
    const api = chromeApi();
    if (!ext || !api?.runtime?.onMessage) return;
    // "Mark done" pressed while DevDeck was closed waits here until it opens.
    void api.storage?.local?.get(PENDING_ACTIONS_KEY).then((got) => {
      const list = (got?.[PENDING_ACTIONS_KEY] as Array<{ type: string; id: string }>) ?? [];
      if (!list.length) return;
      const st = useStore.getState();
      for (const a of list) if (a.type === 'done' && st.todos.some((t) => t.id === a.id && t.archivedAt === null)) st.completeTodo(a.id);
      void api.storage?.local?.remove(PENDING_ACTIONS_KEY);
    });
    // Opened from an alert's "Open" on a to-do: show it.
    const m = /#todo=([\w-]+)/.exec(location.hash);
    if (m) {
      setTimeout(() => window.dispatchEvent(new CustomEvent('devdeck:show-todo', { detail: { id: m[1] } })), 900);
      history.replaceState(null, '', location.pathname + location.search);
    }
    const onMsg: OnMsg = (msg, _sender, reply) => {
      if (msg?.type === 'devdeck:complete-todo' && msg.id) {
        useStore.getState().completeTodo(msg.id);
        reply({ ok: true });
        return;
      }
      if (!visible()) return; // only a DevDeck tab you're looking at answers
      if (!alertPrefs(useStore.getState().settings).popups) return; // pop-ups off: the worker sends a Chrome notification instead
      if (msg?.type === 'devdeck:alert-due' && msg.alert) {
        pushAlert(msg.alert); // the page's own timer may have shown it already — either way it's on screen
        reply({ shown: true });
        return;
      }
      if (msg?.type === 'devdeck:reminder-due' && msg.id && msg.at) {
        const item = useStore.getState().processing.find((p) => p.id === msg.id);
        if (!item) return;
        pushAlert(reminderAlert(item, msg.at));
        reply({ shown: true });
      }
    };
    api.runtime.onMessage.addListener(onMsg);
    return () => api.runtime!.onMessage!.removeListener(onMsg);
  }, [ext]);

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
      const prefs = alertPrefs(s.settings);
      if (prefs.popups) pushAlert(summary);
      else if (prefs.chrome) notifyWeb(summary);
    }, 1500);
    return () => clearTimeout(t);
  }, []);
}
