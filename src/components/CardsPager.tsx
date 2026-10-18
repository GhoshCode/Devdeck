import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

// The category row moves a page at a time — a page is as many cards as fit
// side by side. Dots under the row show where you are; click one, or scroll
// the wheel over that bottom strip, to move. The row itself ignores sideways
// wheel / trackpad swipes, so cards only move when you mean it. The last page
// keeps its cards at the left and leaves the rest of the row blank.

interface Paging {
  perPage: number;
  pages: number;
  page: number;
  spacer: number;
}

export function useCardPaging(target: RefObject<HTMLElement | null>, count: number) {
  const [p, setP] = useState<Paging>({ perPage: 1, pages: 1, page: 0, spacer: 0 });
  const pRef = useRef(p);
  pRef.current = p;

  const cards = useCallback(() => {
    const el = target.current;
    return el ? (Array.from(el.children).filter((c) => !(c as HTMLElement).dataset.pagerSpacer) as HTMLElement[]) : [];
  }, [target]);

  useLayoutEffect(() => {
    const el = target.current;
    if (!el) return;
    const measure = () => {
      const list = cards();
      if (!list.length) return;
      const first = list[0];
      const step = list[1] ? list[1].offsetLeft - first.offsetLeft : first.offsetWidth;
      const perPage = Math.max(1, Math.floor((el.clientWidth - first.offsetLeft * 2 + (step - first.offsetWidth)) / step));
      const pages = Math.max(1, Math.ceil(list.length / perPage));
      // Room after the last card so the last page can start at the left edge.
      const lastStart = list[(pages - 1) * perPage].offsetLeft - first.offsetLeft;
      const last = list[list.length - 1];
      const end = last.offsetLeft + last.offsetWidth;
      const gap = step - first.offsetWidth;
      const spacer = pages > 1 ? Math.max(0, lastStart + el.clientWidth - end - gap) : 0;
      const page = Math.min(pages - 1, Math.round(el.scrollLeft / (step * perPage)));
      const prev = pRef.current;
      if (prev.perPage !== perPage || prev.pages !== pages || prev.page !== page || Math.abs(prev.spacer - spacer) > 1) {
        setP({ perPage, pages, page, spacer });
      }
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [target, cards, count]);

  const goTo = useCallback(
    (page: number, smooth = true) => {
      const el = target.current;
      const list = cards();
      if (!el || !list.length) return;
      const { perPage, pages } = pRef.current;
      const i = Math.min(pages - 1, Math.max(0, page)) * perPage;
      el.scrollTo({ left: list[Math.min(i, list.length - 1)].offsetLeft - list[0].offsetLeft, behavior: smooth ? 'smooth' : 'instant' });
    },
    [target, cards],
  );

  // After a resize, settle back onto a page boundary.
  useEffect(() => {
    goTo(pRef.current.page, false);
  }, [p.perPage, goTo]);

  // Block sideways wheel / trackpad scrolling of the row (inner scrollers keep theirs).
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) && !e.shiftKey) return;
      for (let n = e.target as HTMLElement | null; n && n !== el; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth) return;
      }
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [target]);

  return { ...p, goTo };
}

// Spacer placed after the last card (inside the row).
export function PagerSpacer({ width }: { width: number }) {
  if (!width) return null;
  return <div aria-hidden data-pager-spacer="1" className="shrink-0" style={{ width }} />;
}

export function PagerDots({ pages, page, goTo }: { pages: number; page: number; goTo: (p: number) => void }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const lock = useRef(0);
  const state = useRef({ page, pages });
  state.current = { page, pages };

  // One wheel notch (or one swipe) over the strip = one page.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 4) return;
      e.preventDefault();
      const now = Date.now();
      if (now < lock.current) return;
      lock.current = now + 450;
      goTo(state.current.page + (d > 0 ? 1 : -1));
    };
    strip.addEventListener('wheel', onWheel, { passive: false });
    return () => strip.removeEventListener('wheel', onWheel);
  }, [goTo, pages]);

  if (pages <= 1) return null;
  return (
    <div
      ref={stripRef}
      data-testid="cards-pager"
      role="tablist"
      aria-label="Category pages"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          goTo(page + (e.key === 'ArrowLeft' ? -1 : 1));
        }
      }}
      className="flex h-8 shrink-0 items-center justify-center gap-1.5 pt-1"
    >
      {Array.from({ length: pages }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === page}
          aria-label={`Page ${i + 1} of ${pages}`}
          tabIndex={i === page ? 0 : -1}
          onClick={() => goTo(i)}
          className="group flex h-4 items-center px-0.5"
        >
          <span
            className={`block h-1.5 rounded-full transition-all duration-300 ${
              i === page ? 'w-5 bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]' : 'w-1.5 bg-white/25 group-hover:bg-white/50'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
