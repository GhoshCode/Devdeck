// Settings → Notifications. "All notifications" on means both kinds are on
// (the two below it are shown ticked and locked); off lets each be chosen.
// Shared by the page and the extension's service worker.

export interface AlertPrefs {
  popups: boolean; // DevDeck's alert pop-ups: in-page and drawn on other websites
  chrome: boolean; // Chrome / system notifications
}

export const ALERT_PREFS_KEY = 'devdeck:alert-prefs';

export function alertPrefs(s: { notifyAll?: boolean; notifyChrome?: boolean; notifyPopups?: boolean }): AlertPrefs {
  const all = s.notifyAll ?? true;
  return { popups: all || (s.notifyPopups ?? true), chrome: all || (s.notifyChrome ?? true) };
}
