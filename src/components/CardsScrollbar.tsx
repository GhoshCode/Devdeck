import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

// The category row's own scrollbar: a thin track under the cards whose thumb
// you drag, click (jumps a card) or scroll the wheel over. The row itself
// ignores the wheel and trackpad swipes, so cards only move when you mean it.
// Hidden when every card already fits.

export function CardsScrollbar({ target }: { target: RefObject<HTMLElement | null> }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ ratio: 1, pos: 0 });
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const el = target.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setM({ ratio: el.scrollWidth ? el.clientWidth / el.scrollWidth : 1, pos: max > 0 ? el.scrollLeft / max : 0 });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [target]);

  // Block wheel / trackpad scrolling of the row (inner scrollers keep theirs).
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) && !e.shiftKey) return; // vertical: cards scroll their own lists
      for (let n = e.target as HTMLElement | null; n && n !== el; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth) return; // a subcategory rail, etc.
      }
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [target]);

  // Over the scrollbar itself, the wheel (or a trackpad swipe) does move the cards.
  useEffect(() => {
    const bar = barRef.current;
    const el = target.current;
    if (!bar || !el) return;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      el.scrollBy({ left: d * (e.deltaMode === 1 ? 40 : 1), behavior: 'instant' });
    };
    bar.addEventListener('wheel', onWheel, { passive: false });
    return () => bar.removeEventListener('wheel', onWheel);
  }, [target, m.ratio]);

  if (m.ratio >= 0.999) return null;
  const thumb = Math.max(8, m.ratio * 100);

  const scrollTo = (fraction: number, smooth: boolean) => {
    const el = target.current;
    if (!el) return;
    el.scrollTo({ left: fraction * (el.scrollWidth - el.clientWidth), behavior: smooth ? 'smooth' : 'instant' });
  };

  const onThumbDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const startX = e.clientX;
    const startPos = m.pos;
    const free = track.clientWidth * (1 - thumb / 100);
    const node = e.currentTarget;
    node.setPointerCapture(e.pointerId);
    setDragging(true);
    const move = (ev: globalThis.PointerEvent) => scrollTo(Math.min(1, Math.max(0, startPos + (ev.clientX - startX) / free)), false);
    const up = () => {
      setDragging(false);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  };

  // Clicking the bare track moves one card's width that way.
  const onTrackDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = target.current;
    const track = trackRef.current;
    if (!el || !track || e.target !== track) return;
    const rect = track.getBoundingClientRect();
    const at = (e.clientX - rect.left) / rect.width;
    const card = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 400;
    el.scrollBy({ left: at < m.pos ? -card : card, behavior: 'smooth' });
  };

  return (
    <div ref={barRef} className="group/cards-bar shrink-0 px-2 pt-2.5 pb-0.5">
      <div
        ref={trackRef}
        role="scrollbar"
        aria-orientation="horizontal"
        aria-label="Scroll the category cards"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(m.pos * 100)}
        aria-controls="category-cards-track"
        tabIndex={0}
        data-testid="cards-scrollbar"
        onPointerDown={onTrackDown}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const card = (target.current?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 400;
            target.current?.scrollBy({ left: e.key === 'ArrowLeft' ? -card : card, behavior: 'smooth' });
          }
        }}
        className="cards-bar relative h-1.5 cursor-pointer rounded-full transition-[height] group-hover/cards-bar:h-2"
      >
        <div
          onPointerDown={onThumbDown}
          className={`cards-bar-thumb absolute inset-y-0 cursor-grab touch-none rounded-full transition-[background-color,box-shadow] active:cursor-grabbing ${
            dragging ? 'is-dragging' : ''
          }`}
          style={{ width: `${thumb}%`, left: `${m.pos * (100 - thumb)}%` }}
        />
      </div>
    </div>
  );
}
