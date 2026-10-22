import { useState, type CSSProperties, type FormEvent } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../../store';
import type { QuickLink } from '../../types';
import { Favicon } from '../Favicon';
import { normalizeUrl } from '../../utils';

function SortableQuickLinkItem({
  link,
  onEdit,
  onDelete,
}: {
  link: QuickLink;
  onEdit: (link: QuickLink) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass-inner flex items-center justify-between gap-3 p-3 rounded-xl transition-colors hover:border-white/20"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Reorder quick link"
          className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/70"
        >
          <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 2a2 2 0 100 4 2 2 0 000-4zM7 8a2 2 0 100 4 2 2 0 000-4zM7 14a2 2 0 100 4 2 2 0 000-4zM13 2a2 2 0 100 4 2 2 0 000-4zM13 8a2 2 0 100 4 2 2 0 000-4zM13 14a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
        </button>
        <Favicon url={link.url} name={link.name} className="size-5" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">{link.name}</p>
          <p className="truncate text-[10px] text-white/40">{link.url}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(link)}
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          title="Edit quick link"
        >
          <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onDelete(link.id)}
          className="rounded-lg p-1.5 text-red-400/60 hover:bg-red-500/15 hover:text-red-400 transition-colors"
          title="Delete quick link"
        >
          <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function QuickLinksTab() {
  const quickLinks = useStore((s) => s.quickLinks);
  const addQuickLink = useStore((s) => s.addQuickLink);
  const updateQuickLink = useStore((s) => s.updateQuickLink);
  const deleteQuickLink = useStore((s) => s.deleteQuickLink);
  const reorder = useStore((s) => s.reorder);

  const [isAdding, setIsAdding] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const sortedLinks = [...quickLinks].sort((a, b) => a.order - b.order);

  const handleOpenAdd = () => {
    setEditingLink(null);
    setName('');
    setUrl('');
    setIsAdding(true);
  };

  const handleOpenEdit = (link: QuickLink) => {
    setEditingLink(link);
    setName(link.name);
    setUrl(link.url);
    setIsAdding(true);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    const normalizedUrl = normalizeUrl(url);

    if (editingLink) {
      updateQuickLink(editingLink.id, { name: name.trim(), url: normalizedUrl });
    } else {
      addQuickLink({ name: name.trim(), url: normalizedUrl });
    }

    setIsAdding(false);
    setEditingLink(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sortedLinks.findIndex((l) => l.id === active.id);
      const newIndex = sortedLinks.findIndex((l) => l.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(sortedLinks, oldIndex, newIndex);
        reorder('quickLink', reordered.map((l) => l.id));
      }
    }
  };

  return (
    <div className="space-y-5 text-sm text-white/90">
      <div className="flex items-center justify-end">
        {!isAdding && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 transition-colors"
          >
            + Add Link
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="glass-inner space-y-4 p-4 rounded-xl border-white/20">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
            {editingLink ? 'Edit Quick Link' : 'New Quick Link'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Mail)"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
              required
            />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL (e.g. mail.google.com)"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-white shadow-lg hover:opacity-95"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* Drag & drop list of quick links */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext
          items={sortedLinks.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sortedLinks.map((link) => (
              <SortableQuickLinkItem
                key={link.id}
                link={link}
                onEdit={handleOpenEdit}
                onDelete={deleteQuickLink}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <StripSettings />
    </div>
  );
}

// E/F strip behaviour (§7 Q7/Q8): the first 5 links above stay fixed; this
// controls what scrolls after them.
function StripSettings() {
  const autoCount = useStore((s) => s.settings.autoQuickLinkCount);
  const recentCount = useStore((s) => s.settings.recentLinkCount);
  const updateSettings = useStore((s) => s.updateSettings);
  const clearRecentHistory = useStore((s) => s.clearRecentHistory);
  const [cleared, setCleared] = useState(false);

  return (
    <section aria-label="After the pinned links" className="set-card space-y-4 rounded-2xl border p-5">
      <h3 className="set-card-title text-[13.5px] font-semibold">After the pinned links</h3>
      <p className="set-card-hint -mt-3 text-[12px] leading-relaxed">
        The first 5 links are pinned to the left of the strip. After them come auto-picked sites (most visited,
        boosted by recency), then your recently opened sites.
      </p>
      <label className="block space-y-1.5">
        <span className="set-label flex justify-between text-[12px] font-semibold">
          Auto-picked links <span className="font-mono text-white/60">{autoCount}</span>
        </span>
        <input
          type="range"
          min={2}
          max={15}
          value={autoCount}
          onChange={(e) => updateSettings({ autoQuickLinkCount: Number(e.target.value) })}
          aria-label="Auto-picked links"
          className="w-full accent-[var(--color-accent)]"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="set-label flex justify-between text-[12px] font-semibold">
          Recent links <span className="font-mono text-white/60">{recentCount}</span>
        </span>
        <input
          type="range"
          min={0}
          max={15}
          value={recentCount}
          onChange={(e) => updateSettings({ recentLinkCount: Number(e.target.value) })}
          aria-label="Recent links"
          className="w-full accent-[var(--color-accent)]"
        />
      </label>
      <button
        type="button"
        onClick={() => {
          clearRecentHistory();
          setCleared(true);
        }}
        className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white"
      >
        {cleared ? 'Recent history cleared' : 'Clear recent history'}
      </button>
    </section>
  );
}
