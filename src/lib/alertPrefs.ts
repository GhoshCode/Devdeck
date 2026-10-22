// Settings → Notifications: DevDeck's alert pop-ups (in-page and drawn on the
// site you're on) are on or off. Shared by the page and the extension's
// service worker. Chrome's built-in notifications are not used.

export interface AlertPrefs {
  popups: boolean;
}

export const ALERT_PREFS_KEY = 'devdeck:alert-prefs';

export function alertPrefs(s: { notifyPopups?: boolean }): AlertPrefs {
  return { popups: s.notifyPopups ?? true };
}
