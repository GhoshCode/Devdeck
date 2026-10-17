import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LibraryTab } from './LibraryTab';
import { SitemapTab } from './SitemapTab';
import { QuickLinksTab } from './QuickLinksTab';
import { AppearanceTab } from './AppearanceTab';
import { ProfileTab } from './ProfileTab';
import { ProcessingTab } from './ProcessingTab';
import { ScrapingTab } from './ScrapingTab';
import { DataTab } from './DataTab';

export type SettingsTabId =
  | 'library'
  | 'sitemap'
  | 'quicklinks'
  | 'appearance'
  | 'profile'
  | 'processing'
  | 'scraping'
  | 'data';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTabId;
  prefillUrl?: string;
  onClearPrefill?: () => void;
}

const TABS: Array<{ id: SettingsTabId; label: string; icon: string }> = [
  { id: 'library', label: 'Library', icon: '📁' },
  { id: 'sitemap', label: 'Sitemap', icon: '🗺️' },
  { id: 'quicklinks', label: 'Quick Links', icon: '⚡' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'processing', label: 'Processing', icon: '⏰' },
  { id: 'scraping', label: 'Scraping', icon: '📰' },
  { id: 'data', label: 'Data', icon: '💾' },
];

export default function SettingsModal({
  isOpen,
  onClose,
  initialTab = 'library',
  prefillUrl = '',
  onClearPrefill,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-xl"
          />

          {/* Full-screen Glass Overlay Shell */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="glass-raised relative z-10 flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-[var(--color-base-elevated)]/90 backdrop-blur-3xl shadow-[0_32px_96px_rgba(0,0,0,0.65)] md:flex-row"
            role="dialog"
            aria-modal="true"
            aria-label="DevDeck Settings"
          >
            {/* Left Tab Rail */}
            <aside className="flex shrink-0 flex-row border-b border-white/[0.08] bg-white/[0.03] p-4 md:w-64 md:flex-col md:justify-between md:border-r md:border-b-0 backdrop-blur-xl">
              <div className="flex w-full flex-row items-center gap-1 md:flex-col md:items-stretch md:gap-1.5">
                <div className="hidden pb-4 md:block select-none">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
                    <span className="font-display text-sm font-bold uppercase tracking-wider text-white">
                      DevDeck
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/55">Configuration & Tools</p>
                </div>

                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-white/10 text-white font-semibold shadow-md'
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="text-sm">{tab.icon}</span>
                      <span>{tab.label}</span>
                      {isActive && (
                        <div className="absolute right-2 hidden size-1.5 rounded-full bg-[var(--color-accent)] md:block" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Close Button on Desktop Sidebar */}
              <div className="hidden md:block pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Close (ESC)
                </button>
              </div>
            </aside>

            {/* Main Content Area */}
            <section className="relative flex flex-1 flex-col overflow-hidden min-h-0 bg-black/20">
              {/* Close button for mobile & top-right corner */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Settings"
                className="absolute top-4 right-4 z-20 flex size-8 items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/15 hover:text-white transition-colors"
              >
                ✕
              </button>

              <div className="flex-1 overflow-y-auto">
                {activeTab === 'library' && (
                  <LibraryTab
                    initialPrefillUrl={prefillUrl}
                    onClearPrefill={onClearPrefill}
                  />
                )}
                {activeTab === 'sitemap' && <SitemapTab />}
                {activeTab === 'quicklinks' && <QuickLinksTab />}
                {activeTab === 'appearance' && <AppearanceTab />}
                {activeTab === 'profile' && <ProfileTab />}
                {activeTab === 'processing' && <ProcessingTab />}
                {activeTab === 'scraping' && <ScrapingTab />}
                {activeTab === 'data' && <DataTab />}
              </div>
            </section>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
