import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type CollisionDetection,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useStore } from '../../store';
import type { Category, Site, Subcategory } from '../../types';
import { getHostname } from '../../utils';
import { Favicon } from '../Favicon';

// G₁ — Bookmarks & Site Map (§7 Q1): an elongated side drawer with every
// category as a folder tree. Drag a site onto any folder to move it; add,
// rename (double-click) and delete folders; filter across everything.

const NEW_FOLDER_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#4ade80', '#fbbf24', '#fb923c', '#22d3ee', '#f87171'];

export const BookmarkButton = memo(function BookmarkButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Bookmarks and site map"
        title="Bookmarks & site map"
        aria-expanded={open}
        className="glass-raised flex h-[52px] shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3 text-xs font-semibold tracking-wide text-white/80 transition-colors hover:bg-white/10 hover:text-white max-sm:flex-1"
      >
        <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M5 2.5A1.5 1.5 0 003.5 4v13.2a.5.5 0 00.8.4L10 13.5l5.7 4.1a.5.5 0 00.8-.4V4A1.5 1.5 0 0015 2.5H5z" />
        </svg>
      </button>
      <AnimatePresence>{open && <BookmarkDrawer onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
});

type DropTarget = { categoryId: string; subcategoryId: string | null };

function BookmarkDrawer({ onClose }: { onClose: () => void }) {
  const categories = useStore((s) => s.categories);
  const subcategories = useStore((s) => s.subcategories);
  const sites = useStore((s) => s.sites);
  const moveSite = useStore((s) => s.moveSite);
  const addCategory = useStore((s) => s.addCategory);

  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(categories.map((c) => c.id)));
  const [dragging, setDragging] = useState<Site | null>(null);
  const [adding, setAdding] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    filterRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const f = filter.trim().toLowerCase();
  const matches = (s: Site) => !f || s.name.toLowerCase().includes(f) || s.url.toLowerCase().includes(f);

  const tree = useMemo(() => {
    const sortedCats = [...categories].sort((a, b) => a.order - b.order);
    return sortedCats.map((category) => {
      const catSites = sites.filter((s) => s.categoryId === category.id).sort((a, b) => a.order - b.order);
      const subs = subcategories
        .filter((sc) => sc.categoryId === category.id)
        .sort((a, b) => a.order - b.order)
        .map((sub) => ({ sub, sites: catSites.filter((s) => s.subcategoryId === sub.id) }));
      return { category, general: catSites.filter((s) => s.subcategoryId === null), subs, total: catSites.length };
    });
  }, [categories, subcategories, sites]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragStart = (e: DragStartEvent) => setDragging(sites.find((s) => s.id === e.active.id) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const target = over?.data.current as DropTarget | undefined;
    const site = sites.find((s) => s.id === active.id);
    if (!target || !site) return;
    if (site.categoryId === target.categoryId && site.subcategoryId === target.subcategoryId) return;
    moveSite(site.id, target.categoryId, target.subcategoryId);
    setCollapsed((c) => {
      const next = new Set(c);
      next.delete(target.categoryId);
      return next;
    });
  };

  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalMatches = f ? sites.filter(matches).length : sites.length;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      />
      <motion.aside
        role="dialog"
        aria-label="Bookmarks and site map"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="fixed top-0 right-0 bottom-0 z-50 flex w-[min(460px,94vw)] flex-col border-l border-white/10 bg-[var(--color-base-elevated)]/95 backdrop-blur-2xl"
      >
        <header className="flex items-center gap-3 border-b border-white/[0.07] px-5 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-sm font-semibold tracking-[0.18em] text-white">BOOKMARKS · SITE MAP</h2>
            <p className="mt-0.5 font-mono text-[11px] text-white/40">
              {categories.length} folders · {f ? `${totalMatches} of ${sites.length}` : sites.length} sites · drag a site onto a folder to move it
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bookmarks"
            className="flex size-8 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </header>

        <div className="flex gap-2 px-5 py-3">
          <input
            ref={filterRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter bookmarks…"
            aria-label="Filter bookmarks"
            className="glass-inner min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-xl bg-white/10 px-3 text-xs font-semibold text-white/80 hover:bg-white/15 hover:text-white"
          >
            + Folder
          </button>
        </div>

        {adding && (
          <InlineName
            placeholder="New folder name"
            onCancel={() => setAdding(false)}
            onSubmit={(name) => {
              addCategory({ name, color: NEW_FOLDER_COLORS[categories.length % NEW_FOLDER_COLORS.length] });
              setAdding(false);
            }}
            className="mx-5 mb-2"
          />
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <nav aria-label="Site map" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
            <ul role="tree">
              {tree.map(({ category, general, subs, total }) => {
                const visibleGeneral = general.filter(matches);
                const visibleSubs = subs.map((s) => ({ ...s, sites: s.sites.filter(matches) }));
                const hits = visibleGeneral.length + visibleSubs.reduce((n, s) => n + s.sites.length, 0);
                if (f && hits === 0 && !category.name.toLowerCase().includes(f)) return null;
                const isOpen = !!f || !collapsed.has(category.id);
                return (
                  <CategoryNode
                    key={category.id}
                    category={category}
                    total={total}
                    open={isOpen}
                    onToggle={() => toggle(category.id)}
                  >
                    {visibleSubs.map(({ sub, sites: subSites }) =>
                      f && subSites.length === 0 ? null : (
                        <SubcategoryNode key={sub.id} sub={sub} count={subSites.length}>
                          {subSites.map((s) => (
                            <SiteLeaf key={s.id} site={s} />
                          ))}
                        </SubcategoryNode>
                      ),
                    )}
                    {visibleGeneral.map((s) => (
                      <SiteLeaf key={s.id} site={s} />
                    ))}
                  </CategoryNode>
                );
              })}
            </ul>
          </nav>
          {/* Portalled: the drawer's slide-in transform would otherwise offset the
              fixed-position overlay and break collision detection. */}
          {createPortal(
            <DragOverlay dropAnimation={null}>
            {dragging && (
              <div className="glass-raised flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-white shadow-2xl">
                <Favicon url={dragging.url} name={dragging.name} className="size-4" />
                {dragging.name}
              </div>
            )}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      </motion.aside>
    </>
  );
}

function CategoryNode({
  category,
  total,
  open,
  onToggle,
  children,
}: {
  category: Category;
  total: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { isOver, setNodeRef } = useDroppable({
    id: `cat:${category.id}`,
    data: { categoryId: category.id, subcategoryId: null } satisfies DropTarget,
  });

  return (
    <li role="treeitem" aria-expanded={open} aria-label={category.name} data-folder-id={category.id} className="mt-1">
      <div
        ref={setNodeRef}
        className={`group/folder flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
          isOver ? 'bg-[var(--color-accent)]/20 ring-1 ring-[var(--color-accent)]/60' : 'hover:bg-white/5'
        }`}
      >
        <button type="button" onClick={onToggle} aria-label={open ? 'Collapse folder' : 'Expand folder'} className="text-white/40 hover:text-white">
          <svg className={`size-3 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 12 12" fill="currentColor">
            <path d="M4 2.5l4 3.5-4 3.5z" />
          </svg>
        </button>
        <span className="size-2.5 shrink-0 rounded-sm" style={{ background: category.color }} />
        {renaming ? (
          <InlineName
            initial={category.name}
            onCancel={() => setRenaming(false)}
            onSubmit={(name) => {
              updateCategory(category.id, { name });
              setRenaming(false);
            }}
            className="flex-1"
          />
        ) : (
          <span
            onDoubleClick={() => setRenaming(true)}
            title="Double-click to rename"
            className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90"
          >
            {category.name}
          </span>
        )}
        <span className="font-mono text-[10px] text-white/35">{total}</span>
        {!renaming && !confirmDelete && (
          <span className="flex gap-0.5 opacity-0 transition-opacity group-hover/folder:opacity-100 focus-within:opacity-100">
            <IconAction label={`Rename ${category.name}`} onClick={() => setRenaming(true)}>
              ✎
            </IconAction>
            <IconAction label={`Delete ${category.name}`} onClick={() => setConfirmDelete(true)} danger>
              🗑
            </IconAction>
          </span>
        )}
      </div>
      {confirmDelete && (
        <div role="alert" className="mx-2 mb-1 flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-200">
          <span className="flex-1">
            Delete “{category.name}” and its {total} site{total === 1 ? '' : 's'}?
          </span>
          <button type="button" onClick={() => deleteCategory(category.id)} className="rounded-md bg-red-500/40 px-2 py-0.5 font-semibold text-white hover:bg-red-500/60">
            Delete
          </button>
          <button type="button" onClick={() => setConfirmDelete(false)} className="text-white/60 hover:text-white">
            Cancel
          </button>
        </div>
      )}
      {open && <ul role="group" className="ml-[13px] border-l border-white/10 pl-2">{children}</ul>}
    </li>
  );
}

function SubcategoryNode({ sub, count, children }: { sub: Subcategory; count: number; children: ReactNode }) {
  const updateSubcategory = useStore((s) => s.updateSubcategory);
  const deleteSubcategory = useStore((s) => s.deleteSubcategory);
  const [renaming, setRenaming] = useState(false);
  const { isOver, setNodeRef } = useDroppable({
    id: `sub:${sub.id}`,
    data: { categoryId: sub.categoryId, subcategoryId: sub.id } satisfies DropTarget,
  });

  return (
    <li role="treeitem" aria-label={sub.name} className="mt-0.5">
      <div
        ref={setNodeRef}
        className={`group/sub flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${
          isOver ? 'bg-[var(--color-accent)]/20 ring-1 ring-[var(--color-accent)]/60' : 'hover:bg-white/5'
        }`}
      >
        <span className="text-[11px] text-white/35">▸</span>
        {renaming ? (
          <InlineName
            initial={sub.name}
            onCancel={() => setRenaming(false)}
            onSubmit={(name) => {
              updateSubcategory(sub.id, { name });
              setRenaming(false);
            }}
            className="flex-1"
          />
        ) : (
          <span onDoubleClick={() => setRenaming(true)} className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-white/65 uppercase">
            {sub.name}
          </span>
        )}
        <span className="font-mono text-[10px] text-white/30">{count}</span>
        <span className="flex gap-0.5 opacity-0 group-hover/sub:opacity-100">
          <IconAction label={`Rename ${sub.name}`} onClick={() => setRenaming(true)}>
            ✎
          </IconAction>
          {/* Its sites fall back to the category's General group (store rule). */}
          <IconAction label={`Delete ${sub.name} (sites move to General)`} onClick={() => deleteSubcategory(sub.id)} danger>
            🗑
          </IconAction>
        </span>
      </div>
      <ul role="group" className="ml-3 border-l border-white/[0.07] pl-2">
        {children}
      </ul>
    </li>
  );
}

function SiteLeaf({ site }: { site: Site }) {
  const recordVisit = useStore((s) => s.recordVisit);
  // dnd-kit's attributes include role="button"; drop it so the leaf stays a link.
  const { attributes: { role: _role, ...attributes }, listeners, setNodeRef, isDragging } = useDraggable({ id: site.id });
  return (
    <li role="treeitem" aria-label={site.name} data-site-leaf={site.id}>
      <a
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        href={site.url}
        onClick={() => recordVisit(site.id)}
        className={`flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-white/80 hover:bg-white/[0.06] hover:text-white ${
          isDragging ? 'opacity-30' : ''
        } cursor-grab active:cursor-grabbing`}
      >
        <Favicon url={site.url} name={site.name} className="size-4 shrink-0" />
        <span className="truncate">{site.name}</span>
        <span className="ml-auto truncate font-mono text-[10px] text-white/30">{getHostname(site.url)}</span>
      </a>
    </li>
  );
}

function IconAction({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-6 items-center justify-center rounded-md text-xs text-white/45 ${
        danger ? 'hover:bg-red-500/20 hover:text-red-300' : 'hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function InlineName({
  initial = '',
  placeholder,
  onSubmit,
  onCancel,
  className = '',
}: {
  initial?: string;
  placeholder?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const commit = () => {
    const name = value.trim();
    if (name) onSubmit(name);
    else onCancel();
  };
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      aria-label={placeholder ?? 'Folder name'}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation(); // keep Escape from closing the whole drawer
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onCancel();
      }}
      className={`min-w-0 rounded-md bg-white/10 px-2 py-1 text-sm text-white outline-none ring-1 ring-[var(--color-accent)]/50 ${className}`}
    />
  );
}

// Folders are thin rows, so the pointer position is the honest drop signal;
// fall back to rectangle overlap when the pointer is between rows.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};
