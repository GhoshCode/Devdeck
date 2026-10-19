// DevDeck is the start page, so it never navigates away: every site, search
// and command opens in a new tab. In the extension, chrome.tabs.create is used
// (no popup blocker, even after an await); on the website, window.open.

interface ChromeTabs {
  tabs?: { create?: (p: { url: string; active?: boolean }) => unknown };
  windows?: { create?: (p: { url: string; focused?: boolean; type?: 'normal' | 'popup'; width?: number; height?: number }) => unknown };
}
const chromeApi = () => (globalThis as { chrome?: ChromeTabs }).chrome;

export function openInNewTab(url: string) {
  const create = chromeApi()?.tabs?.create;
  if (create) create({ url, active: true });
  else window.open(url, '_blank', 'noopener');
}

// A separate browser window (used when a site is dragged out of its panel).
export function openInNewWindow(url: string) {
  const create = chromeApi()?.windows?.create;
  if (create) create({ url, focused: true, type: 'normal' });
  else window.open(url, '_blank', `noopener,popup,width=${Math.round(screen.availWidth * 0.7)},height=${Math.round(screen.availHeight * 0.8)}`);
}
