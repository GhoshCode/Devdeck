import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Site } from '../types';
import { SiteRow } from './SiteRow';

export interface RailGroup {
  id: string;
  name: string;
  sites: Site[];
}

interface SubcategoryCardProps {
  id: string;
  name: string;
  sites: Site[];
  categoryColor: string;
}

const SubcategoryCard = memo(function SubcategoryCard({
  id,
  name,
  sites,
  categoryColor,
}: SubcategoryCardProps) {
  const siteIds = useMemo(() => sites.map((s) => s.id), [sites]);

  return (
    <div
      data-subcategory-card-id={id}
      className="glass-inner flex h-full w-[85%] min-w-[85%] max-w-[85%] shrink-0 flex-col overflow-hidden p-2.5 sm:p-3 snap-start snap-always"
    >
      {/* Subcategory Card Header */}
      <div className="mb-1 flex items-center justify-between border-b border-white/[0.04] pb-1.5 px-1 select-none">
        <h3 className="text-sm sm:text-[15px] font-bold text-white/95 tracking-tight truncate">
          {name}
        </h3>
        <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-xs font-semibold text-white/50 tabular-nums">
          {sites.length}
        </span>
      </div>

      {/* Vertically Scrolling Site List with SortableContext */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
        {sites.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <p className="text-sm font-medium text-white/50">No sites yet</p>
            <p className="mt-0.5 text-xs text-white/35">Add sites to {name}</p>
          </div>
        ) : (
          <SortableContext items={siteIds} strategy={verticalListSortingStrategy}>
            {sites.map((site) => (
              <SiteRow
                key={site.id}
                site={site}
                categoryColor={categoryColor}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
});

interface SubcategoryRailProps {
  groups: RailGroup[];
  categoryColor: string;
  activeId: string;
  onActiveChange: (id: string) => void;
  onSelectGroup?: (id: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  isProgrammaticScrollRef?: React.RefObject<boolean>;
}

export function SubcategoryRail({
  groups,
  categoryColor,
  activeId,
  onActiveChange,
  onSelectGroup,
  scrollRef,
  isProgrammaticScrollRef,
}: SubcategoryRailProps) {

  // Drag-to-pan state
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastSwitchTimeRef = useRef(0);

  // Debounced IntersectionObserver to sync the active pill with the currently snapped card
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const rootEl = scrollRef.current;
    if (!rootEl || groups.length <= 1) return;

    const cards = rootEl.querySelectorAll<HTMLDivElement>('[data-subcategory-card-id]');
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Skip updating active pill if programmatic scrolling is active
        if (isProgrammaticScrollRef?.current) return;

        let maxRatio = 0;
        let bestId = '';

        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const id = entry.target.getAttribute('data-subcategory-card-id');
            if (id) bestId = id;
          }
        }

        if (bestId && maxRatio >= 0.5) {
          if (debounceTimerRef.current !== null) {
            window.clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = window.setTimeout(() => {
            onActiveChange(bestId);
            debounceTimerRef.current = null;
          }, 60);
        }
      },
      {
        root: rootEl,
        threshold: [0.4, 0.6, 0.8],
      },
    );

    cards.forEach((card) => observer.observe(card));

    return () => {
      observer.disconnect();
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [groups.length, onActiveChange, scrollRef, isProgrammaticScrollRef]);

  // Keyboard navigation on ← / →
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const rootEl = scrollRef.current;
      if (!rootEl) return;

      const cardWidth = rootEl.clientWidth * 0.85;
      const direction = e.key === 'ArrowRight' ? 1 : -1;

      rootEl.scrollBy({
        left: direction * (cardWidth + 16),
        behavior: 'smooth',
      });
      e.preventDefault();
    },
    [scrollRef],
  );

  // Smooth wheel handler: allows native trackpad swipe and smoothly steps subcategories
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (groups.length <= 1) return;

    const target = e.target as HTMLElement;
    const siteListEl = target.closest('.overflow-y-auto') as HTMLElement | null;

    // If mouse is inside the vertically scrollable site list
    if (siteListEl) {
      const isAtTop = siteListEl.scrollTop <= 2 && e.deltaY < 0;
      const isAtBottom =
        siteListEl.scrollTop + siteListEl.clientHeight >= siteListEl.scrollHeight - 2 && e.deltaY > 0;
      const isHorizontalTrackpad = Math.abs(e.deltaX) > Math.abs(e.deltaY);

      if (isHorizontalTrackpad) {
        // Native horizontal trackpad scrolling inside rail
        e.stopPropagation();
        return;
      }

      if (!isAtTop && !isAtBottom) {
        // Vertical scroll within list - let default browser scroll happen
        e.stopPropagation();
        return;
      }
    }

    // Horizontal trackpad gesture
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.stopPropagation();
      return;
    }

    // Wheel over subcategory card header / padding: smoothly switch subcategories
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(delta) > 8) {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastSwitchTimeRef.current < 220) return;
      lastSwitchTimeRef.current = now;

      const currentIndex = groups.findIndex((g) => g.id === activeId);
      if (delta > 0 && currentIndex < groups.length - 1) {
        onSelectGroup?.(groups[currentIndex + 1].id);
      } else if (delta < 0 && currentIndex > 0) {
        onSelectGroup?.(groups[currentIndex - 1].id);
      }
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Only drag when clicking the rail container or subcategory card header area, not inside links/buttons
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input')) return;
    if (e.button !== 0) return;

    e.stopPropagation();
    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    startXRef.current = e.clientX;
    scrollStartRef.current = scrollRef.current?.scrollLeft ?? 0;
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - startXRef.current;
    if (!isDraggingRef.current && Math.abs(dx) > 6) {
      isDraggingRef.current = true;
      scrollRef.current?.setPointerCapture(e.pointerId);
    }
    if (isDraggingRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollStartRef.current - dx;
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isDraggingRef.current) {
      try {
        scrollRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    isPointerDownRef.current = false;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  return (
    <div
      ref={scrollRef}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      tabIndex={0}
      role="region"
      aria-label="Subcategory rail"
      className="flex-1 flex gap-3 overflow-x-auto px-3 pt-2 pb-1.5 min-h-0 snap-x snap-mandatory scroll-smooth scrollbar-none focus-visible:outline-none select-none"
    >
      {groups.map((group) => (
        <SubcategoryCard
          key={group.id}
          id={group.id}
          name={group.name}
          sites={group.sites}
          categoryColor={categoryColor}
        />
      ))}
    </div>
  );
}
