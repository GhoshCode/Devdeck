import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useStore } from '../store';
import { CategoryCard } from './CategoryCard';
import { orderWithPin } from '../lib/categories';

interface CategoryGridProps {
  onOpenSettings?: () => void;
}

export function CategoryGrid({ onOpenSettings }: CategoryGridProps) {
  const categories = useStore((s) => s.categories);
  const pinnedId = useStore((s) => s.pinnedCategoryId);
  const shouldReduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sortedCategories = useMemo(() => orderWithPin(categories, pinnedId), [categories, pinnedId]);

  // Bring the row back to the start when a card is pinned so it is seen landing first.
  useEffect(() => {
    if (pinnedId) scrollRef.current?.scrollTo({ left: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [pinnedId, shouldReduceMotion]);

  const handleThinSpaceWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 2) return;

    // Check if directly below a specific card
    const elements = document.elementsFromPoint(e.clientX, Math.max(0, e.clientY - 25));
    const card = elements.find((el) => el.closest('[data-category-id]'))?.closest<HTMLElement>('[data-category-id]');
    if (card) {
      const bottomToolbar = card.querySelector<HTMLElement>('[data-category-card-bottom]');
      if (bottomToolbar) {
        const btn =
          delta > 0
            ? bottomToolbar.querySelector<HTMLButtonElement>('button[title*="Next"]')
            : bottomToolbar.querySelector<HTMLButtonElement>('button[title*="Previous"]');
        if (btn && !btn.disabled) {
          btn.click();
          return;
        }
      }
    }
    // Fallback: translate to horizontal scroll of category container
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += delta;
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Mouse wheel horizontal translation inside this container
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      // If cursor is inside any category card, let the card handle its internal scrolling
      if (target.closest('[data-category-id]')) {
        return;
      }
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [sortedCategories.length]);

  // Pointer drag-to-scroll on main container
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't drag if clicking inside links, buttons, inputs, or site rows
    if (target.closest('a, button, input, [data-site-id]')) return;
    if (e.button !== 0) return;

    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    startXRef.current = e.clientX;
    scrollStartRef.current = scrollRef.current?.scrollLeft ?? 0;
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (!isDraggingRef.current && Math.abs(dx) > 6) {
      isDraggingRef.current = true;
      try {
        scrollRef.current?.setPointerCapture(e.pointerId);
      } catch {}
    }
    if (isDraggingRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollStartRef.current - dx;
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      try {
        scrollRef.current?.releasePointerCapture(e.pointerId);
      } catch {}
    }
    isPointerDownRef.current = false;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

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
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex flex-1 min-h-0 w-full flex-row gap-5 lg:gap-6 items-stretch justify-start overflow-x-auto overflow-y-hidden scrollbar-none"
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
          </motion.div>
          {/* Thin interactive scroll space below cards - completely scrollbar-free */}
          <div
            data-testid="thin-cards-scroll-space"
            onWheel={handleThinSpaceWheel}
            className="w-full h-1.5 shrink-0 select-none cursor-ew-resize opacity-0"
            title="Scroll subcategories or cards horizontally"
          />
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
            variants={containerVariants}
            initial="hidden"
            animate="show"
            onPointerDown={handleContainerPointerDown}
            onPointerMove={handleContainerPointerMove}
            onPointerUp={handleContainerPointerUp}
            onPointerCancel={handleContainerPointerUp}
            tabIndex={0}
            role="region"
            aria-label="Scrollable category cards"
            className="flex flex-1 min-h-0 flex-row gap-5 overflow-x-auto overflow-y-hidden items-stretch py-1 px-1 scroll-smooth scrollbar-none focus-visible:outline-none select-none cursor-grab active:cursor-grabbing"
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
          </motion.div>

          {/* Thin interactive scroll space below cards - completely scrollbar-free */}
          <div
            data-testid="thin-cards-scroll-space"
            onWheel={handleThinSpaceWheel}
            className="w-full h-1.5 shrink-0 select-none cursor-ew-resize opacity-0"
            title="Scroll subcategories or cards horizontally"
          />
        </section>
      )}
    </main>
  );
}

// The pinned card stays anchored at the left edge while the others scroll
// underneath; the solid backing and right-edge shadow keep it legible.
const PINNED_CLASS =
  'sticky left-0 z-10 rounded-2xl bg-[var(--color-base-elevated)] shadow-[12px_0_24px_-8px_rgba(0,0,0,0.55)]';
