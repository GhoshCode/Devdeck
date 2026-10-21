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

// A half-cut tab on the inside edge of the cards box (the "Currently
// processing" notch turned on its side). Each click narrows the centre by one
// whole card — a part-card view snaps to the whole cards below it — and gives
// the space to this side; at one card it gives the space back.
export function EdgeTab({ side, cards, onStep }: { side: 'left' | 'right'; cards: number; onStep: () => void }) {
  const what = side === 'left' ? 'Currently processing' : 'Tech news';
  const label = cards <= 1 ? `Give ${what} its space back` : `Widen ${what} by one card`;
  // the arrow points the way the edge moves
  const into = (side === 'left') === cards > 1;
  return (
    <button
      type="button"
      data-edge-tab={side}
      aria-label={label}
      title={label}
      onClick={onStep}
      className={`panel-notch absolute top-1/2 z-10 flex h-16 w-4 -translate-y-1/2 items-center justify-center border text-white/50 transition-colors hover:text-white ${
        side === 'left' ? 'left-0 rounded-r-xl border-l-0' : 'right-0 rounded-l-xl border-r-0'
      }`}
    >
      <svg className="size-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={into ? 'M4 2l4 4-4 4' : 'M8 2L4 6l4 4'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
