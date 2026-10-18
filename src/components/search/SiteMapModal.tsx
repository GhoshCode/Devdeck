import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import type { Category } from '../../types';
import { deriveNameFromUrl, getCategoryDisplayColor, getHostname, normalizeUrl, searchSites } from '../../utils';
import { Favicon } from '../Favicon';
import { Select } from '../ui/Select';

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
    if (newTab) window.open(url, '_blank', 'noopener');
    else window.location.assign(url);
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
              <p className="mb-3 text-[11px] text-white/45">
                Double-click a name to rename it · drag a site onto another section to move it · changes show on your deck instantly
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              </div>
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
  const placeSite = useStore((s) => s.placeSite);
  const [adding, setAdding] = useState(false);

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
    >
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
      {adding ? (
        <AddSiteForm categoryId={category.id} groups={groups} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="sitemap-add self-start rounded-lg border border-dashed px-2.5 py-1 text-[11px] font-semibold text-white/55 transition-colors hover:text-white"
        >
          + Add site
        </button>
      )}
    </MapCard>
  );
}

// Click-free rename: double-click (or Enter when focused) turns the name into
// a field; Enter or leaving it saves, Esc cancels. Empty names are ignored.
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

function AddSiteForm({ categoryId, groups, onDone }: { categoryId: string; groups: MapGroup[]; onDone: () => void }) {
  const addSite = useStore((s) => s.addSite);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [group, setGroup] = useState(GENERAL);
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    try {
      new URL(normalized);
    } catch {
      return setError('Enter a valid web address');
    }
    if (!normalized) return setError('Enter a web address');
    addSite({ name: name.trim() || deriveNameFromUrl(normalized) || normalized, url: normalized, categoryId, subcategoryId: group === GENERAL ? null : group });
    setUrl('');
    setName('');
    setError('');
    onDone();
  };
  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onDone();
        }
      }}
      aria-label="Add a site"
      className="sitemap-addform flex flex-col gap-1.5 rounded-xl border p-2"
    >
      <input
        autoFocus
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError('');
        }}
        placeholder="https://example.com"
        aria-label="Site address"
        className="sitemap-input rounded-md border px-2 py-1 font-mono text-[12px] outline-none"
      />
      <div className="flex gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={url ? deriveNameFromUrl(normalizeUrl(url)) || 'Name' : 'Name (optional)'}
          aria-label="Site name"
          className="sitemap-input min-w-0 flex-1 rounded-md border px-2 py-1 text-[12px] outline-none"
        />
        <Select
          value={group}
          onChange={setGroup}
          ariaLabel="Subcategory"
          size="sm"
          className="w-[46%]"
          options={groups.map((g) => ({ value: g.id, label: g.name, hint: String(g.sites.length) }))}
        />
      </div>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onDone} className="rounded-md px-2 py-1 text-[11px] text-white/55 hover:text-white">
          Cancel
        </button>
        <button type="submit" className="accent-gradient rounded-md px-2.5 py-1 text-[11px] font-semibold text-white">
          Add
        </button>
      </div>
    </form>
  );
}

function MapCard({
  title,
  color,
  count,
  testId,
  categoryId,
  titleNode,
  children,
}: {
  title: string;
  color: string;
  count: number;
  testId?: string;
  categoryId?: string;
  titleNode?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      data-testid={testId}
      data-sitemap-category={categoryId}
      style={catVars(color)}
      className="sitemap-card cat-scope flex flex-col gap-3 rounded-2xl border p-4 [content-visibility:auto] [contain-intrinsic-size:auto_220px]"
    >
      <header className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: 'var(--cat)', boxShadow: '0 0 8px var(--cat)' }} />
        {titleNode ?? (
          <h3 className="truncate font-display text-[12px] font-bold tracking-[0.16em] uppercase" style={{ color: 'var(--cat)' }}>
            {title}
          </h3>
        )}
        <span className="ml-auto rounded-full bg-white/[0.07] px-2 font-mono text-[10px] text-white/55">{count}</span>
      </header>
      {children}
    </section>
  );
}

function Section({
  name,
  count,
  nameNode,
  onDropSite,
  dropId,
  children,
}: {
  name: string;
  count: number;
  nameNode?: ReactNode;
  onDropSite?: (siteId: string, beforeSiteId?: string) => void;
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
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
      className="sitemap-chip flex max-w-full items-center gap-1.5 rounded-lg border py-1 pr-2.5 pl-1.5 text-[12px] font-medium text-white/85 transition-colors hover:text-white"
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
