import { useState, type PointerEvent, type RefObject } from 'react';

// The handle between the quick-links bar and the terminal. Drag to size the
// terminal on its own (independent of the news column below); arrow keys step
// 24 px; double-click goes back to the Git box's width.

export const MIN_TERMINAL = 240;
export const MIN_LINKS = 820; // All categories + the five fixed quick links (~700px) + room for the scrolling ones

export function TopSplitHandle({ width, custom, rowRef, lead = 0, onChange }: { width: number; custom: boolean; rowRef: RefObject<HTMLDivElement | null>; lead?: number; onChange: (w: number | null) => void }) {
  const [dragging, setDragging] = useState(false);
  const clamp = (w: number) => {
    const row = rowRef.current?.clientWidth ?? 1600;
    // lead: the row's width before the links start (they sit under the search row)
    return Math.round(Math.max(MIN_TERMINAL, Math.min(row - lead - MIN_LINKS, w)));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const start = width;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    const move = (ev: globalThis.PointerEvent) => onChange(clamp(start - (ev.clientX - startX)));
    const up = () => {
      setDragging(false);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize quick links and terminal"
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      title={custom ? 'Drag to resize · double-click to match the Git box width' : 'Drag to resize the quick links and the terminal'}
      onPointerDown={onPointerDown}
      onDoubleClick={() => onChange(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          onChange(clamp(width + (e.key === 'ArrowLeft' ? 24 : -24)));
        } else if (e.key === 'Home') onChange(null);
      }}
      data-testid="top-split-handle"
      className={`top-split group flex h-[var(--links-bar-h)] w-3 shrink-0 cursor-col-resize items-center justify-center self-end touch-none ${dragging ? 'is-dragging' : ''}`}
    >
      <span className="top-split-grip h-7 w-[3px] rounded-full" />
    </div>
  );
}
