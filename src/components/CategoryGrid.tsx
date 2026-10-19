import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useStore } from '../store';
import { CategoryCard } from './CategoryCard';
import { PagerDots, PagerSpacer, useCardPaging } from './CardsPager';
import { orderWithPin } from '../lib/categories';
import { UncategorizedTiles } from './UncategorizedTiles';

interface CategoryGridProps {
  onOpenSettings?: () => void;
}

export function CategoryGrid({ onOpenSettings }: CategoryGridProps) {
  const categories = useStore((s) => s.categories);
  const pinnedId = useStore((s) => s.pinnedCategoryId);
  const shouldReduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sortedCategories = useMemo(() => orderWithPin(categories, pinnedId), [categories, pinnedId]);
  const sites = useStore((s) => s.sites);
  const loose = useMemo(() => sites.filter((s) => s.categoryId === '').sort((a, b) => a.order - b.order), [sites]);
  const paging = useCardPaging(scrollRef, sortedCategories.length + (loose.length ? 1 : 0));

  // Bring the row back to the start when a card is pinned so it is seen landing first.
  useEffect(() => {
    if (pinnedId) scrollRef.current?.scrollTo({ left: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [pinnedId, shouldReduceMotion]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.06,
      },
    },
  };

  const cardVariants = {
    hidden: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
    },
  };

  const isContainerized = sortedCategories.length > 3;

  return (
    <main className="flex flex-1 min-h-0 w-full overflow-hidden">
      {sortedCategories.length === 0 ? (
        <div className="glass flex flex-1 items-center justify-center text-center p-8 rounded-3xl border border-white/10 shadow-2xl">
          <div className="flex flex-col items-center max-w-sm">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-white/40">
              <svg className="size-6" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
            </div>
            <p className="font-display text-lg font-semibold text-white">Welcome to DevDeck</p>
            <p className="mt-1 text-sm text-white/50">
              Get started by adding your first category and favorite developer sites.
            </p>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="mt-4 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white shadow-lg hover:opacity-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Configure Library in Settings
              </button>
            )}
          </div>
        </div>
      ) : !isContainerized ? (
        /* Independent cards when categories count <= 3 per user request */
        <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">
          <motion.div
            ref={scrollRef}
            data-cards-track
            data-per-page={paging.perPage}
            id="category-cards-track"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="relative flex flex-1 min-h-0 w-full flex-row gap-5 lg:gap-6 items-stretch justify-start overflow-x-auto overflow-y-hidden scrollbar-none"
          >
            {sortedCategories.map((category) => (
              <motion.div
                key={category.id}
                layout={shouldReduceMotion ? false : 'position'}
                variants={cardVariants}
                data-pinned={category.id === pinnedId || undefined}
                className={`w-[330px] sm:w-[370px] lg:w-[400px] shrink-0 h-full flex flex-col min-h-0 ${
                  category.id === pinnedId ? PINNED_CLASS : ''
                }`}
              >
                <CategoryCard category={category} />
              </motion.div>
            ))}
            {loose.length > 0 && (
              <div className="w-[330px] sm:w-[370px] lg:w-[400px] shrink-0 h-full flex flex-col min-h-0">
                <UncategorizedTiles sites={loose} />
              </div>
            )}
            <PagerSpacer width={paging.spacer} />
          </motion.div>
          {/* Page dots: click one, or scroll the wheel over this strip, to move a page of cards. */}
          <PagerDots pages={paging.pages} page={paging.page} goTo={paging.goTo} />
        </div>
      ) : (
        /* Containerized when cards cross the limit (> 3 categories) */
        <section
          aria-label="Categories container"
          data-categories-container
          className="glass-raised relative flex flex-1 min-h-0 flex-col overflow-hidden rounded-3xl border border-white/15 shadow-[0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur-2xl p-3 sm:p-4"
        >
          {/* Horizontal scroll track with cards */}
          <motion.div
            ref={scrollRef}
            data-cards-track
            data-per-page={paging.perPage}
            id="category-cards-track"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            tabIndex={0}
            role="region"
            aria-label="Scrollable category cards"
            className="relative flex flex-1 min-h-0 flex-row gap-5 overflow-x-auto overflow-y-hidden items-stretch py-1 px-1 scrollbar-none focus-visible:outline-none"
          >
            {sortedCategories.map((category) => (
              <motion.div
                key={category.id}
                layout={shouldReduceMotion ? false : 'position'}
                variants={cardVariants}
                data-pinned={category.id === pinnedId || undefined}
                className={`w-[330px] sm:w-[370px] lg:w-[400px] shrink-0 h-full flex flex-col min-h-0 ${
                  category.id === pinnedId ? PINNED_CLASS : ''
                }`}
              >
                <CategoryCard category={category} />
              </motion.div>
            ))}
            {loose.length > 0 && (
              <div className="w-[330px] sm:w-[370px] lg:w-[400px] shrink-0 h-full flex flex-col min-h-0">
                <UncategorizedTiles sites={loose} />
              </div>
            )}
            <PagerSpacer width={paging.spacer} />
          </motion.div>

          {/* Page dots: click one, or scroll the wheel over this strip, to move a page of cards. */}
          <PagerDots pages={paging.pages} page={paging.page} goTo={paging.goTo} />
        </section>
      )}
    </main>
  );
}

// The pinned card leads the first page (rows move a page at a time, so it no
// longer stays stuck to the left edge).
const PINNED_CLASS = 'rounded-2xl';
