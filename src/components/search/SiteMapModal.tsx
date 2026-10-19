import { openInNewTab } from '../../lib/openTab';
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import type { Category } from '../../types';
import { getCategoryDisplayColor, getHostname, searchSites } from '../../utils';
import { Favicon } from '../Favicon';
import { BinGlyph, SiteFormDialog } from '../library/SiteFormDialog';
import { showUndo } from '../ui/UndoToast';
import { deleteSubcategoryWithUndo } from '../library/deleteSubcategory';
import { Masonry } from '../ui/Masonry';
import { nextFreeColor } from '../../lib/palette';
import { UNCATEGORIZED_COLOR, UNCATEGORIZED_NAME } from '../../lib/categories';

// Site Map & Hierarchy: every site in the library at a glance.
//   no query → a grid of category cards; each lists its General sites, then
//              one uppercase section per subcategory, as favicon chips. The
//              Currently Processing items come first in their own card.
//              Editing happens right here and shows on the deck at once:
//              double-click a category or subcategory name to rename it,
//              "+ Add site" adds one, and chips drag onto any other section.
//   query    → a command-palette list: favicon, name, URL and the coloured
//              Category → Subcategory path; ↑/↓ move, Enter opens
//              (Ctrl/⌘+Enter → new tab), Esc clears, then closes.

const RESULT_LIMIT = 40;
const PROCESSING_COLOR = '#f59e0b';
const GENERAL = 'general'; // the implicit group of sites with no subcategory
const SITE_MIME = 'application/x-devdeck-site';

