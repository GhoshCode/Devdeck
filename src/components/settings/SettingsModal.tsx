import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LibraryTab } from './LibraryTab';
import { SitemapTab } from './SitemapTab';
import { QuickLinksTab } from './QuickLinksTab';
import { AppearanceTab, ClockSettings, GreetingSettings } from './AppearanceTab';
import { ProcessingTab } from './ProcessingTab';
import { ScrapingTab } from './ScrapingTab';
import { DataTab } from './DataTab';
import { SearchSettings } from './SearchSettings';
import { AiProviderPicker } from './AiProviderPicker';
import { TerminalHelper } from './TerminalHelper';
import { NotificationSettings } from './NotificationSettings';
import { GitHubSettings, WeatherSettings } from './pages';

// Settings, grouped by what you're doing rather than by how DevDeck is built:
// General (you, clock, weather) · Look · Workspace (your sites and lists) ·
// Search · Stay informed (alerts, news) · Connections · Data. Each page is a
// stack of cards under one title and one line saying what it is for; "Find a
// setting" searches page names and the settings inside them.

export type SettingsTabId =
  | 'you'
  | 'clock'
  | 'weather'
  | 'appearance'
  | 'library'
  | 'sitemap'
  | 'quicklinks'
  | 'processing'
  | 'search'
  | 'notifications'
  | 'feeds'
  | 'github'
  | 'terminal'
  | 'data';

// Older links into Settings (kept so nothing that still says 'profile' breaks).
const LEGACY: Record<string, SettingsTabId> = { profile: 'you', scraping: 'feeds' };

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTabId | 'profile' | 'scraping';
  prefillUrl?: string;
  onClearPrefill?: () => void;
}

