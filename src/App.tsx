import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ProcessingPanel } from './components/processing/ProcessingPanel';
import { useReminderMirror, useWebReminders } from './lib/reminders';
import { skinFor } from './lib/skin';
import { switchModePatch } from './lib/appearance';
import { withThemeTransition } from './lib/themeTransition';
import { Backdrop } from './components/Backdrop';
import { CategoryGrid } from './components/CategoryGrid';
import { TopBar } from './components/topbar/TopBar';
import { WeatherUV } from './components/topbar/WeatherUV';
import { CommandPrompt } from './components/topbar/CommandPrompt';
import { GitWidget } from './components/topbar/GitWidget';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { FeedColumn } from './components/feeds/FeedColumn';
import { SearchBar } from './components/search/SearchBar';
import { BookmarkButton } from './components/search/BookmarkDrawer';
import { SiteMapButton } from './components/search/SiteMapModal';
import { LinksStrip } from './components/links/LinksStrip';
import SettingsModal, { type SettingsTabId } from './components/settings/SettingsModal';
import { useStore } from './store';

export default function App() {
  const accentColor = useStore((s) => s.settings.accentColor);

  const searchRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>('library');
  const [settingsPrefill, setSettingsPrefill] = useState('');

  const openSettings = (tab: SettingsTabId = 'library', prefill = '') => {
    setSettingsPrefill(prefill);
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };


  const themeMode = useStore((s) => s.settings.themeMode ?? 'dark');
  const processing = useStore((s) => s.processing);
  useReminderMirror(processing);
  useWebReminders(processing);

  const skin = useStore((s) => skinFor(s.settings));

  // Dynamically update root accent variable, theme and skin attributes
  // (layout effect: it must land inside a theme View Transition — see
  // lib/themeTransition.ts)
  useLayoutEffect(() => {
    const html = document.documentElement;
    const switching = html.getAttribute('data-theme') !== themeMode || (html.getAttribute('data-skin') ?? null) !== skin;
    // A theme switch restyles thousands of elements; letting each one run its
    // own colour transition turns that into ~300ms of janky frames. Suspend
    // transitions for the switch itself (index.css: .theme-switching).
    if (switching) html.classList.add('theme-switching');
    if (accentColor) {
      html.style.setProperty('--color-accent', accentColor);
      html.style.setProperty('--user-accent', accentColor);
    }
    html.setAttribute('data-theme', themeMode);
    if (skin) html.setAttribute('data-skin', skin);
    else html.removeAttribute('data-skin');
    if (!switching) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => html.classList.remove('theme-switching'));
    });
    return () => {
      cancelAnimationFrame(raf);
      html.classList.remove('theme-switching');
    };
  }, [accentColor, themeMode, skin]);

  // Appearance → Auto: follow the OS light/dark setting, live.
  const followSystem = useStore((s) => !!s.settings.followSystem);
  useEffect(() => {
    if (!followSystem || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const st = useStore.getState();
      const patch = switchModePatch(st.settings, mq.matches ? 'dark' : 'light');
      if (Object.keys(patch).length) withThemeTransition(() => st.updateSettings(patch));
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [followSystem]);

  const reduceTransparency = useStore((s) => !!s.settings.reduceTransparency);
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-reduce-transparency', reduceTransparency);
  }, [reduceTransparency]);

  // Appearance → Panel glass: custom opacity / blur override the theme's glass.
  const panelSolidity = useStore((s) => s.settings.panelSolidity ?? 0);
  const panelBlur = useStore((s) => s.settings.panelBlur);
  useLayoutEffect(() => {
    const html = document.documentElement;
    const custom = panelSolidity > 0 || panelBlur !== undefined;
    html.toggleAttribute('data-glass-custom', custom);
    html.style.setProperty('--glass-solid', `${panelSolidity}%`);
    html.style.setProperty('--glass-blur', `${panelBlur ?? 16}px`);
  }, [panelSolidity, panelBlur]);

  // Ensure active deck always contains 10+ categories and 200+ sites
  useEffect(() => {
    const st = useStore.getState();
    if (st.categories.length < 10) {
      st.reseedLibrary();
    }
  }, []);

  // Global hotkeys (§7 Q4): Ctrl/⌘+K and "/" focus the search bar; "," opens
  // Settings; Escape closes Settings.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === '/' && !isInput && !isSettingsOpen) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === ',' && !isInput && !isSettingsOpen) {
        e.preventDefault();
        openSettings();
      } else if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen]);

  const settingsButton = (
    <button
      type="button"
      onClick={() => openSettings('library')}
      title="Open Settings (,)"
      aria-label="Settings"
      className="glass-raised group flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-white/60 shadow-xl backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/10 hover:text-white border border-white/15"
    >
      <svg
        className="size-5 transition-transform duration-500 group-hover:rotate-90"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );

  return (
    <>
      <Backdrop />
      <DashboardLayout
        topBar={
          <TopBar
            weather={<WeatherUV onSetup={() => openSettings('profile')} />}
            search={
              <div className="mx-auto flex w-full max-w-[780px] items-center gap-2">
                <SearchBar inputRef={searchRef} onAddSite={(url) => openSettings('library', url)} />
                <SiteMapButton />
                <BookmarkButton />
              </div>
            }
            git={<GitWidget />}
            command={<CommandPrompt onSetup={() => openSettings('profile')} />}
          />
        }
        left={<ProcessingPanel />}
        leftFooter={settingsButton}
        center={
          <div data-testid="center-frame" className="glass flex h-full min-h-0 flex-col overflow-hidden">
            <LinksStrip />
            <div data-center-body className="flex min-h-0 flex-1 p-3">
              <CategoryGrid onOpenSettings={() => openSettings('library')} />
            </div>
          </div>
        }
        right={<FeedColumn onManage={() => openSettings('scraping')} />}
      />

      {/* Settings Overlay */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsTab}
        prefillUrl={settingsPrefill}
        onClearPrefill={() => setSettingsPrefill('')}
      />
    </>
  );
}
