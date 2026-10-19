import { useDragOutToWindow } from './hooks/useDragOutToWindow';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ProcessingPanel } from './components/processing/ProcessingPanel';
import { useReminderMirror } from './lib/reminders';
import { useInPageAlerts } from './hooks/useInPageAlerts';
import { AlertCenter } from './components/ui/AlertCenter';
import { skinFor } from './lib/skin';
import { switchModePatch } from './lib/appearance';
import { withThemeTransition } from './lib/themeTransition';
import { Backdrop } from './components/Backdrop';
import { CategoryGrid } from './components/CategoryGrid';
import { CategoryMenuIcon, CategoryOverview } from './components/CategoryOverview';
import { UndoToast } from './components/ui/UndoToast';
import { LinkPeek } from './components/ui/LinkPeek';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { CogIcon } from './components/ui/icons';
import { TopBar } from './components/topbar/TopBar';
import { WeatherUV } from './components/topbar/WeatherUV';
import { DateLine } from './components/topbar/DateGreet';
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
  useDragOutToWindow();
  const accentColor = useStore((s) => s.settings.accentColor);

  const searchRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [overview, setOverview] = useState(false);
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
  useInPageAlerts(); // glass alerts in view, system notifications otherwise

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
      className="settings-orb group relative flex size-10 shrink-0 items-center justify-center rounded-xl"
    >
      <span aria-hidden className="settings-orb-ring absolute inset-0 rounded-xl" />
      <CogIcon className="relative size-[22px] transition-transform duration-500 group-hover:rotate-45" />
    </button>
  );

  return (
    <>
      <Backdrop />
      <DashboardLayout
        topBar={
          <TopBar
            weather={<WeatherUV onSetup={() => openSettings('profile')} lead={<DateLine />} />}
            search={
              <div className="relative mx-auto flex w-full max-w-[940px] items-center gap-2 lg:right-6">
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
        rightTop={<CommandPrompt onSetup={() => openSettings('profile')} />}
        center={
          <div className="flex h-full min-h-0 flex-col gap-3">
            {/* All categories stands on its own, left of the quick links + recent
                bar; it moves with the bar as the centre column resizes. */}
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setOverview((v) => !v)}
                aria-label="All categories"
                aria-controls="category-overview"
                aria-pressed={overview}
                title="All categories (overview)"
                className="category-menu-btn glass-raised flex h-[var(--links-bar-h,56px)] shrink-0 items-center gap-1.5 rounded-2xl border px-2 text-[12px] font-semibold text-white/85 transition-colors"
              >
                <CategoryMenuIcon className="size-6" />
                <span className="hidden xl:inline">All categories</span>
              </button>
              <div className="min-w-0 flex-1">
                <LinksStrip />
              </div>
            </div>
          <div data-testid="center-frame" className="glass flex min-h-0 flex-1 flex-col overflow-hidden">
            <div data-center-body className="relative flex min-h-0 flex-1 p-3">
              {/* The overview replaces the cards (one view at a time keeps it light). */}
              {overview ? (
                <CategoryOverview onClose={() => setOverview(false)} />
              ) : (
                <CategoryGrid onOpenSettings={() => openSettings('library')} />
              )}
              <OfflineBanner />
            </div>
          </div>
          </div>
        }
        right={<FeedColumn onManage={() => openSettings('scraping')} />}
      />

      <UndoToast />
      <AlertCenter />
      <LinkPeek />

      {/* Settings Overlay */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          window.dispatchEvent(new Event('devdeck:settings-closed'));
        }}
        initialTab={settingsTab}
        prefillUrl={settingsPrefill}
        onClearPrefill={() => setSettingsPrefill('')}
      />
    </>
  );
}
