import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import './fonts';
import './index.css';
import { useStore } from './store';

// Demo build (npm run build:demo): fill the deck with the sample Focus/Queue
// sites, to-dos, topics and feed sources once, on the first open. Remove them
// any time from Settings > Data > Remove demo data.
if (import.meta.env.MODE === 'demo') {
  try {
    if (!localStorage.getItem('devdeck-demo-autoloaded')) {
      useStore.getState().loadDemoData();
      localStorage.setItem('devdeck-demo-autoloaded', '1');
    }
  } catch {
    /* storage blocked: the Load demo data button still works */
  }
}

// 2.1 New tab: Chrome gives its address bar the cursor on a new-tab page and
// an extension can't take it back — but a tab it navigates itself focuses the
// page. So a fresh new tab reopens DevDeck once (?focus) and the search bar
// takes the cursor. Off in Settings → Profile → Search.
function focusNewTab(): boolean {
  type TabsApi = { tabs?: { getCurrent?: (cb: (t?: { id?: number }) => void) => void; update?: (id: number, p: { url: string }) => void }; runtime?: { getURL?: (p: string) => string } };
  const c = (globalThis as { chrome?: TabsApi }).chrome;
  if (!c?.tabs?.getCurrent || !c.runtime?.getURL || location.search.includes('focus')) return false;
  try {
    const saved = JSON.parse(localStorage.getItem('devdeck') ?? '{}') as { state?: { settings?: { newTabFocus?: boolean } } };
    if (saved.state?.settings?.newTabFocus === false) return false;
  } catch {
    // unreadable storage: keep the default (on)
  }
  if (history.length > 1) return false; // a reload or back/forward: leave the tab alone
  c.tabs.getCurrent((tab) => {
    if (tab?.id !== undefined) c.tabs!.update!(tab.id, { url: c.runtime!.getURL!('index.html?focus=1') + location.hash });
  });
  return true;
}
const reopening = focusNewTab();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// reducedMotion="user": every motion component honours the OS
// "reduce motion" setting (transforms off, opacity fades kept).
if (!reopening) createRoot(rootEl).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
