import { memo, useEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';

export interface GroupItem {
  id: string;
  name: string;
  count: number;
}

interface PinnedStripProps {
  categoryId: string;
  categoryColor: string;
  groups: GroupItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

interface DroppablePillProps {
  group: GroupItem;
  isActive: boolean;
  categoryId: string;
  categoryColor: string;
  onSelect: (id: string) => void;
}

const DroppablePill = memo(function DroppablePill({
  group,
  isActive,
  categoryId,
  categoryColor,
  onSelect,
}: DroppablePillProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `droppable-pill-${group.id}`,
    data: {
      type: 'pill',
      subcategoryId: group.id === 'general' ? null : group.id,
      categoryId,
    },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-group-id={group.id}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => onSelect(group.id)}
      className={`relative flex items-center gap-2 rounded-[9px] px-3 py-1 text-[12.5px] font-medium transition-all duration-150 select-none ${
        isOver
          ? 'scale-105 bg-white/25 text-white ring-2 ring-white/60 shadow-lg'
          : isActive
          ? 'bg-white/15 text-white ring-1 ring-white/20 shadow-md'
          : 'text-white/50 hover:bg-white/5 hover:text-white/85'
      }`}
      style={{
        boxShadow: isActive ? `0 0 12px color-mix(in srgb, ${categoryColor} 21%, transparent)` : undefined,
      }}
    >
      <span className="relative z-10">{group.name}</span>
      <span
        className={`relative z-10 text-xs tabular-nums font-mono ${
          isActive || isOver ? 'text-white/90' : 'text-white/35'
        }`}
      >
        {group.count}
      </span>
    </button>
  );
});

export const PinnedStrip = memo(function PinnedStrip({
  categoryId,
  categoryColor,
  groups,
  activeId,
  onSelect,
}: PinnedStripProps) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activePill = nav.querySelector<HTMLElement>(`[data-group-id="${activeId}"]`);
    if (!activePill) return;
    // Scroll only this strip. scrollIntoView would also scroll every ancestor,
    // including the card row, which shifted the whole row on page load.
    const pill = activePill.getBoundingClientRect();
    const box = nav.getBoundingClientRect();
    const delta = pill.left < box.left ? pill.left - box.left - 8 : pill.right > box.right ? pill.right - box.right + 8 : 0;
    if (delta) nav.scrollBy({ left: delta, behavior: 'smooth' });
  }, [activeId]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0 && nav.scrollWidth > nav.clientWidth) {
        e.preventDefault();
        e.stopPropagation();
        nav.scrollLeft += delta;
      }
    };

    nav.addEventListener('wheel', handleWheel, { passive: false });
    return () => nav.removeEventListener('wheel', handleWheel);
  }, []);

  if (groups.length <= 1) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Subcategory groups"
      className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-white/[0.04] overflow-x-auto scrollbar-none flex-nowrap whitespace-nowrap select-none"
    >
      {groups.map((group) => (
        <DroppablePill
          key={group.id}
          group={group}
          isActive={group.id === activeId}
          categoryId={categoryId}
          categoryColor={categoryColor}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
});
