import { Children, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Cards of different heights packed into columns: each card, in order, goes
// to the shortest column, so a short card no longer leaves a hole beside a
// tall one. Cards keep one parent (absolute positions), so they never remount
// when the layout reshuffles — open editors and drags survive it.

interface MasonryProps {
  children: ReactNode;
  gap?: number;
  minColumn?: number; // narrowest a column may get, px
  maxColumns?: number;
}

export function Masonry({ children, gap = 16, minColumn = 320, maxColumns = 3 }: MasonryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const [layout, setLayout] = useState<{ cols: number; width: number; pos: { x: number; y: number }[]; height: number }>({
    cols: 1,
    width: 0,
    pos: [],
    height: 0,
  });

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const w = box.clientWidth;
      const cols = Math.max(1, Math.min(maxColumns, Math.floor((w + gap) / (minColumn + gap))));
      const colW = (w - gap * (cols - 1)) / cols;
      const heights = new Array(cols).fill(0);
      const pos: { x: number; y: number }[] = [];
      for (const el of Array.from(box.children) as HTMLElement[]) {
        el.style.width = `${colW}px`;
        let c = 0;
        for (let i = 1; i < cols; i++) if (heights[i] < heights[c] - 1) c = i;
        pos.push({ x: c * (colW + gap), y: heights[c] });
        heights[c] += el.offsetHeight + gap;
      }
      const height = Math.max(0, Math.max(...heights) - gap);
      setLayout((prev) =>
        prev.cols === cols && prev.width === colW && prev.height === height && prev.pos.length === pos.length && prev.pos.every((p, i) => p.x === pos[i].x && p.y === pos[i].y)
          ? prev
          : { cols, width: colW, pos, height },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(box);
    for (const el of Array.from(box.children)) ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [items.length, gap, minColumn, maxColumns]);

  return (
    <div ref={ref} data-masonry className="relative w-full" style={{ height: layout.height }}>
      {items.map((child, i) => {
        const p = layout.pos[i];
        return (
          <div
            key={(child as { key?: string }).key ?? i}
            className="absolute top-0 left-0 transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ width: layout.width || '100%', transform: p ? `translate(${p.x}px, ${p.y}px)` : undefined, visibility: p ? undefined : 'hidden' }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
