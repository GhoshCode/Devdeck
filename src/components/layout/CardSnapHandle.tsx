import { useState, type PointerEvent } from 'react';
import { dragSteps } from '../../lib/cardSnap';

// The handle between a side column and the category cards. It moves in whole
// cards: a short pull already snaps the centre one card narrower (or wider),
// so the cards are never cut in half. Arrow keys step one card; double-click
// gives the cards back.

export function CardSnapHandle({
  side,
  taken,
  max,
  unit,
  onChange,
}: {
  side: 'left' | 'right';
  taken: number; // cards this side has taken from the centre
  max: number; // most it may take right now
  unit: number; // one card plus the gap, px
  onChange: (taken: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  // Dragging towards the centre takes cards: rightwards for the left handle.
  const dir = side === 'left' ? 1 : -1;
  const set = (n: number) => onChange(Math.max(0, Math.min(max, n)));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const start = taken;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    const move = (ev: globalThis.PointerEvent) => set(start + dir * dragSteps(ev.clientX - startX, unit));
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

  const cards = side === 'left' ? 'Currently processing and Queue' : 'Tech news and jobs';
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${cards} by whole category cards`}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={taken}
      tabIndex={max > 0 || taken > 0 ? 0 : -1}
      data-snap-handle={side}
      title={max > 0 ? 'Drag to resize by whole cards · double-click to reset' : 'No room to resize — the cards need the space'}
      onPointerDown={max > 0 || taken > 0 ? onPointerDown : undefined}
      onDoubleClick={() => set(0)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          set(taken + (e.key === 'ArrowRight' ? dir : -dir));
        } else if (e.key === 'Home') set(0);
      }}
      className={`group/snap flex h-full touch-none items-center justify-center ${max > 0 || taken > 0 ? 'cursor-col-resize' : 'cursor-default'}`}
    >
      <span
        className={`w-1 rounded-full transition-all ${
          dragging ? 'h-16 bg-[var(--color-accent)]' : 'h-10 bg-white/15 group-hover/snap:h-14 group-hover/snap:bg-white/40'
        }`}
      />
    </div>
  );
}