export const SiteMapButton = memo(function SiteMapButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Site Map & Hierarchy"
        title="Site Map & Hierarchy"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="glass-raised flex h-[52px] shrink-0 items-center justify-center gap-1.5 rounded-2xl px-2.5 text-xs font-semibold tracking-wide text-white/80 transition-colors hover:bg-white/10 hover:text-white max-sm:flex-1"
      >
        <HierarchyIcon className="size-4" />
        <span className="hidden min-[1700px]:inline">SITE MAP</span>
      </button>
      {createPortal(<AnimatePresence>{open && <SiteMapModal onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
});

type Result = {
  key: string;
  name: string;
  url: string;
  siteId: string | null;
  path: [string, string]; // [category, subcategory or section]
  color: string; // category colour (dark theme value)
};

const catVars = (color: string) =>
  ({ '--cat-dark': color, '--cat-light': getCategoryDisplayColor(color, true) }) as CSSProperties;

function SiteMapModal({ onClose }: { onClose: () => void }) {
  const categories = useStore((s) => s.categories);
  const subcategories = useStore((s) => s.subcategories);
  const sites = useStore((s) => s.sites);
  const processing = useStore((s) => s.processing);
  const recordVisit = useStore((s) => s.recordVisit);

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const q = query.trim();

  // End the drag look on any drop or drag end. Listened to in the capture
  // phase: a chip dropped on a bin is removed before its own dragend fires,
  // and the bin stops the drop from bubbling.
  useEffect(() => {
    if (!dragging) return;
    const end = () => setDragging(false);
    window.addEventListener('drop', end, true);
    window.addEventListener('dragend', end, true);
    return () => {
      window.removeEventListener('drop', end, true);
      window.removeEventListener('dragend', end, true);
    };
  }, [dragging]);

  // Esc also closes the map when focus has dropped to the page (e.g. after the
  // Add Site window closes); inside the map its own key handler does it.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = document.activeElement;
      if (el && el !== document.body && el.closest('[role="dialog"]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const tree = useMemo(() => {
    return [...categories]
      .sort((a, b) => a.order - b.order)
      .map((category) => {
        const catSites = sites.filter((s) => s.categoryId === category.id).sort((a, b) => a.order - b.order);
        const groups = subcategories
          .filter((sc) => sc.categoryId === category.id)
          .sort((a, b) => a.order - b.order)
          .map((sub) => ({ id: sub.id, name: sub.name, sites: catSites.filter((s) => s.subcategoryId === sub.id) }));
        const general = catSites.filter((s) => s.subcategoryId === null);
        return {
          category,
          total: catSites.length,
          groups: [{ id: GENERAL, name: 'General', sites: general }, ...groups],
        };
      });
  }, [categories, subcategories, sites]);

  const uncategorized = useMemo(() => sites.filter((s) => s.categoryId === '').sort((a, b) => a.order - b.order), [sites]);

  const processingGroups = useMemo(() => {
    const bySection = new Map<string, typeof processing>();
    for (const item of [...processing].sort((a, b) => a.order - b.order)) {
      const section = item.section || 'General';
      bySection.set(section, [...(bySection.get(section) ?? []), item]);
    }
    return [...bySection].map(([name, items]) => ({ name, items }));
  }, [processing]);

  const results = useMemo<Result[]>(() => {
    if (!q) return [];
    const siteResults: Result[] = searchSites(q, sites, categories, subcategories)
      .slice(0, RESULT_LIMIT)
      .map(({ site, category, subcategory }) => ({
        key: site.id,
        name: site.name,
        url: site.url,
        siteId: site.id,
        path: [category.name, subcategory?.name ?? 'General'],
        color: category.color,
      }));
    const needle = q.toLowerCase();
    const processingResults: Result[] = processing
      .filter((p) => p.name.toLowerCase().includes(needle) || p.url.toLowerCase().includes(needle))
      .map((p) => ({
        key: `p-${p.id}`,
        name: p.name,
        url: p.url,
        siteId: p.siteId,
        path: ['Currently Processing', p.section || 'General'],
        color: PROCESSING_COLOR,
      }));
    return [...siteResults, ...processingResults];
  }, [q, sites, categories, subcategories, processing]);

  // Keep the highlighted row in view without scrolling the page behind.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop - 8;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight + 8;
  }, [active]);

  const open = (url: string, siteId: string | null, newTab: boolean) => {
    if (siteId) recordVisit(siteId);
    void newTab; // always a new tab: the start page stays put
    openInNewTab(url);
  };

  const onChipClick = (e: MouseEvent<HTMLAnchorElement>, siteId: string | null) => {
    if (siteId) recordVisit(siteId);
    // Plain clicks follow the link in place; modifier clicks keep the browser's behaviour.
    if (!(e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) setQuery('');
      else onClose();
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[active];
      if (r) open(r.url, r.siteId, e.ctrlKey || e.metaKey);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-[5vh] pb-6">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Site Map & Hierarchy"
          data-drag-zone="sitemap"
          onKeyDown={onKeyDown}
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          className="sitemap-panel pointer-events-auto flex max-h-[88vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[var(--color-base-elevated)]/[0.97] shadow-2xl backdrop-blur-2xl"
        >
          <header className="flex items-center gap-3 px-6 pt-5 pb-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              <HierarchyIcon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[15px] font-semibold text-white">Site Map &amp; Hierarchy</h2>
              <p className="font-mono text-[11px] text-white/45">
                {sites.length} sites · {tree.length} categories · {processing.length} in progress
              </p>
            </div>
            <NewCategoryButton />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close site map"
              className="flex size-8 items-center justify-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </header>

          <div className="px-6 pb-4">
            <div className="sitemap-field flex h-14 items-center gap-3 rounded-2xl border px-4">
              <svg className="size-5 shrink-0 text-white/45" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Search every site, category and subcategory…"
                aria-label="Search the site map"
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="sitemap-results"
                aria-activedescendant={results.length ? `sitemap-opt-${active}` : undefined}
                spellCheck={false}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[16px] text-white placeholder-white/35 outline-none focus-visible:outline-none"
              />
              {q && (
                <span className="shrink-0 font-mono text-[11px] text-white/40">
                  {results.length} result{results.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>

          {q ? (
            <>
              <div
                ref={listRef}
                id="sitemap-results"
                role="listbox"
                aria-label="Site map results"
                className="relative min-h-0 flex-1 overflow-y-auto border-t border-white/[0.07] px-3 py-2"
              >
                {results.map((r, i) => (
                  <div
                    key={r.key}
                    id={`sitemap-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={active === i}
                    onMouseMove={() => active !== i && setActive(i)}
                    onClick={(e) => open(r.url, r.siteId, e.ctrlKey || e.metaKey)}
                    style={catVars(r.color)}
                    className="sitemap-row cat-scope flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5"
                  >
                    <Favicon url={r.url} name={r.name} categoryColor={r.color} className="size-8 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-white">{r.name}</span>
                      <span className="block truncate font-mono text-[11px] text-white/45">{r.url.replace(/^https?:\/\//, '')}</span>
                    </span>
                    <span className="ml-3 flex shrink-0 items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--cat)' }}>
                      {r.path[0]}
                      <span className="text-white/30">→</span>
                      <span className="opacity-80">{r.path[1]}</span>
                    </span>
                  </div>
                ))}
                {results.length === 0 && (
                  <p className="px-3 py-10 text-center text-sm text-white/45">No sites match “{q}”.</p>
                )}
              </div>
              <footer className="flex items-center gap-5 border-t border-white/[0.07] px-6 py-2.5 font-mono text-[11px] text-white/45">
                <span>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> Navigate
                </span>
                <span>
                  <Kbd>↵</Kbd> Open
                </span>
                <span>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>↵</Kbd> New tab
                </span>
                <span className="ml-auto">
                  <Kbd>Esc</Kbd> Clear
                </span>
              </footer>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/[0.07] px-6 pt-3 pb-6">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p className="text-[11px] text-white/45">
                  Double-click a name to rename it · drag a site onto another section, another site, or a bin · changes show on your deck instantly
                </p>
              </div>
              <Masonry gap={16} minColumn={300}>
                <MapCard
                  title="Currently Processing"
                  color={PROCESSING_COLOR}
                  count={processing.length}
                  testId="sitemap-processing"
                >
                  {processingGroups.length === 0 && (
                    <p className="text-xs text-white/40">Nothing in progress — add items from the Currently Processing panel.</p>
                  )}
                  {processingGroups.map((g) => (
                    <Section key={g.name} name={g.name} count={g.items.length}>
                      {g.items.map((p) => (
                        <Chip key={p.id} name={p.name} url={p.url} color={PROCESSING_COLOR} onClick={(e) => onChipClick(e, p.siteId)} />
                      ))}
                    </Section>
                  ))}
                </MapCard>
                {tree.map(({ category, total, groups }) => (
                  <CategoryMapCard
                    key={category.id}
                    category={category}
                    total={total}
                    groups={groups}
                    dragging={dragging}
                    onDragState={setDragging}
                    onChipClick={onChipClick}
                  />
                ))}
                {uncategorized.length > 0 && (
                  <MapCard
                    title={`${UNCATEGORIZED_NAME} / None`}
                    color={UNCATEGORIZED_COLOR}
                    count={uncategorized.length}
                    testId="sitemap-uncategorized"
                  >
                    <p className="-mt-1 text-[10.5px] text-white/40">No category — drag a site onto any section to file it.</p>
                    <div className="flex flex-wrap gap-1.5 after:h-0 after:grow-[999] after:content-['']">
                      {uncategorized.map((s) => (
                        <Chip
                          key={s.id}
                          name={s.name}
                          url={s.url}
                          color={UNCATEGORIZED_COLOR}
                          siteId={s.id}
                          onDragState={setDragging}
                          onClick={(e) => onChipClick(e, s.id)}
                        />
                      ))}
                    </div>
                  </MapCard>
                )}
              </Masonry>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}

type MapGroup = { id: string; name: string; sites: Array<{ id: string; name: string; url: string }> };

function CategoryMapCard({
  category,
  total,
  groups,
  dragging,
  onDragState,
  onChipClick,
}: {
  category: Category;
  total: number;
  groups: MapGroup[];
  dragging: boolean;
  onDragState: (dragging: boolean) => void;
  onChipClick: (e: MouseEvent<HTMLAnchorElement>, siteId: string | null) => void;
}) {
  const updateCategory = useStore((s) => s.updateCategory);
  const updateSubcategory = useStore((s) => s.updateSubcategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const addSubcategory = useStore((s) => s.addSubcategory);
  const placeSite = useStore((s) => s.placeSite);
  const [adding, setAdding] = useState(false);
  const [newSub, setNewSub] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  return (
    <MapCard
      title={category.name}
      color={category.color}
      count={total}
      categoryId={category.id}
      titleNode={
        <EditableName
          value={category.name}
          label={`Rename category ${category.name}`}
          onSave={(name) => updateCategory(category.id, { name })}
          className="truncate font-display text-[12px] font-bold tracking-[0.16em] uppercase"
          style={{ color: 'var(--cat)' }}
        />
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            aria-label={`Delete category ${category.name}`}
            title="Delete this category"
            className="sitemap-icon-btn sitemap-danger flex size-6 items-center justify-center rounded-md"
          >
            <BinGlyph className="size-3.5" />
          </button>
        </>
      }
    >
      {confirm && (
        <div role="alertdialog" aria-label={`Delete ${category.name}?`} className="sitemap-confirm rounded-xl border p-3 text-[11.5px]">
          <p className="text-white/85">
            Delete <b>{category.name}</b>{total ? ` and its ${total} site${total === 1 ? '' : 's'}` : ''}? Sites go to the recycle bin (restore them from “+ Add site”).
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(false)} className="rounded-md px-2.5 py-1 text-white/60 hover:bg-white/10">
              Cancel
            </button>
            <button type="button" onClick={() => deleteCategory(category.id)} className="rounded-md bg-red-500/80 px-2.5 py-1 font-semibold text-white hover:bg-red-500">
              Delete category
            </button>
          </div>
        </div>
      )}
      {groups.map((g) =>
        g.sites.length === 0 && g.id === GENERAL && !dragging ? null : (
          <Section
            key={g.id}
            name={g.name}
            count={g.sites.length}
            nameNode={
              g.id === GENERAL ? undefined : (
                <EditableName value={g.name} label={`Rename subcategory ${g.name}`} onSave={(name) => updateSubcategory(g.id, { name })} />
              )
            }
            onDelete={
              g.id === GENERAL
                ? undefined
                : () => deleteSubcategoryWithUndo(g.id)
            }
            deleteLabel={`Delete section ${g.name} (its sites go to the recycle bin)`}
            onDropSite={(siteId, before) => placeSite(siteId, category.id, g.id === GENERAL ? null : g.id, before ?? null)}
            dropId={`${category.id}/${g.id}`}
          >
            {g.sites.map((site) => (
              <Chip
                key={site.id}
                siteId={site.id}
                name={site.name}
                url={site.url}
                color={category.color}
                onClick={(e) => onChipClick(e, site.id)}
                onDragState={onDragState}
              />
            ))}
            {g.sites.length === 0 && (
              <span className="rounded-lg border border-dashed border-white/15 px-2.5 py-1 text-[11px] text-white/35">Drop sites here</span>
            )}
          </Section>
        ),
      )}
      {/* New subcategory: Enter or Add creates it; clicking anywhere else just closes the field. */}
      {newSub !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newSub.trim()) addSubcategory({ name: newSub.trim(), categoryId: category.id });
            setNewSub(null);
          }}
          className="flex gap-1.5"
        >
          <input
            autoFocus
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onBlur={() => setNewSub(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setNewSub(null);
              }
            }}
            placeholder="New subcategory name"
            aria-label="New subcategory name"
            className="sitemap-input min-w-0 flex-1 rounded-md border px-2 py-1 text-[12px] outline-none"
          />
          {/* mousedown keeps the field focused, so Add isn't cancelled by the blur */}
          <button type="submit" onMouseDown={(e) => e.preventDefault()} className="accent-gradient rounded-md px-2.5 text-[11px] font-semibold text-white">
            Add
          </button>
        </form>
      )}
      <div className="mt-auto flex items-center gap-2 border-t border-white/[0.08] pt-3">
        <button
          type="button"
          onClick={() => setNewSub('')}
          aria-label={`Add a subcategory to ${category.name}`}
          className="sitemap-add rounded-lg border border-dashed px-2.5 py-1 text-[11px] font-semibold text-white/55 transition-colors hover:text-white"
        >
          + Sub category
        </button>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="sitemap-add rounded-lg border border-dashed px-2.5 py-1 text-[11px] font-semibold text-white/55 transition-colors hover:text-white"
        >
          + Add site
        </button>
        <SiteBin categoryName={category.name} />
      </div>
      {adding && <SiteFormDialog categoryId={category.id} onClose={() => setAdding(false)} />}
    </MapCard>
  );
}

// The recycle bin in a card's corner: drop a site on it to delete it. The lid
// swings open while a site hovers over it and snaps shut on the drop.
function SiteBin({ categoryName }: { categoryName: string }) {
  const deleteSite = useStore((s) => s.deleteSite);
  const restoreSite = useStore((s) => s.restoreSite);
  const [over, setOver] = useState(false);
  const [gulp, setGulp] = useState(false);
  return (
    <div
      role="button"
      aria-label={`Recycle bin for ${categoryName}: drop a site here to delete it`}
      title="Drop a site here to delete it (restore from + Add site)"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(SITE_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const id = e.dataTransfer.getData(SITE_MIME);
        const site = useStore.getState().sites.find((x) => x.id === id);
        if (!site) return;
        deleteSite(id);
        setGulp(true);
        setTimeout(() => setGulp(false), 450);
        showUndo(`Deleted ${site.name}`, () => restoreSite(id, site.categoryId, site.subcategoryId));
      }}
      data-testid="sitemap-bin"
      className={`sitemap-bin ml-auto flex size-9 shrink-0 items-center justify-center rounded-xl border transition-all ${over ? 'is-over' : ''} ${gulp ? 'is-gulp' : ''}`}
    >
      <BinGlyph className="size-[18px]" open={over} />
    </div>
  );
}

// + New Category (top of the Site Map, like Settings → Library): the button
// turns into a name field and a colour picker, right there in the header.
// The colour starts as one no category uses yet; Enter adds, Esc cancels.
function NewCategoryButton() {
  const categories = useStore((s) => s.categories);
  const addCategory = useStore((s) => s.addCategory);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const start = () => {
    setColor(nextFreeColor(categories.map((c) => c.color)));
    setName('');
    setOpen(true);
  };
  if (!open)
    return (
      <button
        type="button"
        onClick={start}
        className="sitemap-new-cat flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium text-white"
      >
        + New Category
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        addCategory({ name: name.trim(), color });
        setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setOpen(false);
        }
      }}
      className="flex shrink-0 items-center gap-2"
    >
      <label className="sitemap-color flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border" title="Category colour">
        <span className="size-4 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Category colour" className="sr-only" />
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Category name"
        aria-label="New category name"
        className="sitemap-input h-8 w-48 rounded-lg border px-2.5 text-[12px] outline-none"
      />
      <button type="submit" className="h-8 rounded-lg bg-[var(--color-accent)] px-3.5 text-xs font-semibold text-white hover:opacity-90">
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cancel new category" className="h-8 rounded-lg px-2 text-xs text-white/50 hover:bg-white/5 hover:text-white">
        Cancel
      </button>
    </form>
  );
}

function EditableName({
  value,
  label,
  onSave,
  className = '',
  style,
}: {
  value: string;
  label: string;
  onSave: (name: string) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const start = () => {
    setDraft(value);
    setEditing(true);
  };
  const commit = () => {
    const name = draft.trim();
    if (name && name !== value) onSave(name);
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          e.stopPropagation(); // keep Esc from closing the site map
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setEditing(false);
        }}
        className={`sitemap-rename min-w-0 flex-1 rounded-md border px-1.5 py-0.5 outline-none ${className}`}
        style={style}
      />
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      title="Double-click to rename"
      aria-label={label}
      onDoubleClick={start}
      onKeyDown={(e) => e.key === 'Enter' && start()}
      className={`cursor-text rounded-md px-0.5 hover:bg-white/[0.06] ${className}`}
      style={style}
    >
      {value}
    </span>
  );
}

function MapCard({
  title,
  color,
  count,
  testId,
  categoryId,
  titleNode,
  actions,
  footer,
  children,
}: {
  title: string;
  color: string;
  count: number;
  testId?: string;
  categoryId?: string;
  titleNode?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      data-testid={testId}
      data-sitemap-category={categoryId}
      style={catVars(color)}
      className="sitemap-card cat-scope relative flex flex-col gap-3 rounded-2xl border p-4"
    >
      <header className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: 'var(--cat)', boxShadow: '0 0 8px var(--cat)' }} />
        {titleNode ?? (
          <h3 className="truncate font-display text-[12px] font-bold tracking-[0.16em] uppercase" style={{ color: 'var(--cat)' }}>
            {title}
          </h3>
        )}
        <span className="ml-auto rounded-full bg-white/[0.07] px-2 font-mono text-[10px] text-white/55">{count}</span>
        {actions}
      </header>
      {children}
      {footer}
    </section>
  );
}

function Section({
  name,
  count,
  nameNode,
  onDropSite,
  dropId,
  onDelete,
  deleteLabel,
  children,
}: {
  name: string;
  count: number;
  nameNode?: ReactNode;
  onDropSite?: (siteId: string, beforeSiteId?: string) => void;
  onDelete?: () => void;
  deleteLabel?: string;
  dropId?: string;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const accepts = (e: DragEvent) => !!onDropSite && e.dataTransfer.types.includes(SITE_MIME);
  return (
    <div
      data-sitemap-section={dropId}
      onDragOver={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        setOver(false);
        if (!accepts(e)) return;
        e.preventDefault();
        const id = e.dataTransfer.getData(SITE_MIME);
        // Dropped on a chip: land just before it. Elsewhere in the section: last.
        const before = (e.target as Element).closest?.('[data-sitemap-site]')?.getAttribute('data-sitemap-site') ?? undefined;
        if (id && before !== id) onDropSite?.(id, before);
      }}
      className={`-mx-1.5 rounded-xl px-1.5 py-1 transition-colors ${over ? 'sitemap-drop-over' : ''}`}
    >
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-white/45 uppercase">
        {nameNode ?? <span>{name}</span>}
        <span className="h-px flex-1 bg-white/[0.07]" />
        <span className="font-mono tracking-normal text-white/35">{count}</span>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={deleteLabel}
            title={deleteLabel}
            className="sitemap-icon-btn sitemap-danger flex size-5 items-center justify-center rounded-md normal-case"
          >
            <BinGlyph className="size-3" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 after:h-0 after:grow-[999] after:content-['']">{children}</div>
    </div>
  );
}

function Chip({
  name,
  url,
  color,
  onClick,
  siteId,
  onDragState,
}: {
  name: string;
  url: string;
  color: string;
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void;
  siteId?: string;
  onDragState?: (dragging: boolean) => void;
}) {
  return (
    <a
      href={url}
      onClick={onClick}
      onAuxClick={onClick}
      data-sitemap-site={siteId}
      draggable={siteId ? true : undefined}
      onDragStart={
        siteId
          ? (e) => {
              e.dataTransfer.setData(SITE_MIME, siteId);
              e.dataTransfer.setData('text/uri-list', url);
              e.dataTransfer.effectAllowed = 'move';
              onDragState?.(true);
            }
          : undefined
      }
      onDragEnd={siteId ? () => onDragState?.(false) : undefined}
      // Mark the chip a dragged site would land in front of.
      onDragOver={(e) => e.dataTransfer.types.includes(SITE_MIME) && e.currentTarget.classList.add('chip-drop-before')}
      onDragLeave={(e) => e.currentTarget.classList.remove('chip-drop-before')}
      onDrop={(e) => e.currentTarget.classList.remove('chip-drop-before')}
      title={`${name} — ${getHostname(url)}`}
      className="sitemap-chip flex max-w-full grow items-center gap-1.5 rounded-lg border py-1 pr-2.5 pl-1.5 text-[12px] font-medium text-white/85 transition-colors hover:text-white"
    >
      <Favicon url={url} name={name} categoryColor={color} className="size-4 shrink-0 rounded" />
      <span className="truncate">{name}</span>
    </a>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="mr-1 inline-flex min-w-[18px] items-center justify-center rounded border border-white/15 bg-white/[0.06] px-1 py-px text-[10px] text-white/60">
      {children}
    </kbd>
  );
}

function HierarchyIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="7.5" y="2.5" width="5" height="4" rx="1" />
      <rect x="2.5" y="13.5" width="5" height="4" rx="1" />
      <rect x="12.5" y="13.5" width="5" height="4" rx="1" />
      <path d="M10 6.5v3.5M5 13.5V10h10v3.5" strokeLinejoin="round" />
    </svg>
  );
}
