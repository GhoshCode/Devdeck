import { useState, type PointerEvent } from 'react';

// The handle between a side column and the category cards. It resizes freely,
// px by px (the centre always keeps one card); arrow keys step 24 px;
// double-click gives the space back. For whole-card steps use the tabs inside
// the cards box (EdgeTab).

export function CardSnapHandle({
  side,
  width,
  min,
  max,
  onChange,
  onDragging,
}: {
  side: 'left' | 'right';
  width: number; // this side column, px
  min: number;
  max: number; // most it may have right now
  onChange: (width: number | null) => void;
  onDragging: (on: boolean) => void;
}) {
  const [dragging, setDragging] = useState(false);
  // Dragging towards the centre widens the side: rightwards for the left handle.
  const dir = side === 'left' ? 1 : -1;
  const set = (w: number) => onChange(Math.round(Math.max(min, Math.min(max, w))));
  const active = max > min;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const start = width;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    onDragging(true);
    const move = (ev: globalThis.PointerEvent) => set(start + dir * (ev.clientX - startX));
    const up = () => {
      setDragging(false);
      onDragging(false);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const cards = side === 'left' ? 'Currently processing and Queue' : 'Tech news and jobs';
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${cards}`}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(width)}
      tabIndex={active ? 0 : -1}
      data-snap-handle={side}
      title={active ? 'Drag to resize · double-click to reset' : 'No room to resize — the cards need the space'}
      onPointerDown={active ? onPointerDown : undefined}
      onDoubleClick={() => onChange(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          set(width + (e.key === 'ArrowRight' ? dir : -dir) * 24);
        } else if (e.key === 'Home') onChange(null);
      }}
      className={`group/snap flex h-full touch-none items-center justify-center ${active ? 'cursor-col-resize' : 'cursor-default'}`}
    >
      <span
        className={`w-1 rounded-full transition-all ${
          dragging ? 'h-16 bg-[var(--color-accent)]' : 'h-10 bg-white/15 group-hover/snap:h-14 group-hover/snap:bg-white/40'
        }`}
      />
    </div>
  );
}

// A half-cut tab just inside each edge of the cards box (the "Currently
// processing" notch turned on its side), with a three-line grip. Both tabs
// do the same: click for the next card mode (2 → 1 → 3 → 2; a part-card view
// snaps to its whole cards first), drag for whole cards either way — towards
// the centre for fewer, out for more. Both side columns follow, balanced.
export function EdgeTab({
  side,
  cards,
  next,
  unit,
  onStep,
  onCards,
}: {
  side: 'left' | 'right';
  cards: number; // whole cards in view now
  next: number; // the mode a click switches to
  unit: number; // one card plus the gap, px
  onStep: () => void;
  onCards: (n: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const label = `Show ${next} card${next === 1 ? '' : 's'}`;
  const inward = side === 'left' ? 1 : -1;

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const start = cards;
    let moved = false;
    let last = start;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => {
      const dx = (ev.clientX - startX) * inward;
      if (!moved && Math.abs(dx) < 6) return;
      if (!moved) setDragging(true);
      moved = true;
      // half a card's pull snaps to the next whole card
      const n = Math.max(1, Math.min(3, start - Math.round(dx / unit)));
      if (n !== last) onCards((last = n));
    };
    const up = () => {
      setDragging(false);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (!moved) onStep();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  return (
    <button
      type="button"
      data-edge-tab={side}
      aria-label={label}
      title={`${label} · drag to resize by whole cards`}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onStep();
        }
      }}
      className={`edge-tab panel-notch absolute top-1/2 z-10 flex h-16 w-4 -translate-y-1/2 cursor-col-resize touch-none items-center justify-center gap-[2px] border transition-colors ${
        side === 'left' ? 'left-3 rounded-r-xl border-l-0' : 'right-3 rounded-l-xl border-r-0'
      } ${dragging ? 'is-dragging' : ''}`}
    >
      <i className="edge-grip" />
      <i className="edge-grip" />
      <i className="edge-grip" />
    </button>
  );
}