type Page = { id: SettingsTabId; label: string; title: string; description: string; keywords: string; icon: ReactNode; wide?: boolean };

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const GROUPS: ReadonlyArray<{ label: string; pages: Page[] }> = [
  {
    label: 'General',
    pages: [
      { id: 'you', label: 'You & greeting', title: 'You & greeting', description: 'Your name and how the dashboard greets you.', keywords: 'name greeting style font on this day quote', icon: icon('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0') },
      { id: 'clock', label: 'Clock', title: 'Clock', description: 'The clock face, time zones and time format.', keywords: 'clock face time zone 24-hour 12-hour seconds world time', icon: icon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2') },
      { id: 'weather', label: 'Weather & location', title: 'Weather & location', description: 'Temperature and UV index, and where they are for.', keywords: 'weather uv temperature city location geolocation source', icon: icon('M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7Z') },
    ],
  },
  {
    label: 'Look',
    pages: [
      { id: 'appearance', label: 'Appearance', title: 'Appearance', description: 'Light or dark, accent colour, themes, wallpaper and glass. Changes apply instantly.', keywords: 'theme dark light accent colour color wallpaper background gradient glass blur transparency', icon: icon('M12 21a9 9 0 1 1 0-18c5 0 9 3.6 9 8a4 4 0 0 1-4 4h-2a2 2 0 0 0-1 3.7A1.5 1.5 0 0 1 12 21ZM7.5 11h.01M12 7.5h.01M16.5 11h.01') },
    ],
  },
  {
    label: 'Workspace',
    pages: [
      { id: 'library', label: 'Library', title: 'Library', description: 'Your categories and sites — the cards in the centre of the dashboard.', keywords: 'categories sites subcategories add site primary pin', icon: icon('M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z'), wide: true },
      { id: 'sitemap', label: 'Site map', title: 'Site map', description: 'Every category and site as one map. Drag to rearrange.', keywords: 'site map hierarchy tree graph', icon: icon('M6 3v6M6 15v6M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18 6a3 3 0 1 0 0 .01M18 18a3 3 0 1 0 0 .01M9 12h3a3 3 0 0 0 3-3V8M12 12a3 3 0 0 1 3 3v1'), wide: true },
      { id: 'quicklinks', label: 'Quick links', title: 'Quick links', description: 'The bar under the search: five pinned links, then auto-picked and recent sites.', keywords: 'quick links pinned recent auto bar', icon: icon('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1') },
      { id: 'processing', label: 'Queue & processing', title: 'Queue & processing', description: "What you're working on now and what's lined up next, each with its own reminder.", keywords: 'queue currently processing reminders schedule sites timer', icon: icon('M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3'), wide: true },
    ],
  },
  {
    label: 'Search',
    pages: [
      { id: 'search', label: 'Search & AI', title: 'Search & AI', description: 'Which engine Enter searches, and which assistant Alt+Enter asks.', keywords: 'search engine google bing duckduckgo ai assistant gemini chatgpt claude perplexity', icon: icon('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4') },
    ],
  },
  {
    label: 'Stay informed',
    pages: [
      { id: 'notifications', label: 'Notifications', title: 'Notifications', description: 'How reminders and alerts reach you.', keywords: 'notifications alerts pop-ups chrome reminders', icon: icon('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0') },
      { id: 'feeds', label: 'News & jobs', title: 'News & jobs', description: 'Topics that filter the news and job columns, and where they come from.', keywords: 'news jobs feeds topics sources rss hacker news', icon: icon('M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4ZM8 8h8M8 12h8M8 16h5') },
    ],
  },
  {
    label: 'Connections',
    pages: [
      { id: 'github', label: 'GitHub', title: 'GitHub', description: 'Your contribution graph in the top bar.', keywords: 'github git commits contributions token username', icon: icon('M9 19c-4 1.5-4-2-6-2.5m12 5v-3.5a3 3 0 0 0-.9-2.4c3-.3 6.1-1.5 6.1-6.6a5 5 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.1-.3-3.6 1.4a12.4 12.4 0 0 0-6.5 0C6.1 1.6 5 1.9 5 1.9a4.8 4.8 0 0 0-.1 3.6 5 5 0 0 0-1.4 3.6c0 5.1 3.1 6.3 6.1 6.6a3 3 0 0 0-.9 2.4V22') },
      { id: 'terminal', label: 'Terminal', title: 'Terminal', description: 'One-time setup so the terminal box can open a real terminal on your computer.', keywords: 'terminal command prompt powershell helper native', icon: icon('M4 17l6-5-6-5M12 19h8') },
    ],
  },
  {
    label: 'Data',
    pages: [
      { id: 'data', label: 'Data & backup', title: 'Data & backup', description: 'Back up, restore or clean up what DevDeck keeps in this browser.', keywords: 'backup export import restore reset clear trash cache data', icon: icon('M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3ZM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5') },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.pages);

export default function SettingsModal({ isOpen, onClose, initialTab = 'library', prefillUrl = '', onClearPrefill }: SettingsModalProps) {
  const resolve = (t: string): SettingsTabId => LEGACY[t] ?? (t as SettingsTabId);
  const [active, setActive] = useState<SettingsTabId>(resolve(initialTab));
  const [find, setFind] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTab) setActive(resolve(initialTab));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 }); // (scrollTo may return a Promise: never hand it back as a clean-up)
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isOpen) return;
      if (document.querySelector('.dropdown-menu[role="listbox"]')) return; // a menu closes first
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const q = find.trim().toLowerCase();
  const matches = useMemo(() => (q ? ALL.filter((p) => `${p.label} ${p.title} ${p.description} ${p.keywords}`.toLowerCase().includes(q)) : null), [q]);
  const page = ALL.find((p) => p.id === active) ?? ALL[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.985, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="settings-shell relative z-10 flex h-[min(880px,94vh)] w-[min(1200px,100%)] overflow-hidden rounded-[22px] border max-md:flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="DevDeck Settings"
          >
            {/* Rail: find a setting, then the pages in their groups */}
            <aside className="settings-rail flex shrink-0 flex-col border-r max-md:max-h-[40%] max-md:border-r-0 max-md:border-b md:w-[252px]">
              <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                <span className="size-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
                <span className="font-display text-[15px] font-bold tracking-tight">Settings</span>
              </div>
              <div className="px-3 pb-2">
                <input
                  value={find}
                  onChange={(e) => setFind(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && matches?.[0]) {
                      setActive(matches[0].id);
                      setFind('');
                    }
                  }}
                  placeholder="Find a setting…"
                  aria-label="Find a setting"
                  className="set-field w-full rounded-xl border px-3 py-2 text-[12.5px] outline-none"
                />
              </div>
              <nav aria-label="Settings sections" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                {matches ? (
                  <div className="space-y-0.5 pt-1">
                    {matches.length === 0 && <p className="set-card-hint px-3 py-2 text-[12px]">Nothing matches “{find}”.</p>}
                    {matches.map((p) => (
                      <RailItem key={p.id} page={p} active={p.id === active} onClick={() => (setActive(p.id), setFind(''))} />
                    ))}
                  </div>
                ) : (
                  GROUPS.map((g) => (
                    <div key={g.label} className="pt-2.5">
                      <p className="set-group px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.14em] uppercase">{g.label}</p>
                      <div className="space-y-0.5">
                        {g.pages.map((p) => (
                          <RailItem key={p.id} page={p} active={p.id === active} onClick={() => setActive(p.id)} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </nav>
              <p className="set-card-hint border-t px-5 py-3 text-[11px] settings-rail-foot">Changes save automatically.</p>
            </aside>

            {/* Page: title, what it is for, then its cards */}
            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
              <header className="settings-head flex shrink-0 items-start justify-between gap-6 border-b px-8 pt-6 pb-5">
                <div className="min-w-0">
                  <h2 className="font-display text-[20px] font-semibold tracking-tight">{page.title}</h2>
                  <p className="set-card-hint mt-1 text-[13px]">{page.description}</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close Settings" title="Close (Esc)" className="set-btn flex size-9 shrink-0 items-center justify-center rounded-xl border">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </header>
              <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
                <div className={`mx-auto px-8 py-6 ${page.wide ? 'max-w-none' : 'max-w-[820px]'}`}>
                  {active === 'you' && <GreetingSettings />}
                  {active === 'clock' && <ClockSettings />}
                  {active === 'weather' && <WeatherSettings />}
                  {active === 'appearance' && <AppearanceTab />}
                  {active === 'library' && <LibraryTab initialPrefillUrl={prefillUrl} onClearPrefill={onClearPrefill} />}
                  {active === 'sitemap' && (
                    // the map sizes itself to its box: give it the page's full height
                    <div className="h-[calc(min(880px,94vh)-170px)] min-h-[460px]">
                      <SitemapTab />
                    </div>
                  )}
                  {active === 'quicklinks' && <QuickLinksTab />}
                  {active === 'processing' && <ProcessingTab />}
                  {active === 'search' && (
                    <div className="space-y-5">
                      <SearchSettings />
                      <AiProviderPicker />
                    </div>
                  )}
                  {active === 'notifications' && <NotificationSettings />}
                  {active === 'feeds' && <ScrapingTab />}
                  {active === 'github' && <GitHubSettings />}
                  {active === 'terminal' && <TerminalHelper />}
                  {active === 'data' && <DataTab />}
                </div>
              </div>
            </section>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function RailItem({ page, active, onClick }: { page: Page; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`set-rail-item flex w-full items-center gap-2.5 rounded-xl px-3 py-[7px] text-left text-[13px] font-medium ${active ? 'is-on' : ''}`}
    >
      <span className="set-rail-icon shrink-0">{page.icon}</span>
      <span className="truncate">{page.label}</span>
    </button>
  );
}
