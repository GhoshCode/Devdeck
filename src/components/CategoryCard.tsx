import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Category, Site } from '../types';
import { useStore } from '../store';
import { PrimaryRow } from './PrimaryRow';
import { PinnedStrip, type GroupItem } from './PinnedStrip';
import { SubcategoryRail, type RailGroup } from './SubcategoryRail';
import { SiteRow } from './SiteRow';
import { getCategoryDisplayColor } from '../utils';

// Theme-resolved category colour (see --cat in index.css) and its soft glow.
const CATEGORY_COLOR = 'var(--cat)';
const CATEGORY_GLOW = 'color-mix(in srgb, var(--cat) 50%, transparent)';

interface CategoryCardProps {
  category: Category;
}

export const CategoryCard = memo(function CategoryCard({ category }: CategoryCardProps) {
  const allSites = useStore((s) => s.sites);
  const allSubcategories = useStore((s) => s.subcategories);
  const moveSite = useStore((s) => s.moveSite);
  const reorder = useStore((s) => s.reorder);

  const railRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [activeSite, setActiveSite] = useState<Site | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const categorySites = useMemo(
    () =>
      allSites
        .filter((s) => s.categoryId === category.id)
        .sort((a, b) => a.order - b.order),
    [allSites, category.id],
  );

  const subcategories = useMemo(
    () =>
      allSubcategories
        .filter((sub) => sub.categoryId === category.id)
        .sort((a, b) => a.order - b.order),
    [allSubcategories, category.id],
  );

  const primarySites = useMemo(
    () => categorySites.filter((s) => s.primary),
    [categorySites],
  );

  // Groups: "General" (sites with subcategoryId === null) + each subcategory in order
  const railGroups = useMemo<RailGroup[]>(() => {
    const generalSites: Site[] = [];
    const subcatMap = new Map<string, Site[]>();

    for (const sub of subcategories) {
      subcatMap.set(sub.id, []);
    }

    for (const site of categorySites) {
      if (!site.subcategoryId) {
        generalSites.push(site);
      } else {
        const list = subcatMap.get(site.subcategoryId);
        if (list) {
          list.push(site);
        } else {
          generalSites.push(site);
        }
      }
    }

    const groups: RailGroup[] = [];

    if (generalSites.length > 0 || subcategories.length === 0) {
      groups.push({
        id: 'general',
        name: 'General',
        sites: generalSites,
      });
    }

    for (const sub of subcategories) {
      groups.push({
        id: sub.id,
        name: sub.name,
        sites: subcatMap.get(sub.id) || [],
      });
    }

    return groups;
  }, [categorySites, subcategories]);

  const stripGroups = useMemo<GroupItem[]>(
    () =>
      railGroups.map((g) => ({
        id: g.id,
        name: g.name,
        count: g.sites.length,
      })),
    [railGroups],
  );

  const [activeGroupId, setActiveGroupId] = useState<string>(() =>
    railGroups[0]?.id ?? 'general',
  );

  const isProgrammaticScrollRef = useRef(false);
  const scrollTimerRef = useRef<number | null>(null);

  const handlePillSelect = useCallback((id: string) => {
    setActiveGroupId(id);
    if (viewMode === 'list') {
      const container = listContainerRef.current;
      if (!container) return;
      const groupEl = container.querySelector<HTMLElement>(`[data-list-group-id="${id}"]`);
      if (groupEl) {
        // Scroll the list only — scrollIntoView would also move ancestors.
        const top = groupEl.getBoundingClientRect().top - container.getBoundingClientRect().top;
        container.scrollBy({ top, behavior: 'smooth' });
      }
      return;
    }
    const rootEl = railRef.current;
    if (!rootEl) return;
    const cardEl = rootEl.querySelector<HTMLElement>(`[data-subcategory-card-id="${id}"]`);
    if (cardEl) {
      isProgrammaticScrollRef.current = true;
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
      const targetLeft = Math.max(0, cardEl.offsetLeft - 16);
      rootEl.scrollTo({ left: targetLeft, behavior: 'smooth' });
      scrollTimerRef.current = window.setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        scrollTimerRef.current = null;
      }, 450);
    }
  }, [viewMode]);

  const handleDragStart = (event: DragStartEvent) => {
    const site = allSites.find((s) => s.id === event.active.id);
    if (site) {
      setActiveSite(site);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSite(null);

    if (!over) return;

    // Case 1: Dropped onto a Pinned Strip subcategory pill
    if (String(over.id).startsWith('droppable-pill-')) {
      const targetSubcategory = over.data.current?.subcategoryId ?? null;
      moveSite(String(active.id), category.id, targetSubcategory);
      return;
    }

    // Case 2: Reordered within the site list
    if (active.id !== over.id) {
      const activeItem = allSites.find((s) => s.id === active.id);
      const overItem = allSites.find((s) => s.id === over.id);

      if (
        activeItem &&
        overItem &&
        activeItem.categoryId === overItem.categoryId &&
        activeItem.subcategoryId === overItem.subcategoryId
      ) {
        // Group items in this subcategory/general
        const groupSites = allSites.filter(
          (s) =>
            s.categoryId === activeItem.categoryId &&
            s.subcategoryId === activeItem.subcategoryId,
        ).sort((a, b) => a.order - b.order);

        const oldIndex = groupSites.findIndex((s) => s.id === active.id);
        const newIndex = groupSites.findIndex((s) => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedGroup = arrayMove(groupSites, oldIndex, newIndex);
          reorder('site', reorderedGroup.map((s) => s.id));
        }
      }
    }
  };

  const totalSites = categorySites.length;

  // Both theme variants are set once as CSS variables and CSS picks one
  // (index.css: --cat). The card never subscribes to the theme, so a theme
  // switch restyles it without re-rendering ~300 site rows.
  const colorVars = useMemo(
    () =>
      ({
        '--cat-dark': category.color,
        '--cat-light': getCategoryDisplayColor(category.color, true),
      }) as CSSProperties,
    [category.color],
  );
  const displayColor = CATEGORY_COLOR;

  const handlePrevSubcategory = useCallback(() => {
    const idx = railGroups.findIndex((g) => g.id === activeGroupId);
    if (idx > 0) {
      handlePillSelect(railGroups[idx - 1].id);
    }
  }, [railGroups, activeGroupId, handlePillSelect]);

  const handleNextSubcategory = useCallback(() => {
    const idx = railGroups.findIndex((g) => g.id === activeGroupId);
    if (idx < railGroups.length - 1) {
      handlePillSelect(railGroups[idx + 1].id);
    }
  }, [railGroups, activeGroupId, handlePillSelect]);

  const handleBottomWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta > 8) handleNextSubcategory();
    else if (delta < -8) handlePrevSubcategory();
  };

  const currentGroupIndex = railGroups.findIndex((g) => g.id === activeGroupId);

  return (
    <article
      data-category-id={category.id}
      style={colorVars}
      className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 transition-all duration-300 hover:border-white/20 shadow-lg select-none"
    >
      {/* 1. Header Region: colored label + site count + segmented view switcher */}
      <header className="flex items-center justify-between px-4 py-1 border-b border-white/[0.06] select-none shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="size-2.5 rounded-full shrink-0"
            style={{
              backgroundColor: displayColor,
              boxShadow: `0 0 10px ${CATEGORY_GLOW}`,
            }}
          />
          <h2
            className="font-display text-[13px] sm:text-sm font-bold tracking-[0.12em] uppercase truncate"
            style={{ color: displayColor }}
          >
            {category.name}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PinButton categoryId={category.id} name={category.name} />
          <span className="text-xs font-medium text-white/50 tabular-nums">
            {totalSites} {totalSites === 1 ? 'site' : 'sites'}
          </span>
          {/* Segmented View Switcher: Grid vs List (per user request) */}
          <div
            role="group"
            aria-label={`View mode for ${category.name}`}
            className="inline-flex items-center rounded-lg bg-black/35 border border-white/10 p-0.5"
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              title="Grid view: browse subcategories"
              className={`flex size-6 items-center justify-center rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              title="List view: all sites in vertical order by subcategory"
              className={`flex size-6 items-center justify-center rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {totalSites === 0 ? (
        /* Empty category state per SPEC §4 */
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-white/[0.04] text-white/30">
            <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-white/60">Nothing here yet</p>
          <p className="mt-1 text-xs text-white/40">Add a site to this category in Settings</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
            {/* 2. Primary Row Region */}
            <PrimaryRow sites={primarySites} categoryColor={displayColor} />

            {/* 3. Pinned Subcategory Strip */}
            <PinnedStrip
              categoryId={category.id}
              categoryColor={displayColor}
              groups={stripGroups}
              activeId={activeGroupId}
              onSelect={handlePillSelect}
            />

            {/* 4. Subcategory Content: Grid Mode vs List Mode */}
            {viewMode === 'grid' ? (
              <SubcategoryRail
                groups={railGroups}
                categoryColor={displayColor}
                activeId={activeGroupId}
                onActiveChange={setActiveGroupId}
                onSelectGroup={handlePillSelect}
                scrollRef={railRef}
                isProgrammaticScrollRef={isProgrammaticScrollRef}
              />
            ) : (
              <div
                ref={listContainerRef}
                role="region"
                aria-label={`All sites list for ${category.name}`}
                className="flex-1 min-h-0 overflow-y-auto ultra-thin-scrollbar px-3 py-2 space-y-3"
              >
                {railGroups.map((group) => {
                  const groupSiteIds = group.sites.map((s) => s.id);
                  return (
                    <div
                      key={group.id}
                      data-list-group-id={group.id}
                      className="glass-inner rounded-2xl p-3.5 border border-white/[0.06] space-y-2.5"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: displayColor }}
                          />
                          <h3 className="text-sm sm:text-[15px] font-bold text-white/95 tracking-wide">
                            {group.name}
                          </h3>
                        </div>
                        <span className="text-xs font-mono text-white/50 tabular-nums rounded-full bg-white/[0.06] px-2.5 py-0.5">
                          {group.sites.length}
                        </span>
                      </div>

                      {group.sites.length === 0 ? (
                        <p className="text-xs sm:text-sm text-white/35 italic py-1.5 px-1">
                          No sites in this subcategory
                        </p>
                      ) : (
                        <div className="space-y-0.5">
                          <SortableContext items={groupSiteIds} strategy={verticalListSortingStrategy}>
                            {group.sites.map((site) => (
                              <SiteRow
                                key={site.id}
                                site={site}
                                categoryColor={displayColor}
                              />
                            ))}
                          </SortableContext>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 5. Subcategory Bottom Controls: < > Arrows on Left, Dots on Right */}
            {railGroups.length > 1 && (
              <div
                data-category-card-bottom
                onWheel={handleBottomWheel}
                role="toolbar"
                aria-label={`Subcategory navigation for ${category.name}`}
                className="flex items-center justify-between px-3.5 py-1 border-t border-white/[0.06] shrink-0 select-none bg-black/10"
              >
                {/* Left: < > Navigation buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevSubcategory}
                    disabled={currentGroupIndex <= 0}
                    aria-label={`Previous subcategory in ${category.name}`}
                    title="Previous subcategory (<)"
                    className="flex size-6 items-center justify-center rounded-lg text-white/70 hover:bg-white/15 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors"
                  >
                    <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextSubcategory}
                    disabled={currentGroupIndex >= railGroups.length - 1}
                    aria-label={`Next subcategory in ${category.name}`}
                    title="Next subcategory (>)"
                    className="flex size-6 items-center justify-center rounded-lg text-white/70 hover:bg-white/15 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors"
                  >
                    <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                {/* Right: Dots indicator */}
                <div
                  role="tablist"
                  aria-label={`Subcategory dots for ${category.name}`}
                  className="flex items-center gap-1.5"
                >
                  {railGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handlePillSelect(g.id)}
                      tabIndex={-1}
                      aria-label={`dot-${g.id}`}
                      title={`Go to ${g.name}`}
                      className={`h-2 rounded-full transition-all duration-200 ${
                        g.id === activeGroupId
                          ? 'w-5'
                          : 'w-2 bg-white/20 hover:bg-white/50'
                      }`}
                      style={{
                        backgroundColor: g.id === activeGroupId ? displayColor : undefined,
                        boxShadow: g.id === activeGroupId ? `0 0 8px ${CATEGORY_GLOW}` : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <DragOverlay>
            {activeSite ? (
              <div className="w-64">
                <SiteRow
                  site={activeSite}
                  categoryColor={category.color}
                  isOverlay
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </article>
  );
});

// Single-card pin (§7 Q6): pinning this card unpins any other. The grid moves
// the pinned card to the front and anchors it while the rest scroll; the
// card's stored order never changes, so unpinning restores its position.
function PinButton({ categoryId, name }: { categoryId: string; name: string }) {
  const pinned = useStore((s) => s.pinnedCategoryId === categoryId);
  const pinCategory = useStore((s) => s.pinCategory);
  return (
    <button
      type="button"
      onClick={() => pinCategory(pinned ? null : categoryId)}
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${name}` : `Pin ${name}`}
      title={pinned ? 'Unpin — return to its usual place' : 'Pin to the front (one card at a time)'}
      className={`flex size-6 items-center justify-center rounded-md transition-all ${
        pinned
          ? 'bg-[var(--color-accent)]/25 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/60'
          : 'text-white/35 hover:bg-white/10 hover:text-white/80'
      }`}
    >
      <svg
        className={`size-4 transition-transform ${pinned ? '' : 'rotate-45'}`}
        viewBox="0 0 24 24"
        fill={pinned ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 17v5" />
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
      </svg>
    </button>
  );
}
