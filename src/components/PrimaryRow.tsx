import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import type { Site } from '../types';
import { useStore } from '../store';
import { Favicon } from './Favicon';

interface PrimaryRowProps {
  sites: Site[];
  categoryColor: string;
}

export const PrimaryRow = memo(function PrimaryRow({ sites, categoryColor }: PrimaryRowProps) {
  const recordVisit = useStore((s) => s.recordVisit);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Drag-to-pan state
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const isDraggingRef = useRef(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, sites.length]);

  const handleScrollBy = (distance: number) => {
    scrollRef.current?.scrollBy({ left: distance, behavior: 'smooth' });
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (e.deltaX !== 0) return;
    if (e.shiftKey || Math.abs(e.deltaY) > 0) {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft += e.deltaY;
        checkScroll();
      }
    }
  };

  // Pointer drag-to-pan
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Only primary button
    if (e.button !== 0) return;
    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    startXRef.current = e.clientX;
    scrollStartRef.current = scrollRef.current?.scrollLeft ?? 0;
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (!isDraggingRef.current && Math.abs(dx) > 5) {
      isDraggingRef.current = true;
      scrollRef.current?.setPointerCapture(e.pointerId);
    }
    if (isDraggingRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollStartRef.current - dx;
      checkScroll();
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      try {
        scrollRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    isPointerDownRef.current = false;
    // Keep isDraggingRef.current true briefly so child click handler knows to cancel
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  const handleTileClick = (e: MouseEvent, siteId: string) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    recordVisit(siteId);
  };

  if (sites.length === 0) return null;

  return (
    <section
      aria-label="Primary sites"
      className="group/primary relative shrink-0 border-b border-white/[0.04] px-3.5 py-2 select-none"
    >
      <div className="relative">
        {/* Left Fade Mask & Chevron */}
        {canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 flex w-12 items-center justify-start bg-gradient-to-r from-[var(--color-base-elevated)]/90 to-transparent">
            <button
              type="button"
              onClick={() => handleScrollBy(-160)}
              className="pointer-events-auto flex size-7 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-md opacity-0 group-hover/primary:opacity-100 transition-opacity hover:bg-white/20 focus-visible:opacity-100"
              aria-label="Scroll left"
            >
              <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Scrollable Tiles Container */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="flex items-center gap-2.5 overflow-x-auto px-1 pt-1.5 pb-1 scrollbar-none cursor-grab active:cursor-grabbing"
          tabIndex={0}
          role="region"
          aria-label="Primary sites rail"
        >
          {sites.map((site) => (
            <div key={site.id} className="group/pin relative shrink-0">
              <a
                href={site.url}
                onClick={(e) => handleTileClick(e, site.id)}
                className="glass-inner group/tile flex size-[70px] sm:size-[76px] shrink-0 flex-col items-center justify-center gap-1 p-1.5 text-center transition-all duration-200 hover:scale-105 hover:bg-[var(--color-glass-strong)] hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                title={site.name}
              >
                <Favicon
                  url={site.url}
                  name={site.name}
                  categoryColor={categoryColor}
                  className="size-7 sm:size-8"
                />
                <span className="w-full truncate text-[12.5px] font-medium text-white/85 group-hover/tile:text-white">
                  {site.name}
                </span>
              </a>
            </div>
          ))}
        </div>

        {/* Right Fade Mask & Chevron */}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 flex w-12 items-center justify-end bg-gradient-to-l from-[var(--color-base-elevated)]/90 to-transparent">
            <button
              type="button"
              onClick={() => handleScrollBy(160)}
              className="pointer-events-auto flex size-7 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-md opacity-0 group-hover/primary:opacity-100 transition-opacity hover:bg-white/20 focus-visible:opacity-100"
              aria-label="Scroll right"
            >
              <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
});
