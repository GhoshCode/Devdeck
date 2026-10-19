import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  countSites,
  createFolder,
  deleteNode,
  filterTree,
  isFolder,
  isRootContainer,
  renameNode,
  restoreNode,
  type BmNode,
} from '../../services/bookmarks';
import { normalizeUrl } from '../../utils';
import { Favicon } from '../Favicon';
import { showUndo } from '../ui/UndoToast';
import { useBookmarks } from './useBookmarks';

const BookmarkTreeView = lazy(() => import('./BookmarkTreeView'));

// The bookmark button (beside Site Map) opens the BROWSER's bookmarks — not
// DevDeck's own categories, which live in the Site Map and Settings → Library.
// The list is live and two-way: edits here change the browser's bookmarks and
// edits in the browser show up here. Folders nest to any depth; only expanded
// folders render their children, so big collections stay light.

export const BookmarkButton = memo(function BookmarkButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Browser bookmarks"
        title="Browser bookmarks"
        aria-expanded={open}
        className="glass-raised flex h-[52px] min-w-[56px] shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3.5 text-xs font-semibold tracking-wide text-white/80 transition-colors hover:bg-white/10 hover:text-white max-sm:flex-1"
      >
        <svg className="size-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M5 2.5A1.5 1.5 0 003.5 4v13.2a.5.5 0 00.8.4L10 13.5l5.7 4.1a.5.5 0 00.8-.4V4A1.5 1.5 0 0015 2.5H5z" />
        </svg>
      </button>
      <AnimatePresence>{open && <BookmarkDrawer onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
});

function BookmarkDrawer({ onClose }: { onClose: () => void }) {
  const { available, roots, error } = useBookmarks();
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [adding, setAdding] = useState(false);
  const [tree, setTree] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  // Open the browser's top-level containers (Bookmarks bar, Other…) at first.
  useEffect(() => {
    if (roots && expanded.size === 0) setExpanded(new Set(roots.map((r) => r.id)));
  }, [roots, expanded.size]);

  useEffect(() => {
    filterRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !tree && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, tree]);

  const shown = useMemo(() => filterTree(roots ?? [], filter), [roots, filter]);
  const visibleRoots = shown.filter((r) => (r.children?.length ?? 0) > 0 || !filter);
  const total = useMemo(() => (roots ?? []).reduce((n, r) => n + countSites(r), 0), [roots]);
  const filtering = !!filter.trim();

  const run = (p: Promise<unknown>) => p.then(() => setFailure(null)).catch((e: unknown) => setFailure(e instanceof Error ? e.message : String(e)));
  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const reveal = (id: string) => setExpanded((s) => new Set(s).add(id));

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
        aria-label="Browser bookmarks"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="bm-panel fixed top-0 right-0 bottom-0 z-50 flex w-[min(460px,94vw)] flex-col border-l border-white/10 bg-[var(--color-base-elevated)]/95 backdrop-blur-2xl"
      >
        <header className="flex items-center gap-3 border-b border-white/[0.07] px-5 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-sm font-semibold tracking-[0.18em] text-white">BOOKMARKS</h2>
            <p className="mt-0.5 font-mono text-[11px] text-white/40">
              {available ? `From your browser · ${total} sites · live` : 'Browser bookmarks'}
            </p>
          </div>
          {available && (
            <button
              type="button"
              onClick={() => setTree(true)}
              className="bm-tree-btn flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold"
              title="See every folder and site as a tree; drag to reorganise"
            >
              <TreeIcon />
              Tree View
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bookmarks"
            className="flex size-8 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </header>

        {!available ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
            <p className="text-sm font-semibold text-white/85">Browser bookmarks need the DevDeck extension</p>
            <p className="text-xs leading-relaxed text-white/50">
              This page isn't running as the installed extension, so it can't read your browser's bookmarks. Open a new tab with the
              DevDeck extension installed to see, edit and organise them here.
            </p>
          </div>
        ) : (
          <>
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
                + Add folder
              </button>
            </div>
            {adding && roots && (
              <AddTopFolder
                roots={roots}
                onCancel={() => setAdding(false)}
                onAdd={(parentId, name) => {
                  setAdding(false);
                  reveal(parentId);
                  void run(createFolder(parentId, name));
                }}
              />
            )}
            {(failure || error) && <p className="mx-5 mb-2 rounded-lg bg-red-500/15 px-3 py-1.5 text-[11px] text-red-200">{failure ?? error}</p>}
            <nav aria-label="Bookmarks" className="ultra-thin-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-6">
              {roots === null ? (
                <p className="px-3 py-6 text-xs text-white/40">Loading bookmarks…</p>
              ) : visibleRoots.length === 0 ? (
                <p className="px-3 py-6 text-xs text-white/40">{filtering ? `No bookmarks match “${filter}”.` : 'No bookmarks yet.'}</p>
              ) : (
                <ul role="tree">
                  {visibleRoots.map((n) => (
                    <BmRow key={n.id} node={n} depth={0} expanded={expanded} forceOpen={filtering} toggle={toggle} reveal={reveal} run={run} />
                  ))}
                </ul>
              )}
            </nav>
          </>
        )}
      </motion.aside>
      <AnimatePresence>
        {tree && roots && (
          <Suspense fallback={null}>
            <BookmarkTreeView roots={roots} onClose={() => setTree(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </>
  );
}

// "+ Add folder": a first-level folder, in the Bookmarks bar by default.
function AddTopFolder({ roots, onAdd, onCancel }: { roots: BmNode[]; onAdd: (parentId: string, name: string) => void; onCancel: () => void }) {
  const [parent, setParent] = useState(roots[0]?.id ?? '1');
  return (
    <div className="mx-5 mb-2 flex flex-col gap-2">
      {roots.length > 1 && (
        <div role="radiogroup" aria-label="Add the folder to" className="flex flex-wrap gap-1.5">
          {roots.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={parent === r.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setParent(r.id)}
              className={`bm-chip rounded-lg border px-2 py-0.5 text-[11px] ${parent === r.id ? 'is-on' : ''}`}
            >
              {r.title}
            </button>
          ))}
        </div>
      )}
      <InlineName placeholder="New folder name" onCancel={onCancel} onSubmit={(name) => onAdd(parent, name)} />
    </div>
  );
}

type Run = (p: Promise<unknown>) => Promise<unknown>;

const BmRow = memo(function BmRow({
  node,
  depth,
  expanded,
  forceOpen,
  toggle,
  reveal,
  run,
}: {
  node: BmNode;
  depth: number;
  expanded: Set<string>;
  forceOpen: boolean;
  toggle: (id: string) => void;
  reveal: (id: string) => void;
  run: Run;
}) {
  const [mode, setMode] = useState<'idle' | 'edit' | 'add' | 'confirm'>('idle');
  const folder = isFolder(node);
  const root = isRootContainer(node);
  const locked = !!node.unmodifiable;
  const pad = { paddingLeft: 8 + depth * 14 };

  const remove = () => {
    setMode('idle');
    void run(
      deleteNode(node).then((snap) =>
        showUndo(`Deleted ${node.title || (folder ? 'folder' : 'bookmark')}`, () => void run(restoreNode(snap))),
      ),
    );
  };

  if (!folder) {
    return (
      <li role="treeitem" aria-selected={false} className="group/bm">
        {mode === 'edit' ? (
          <div style={pad} className="py-1 pr-2">
            <SiteEdit node={node} onDone={() => setMode('idle')} run={run} />
          </div>
        ) : (
          <div style={pad} className="bm-row flex items-center gap-2 rounded-lg py-1 pr-1">
            <a href={node.url} title={node.url} className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] text-white/80 hover:text-white">
              <Favicon url={node.url!} name={node.title || node.url!} className="size-4 shrink-0" />
              <span className="truncate">{node.title || node.url}</span>
            </a>
            {!locked && (
              <span className="bm-actions flex shrink-0 items-center gap-0.5">
                <IconBtn label={`Edit ${node.title}`} onClick={() => setMode('edit')}>
                  <PenIcon />
                </IconBtn>
                <IconBtn label={`Delete ${node.title}`} danger onClick={remove}>
                  <TrashIcon />
                </IconBtn>
              </span>
            )}
          </div>
        )}
      </li>
    );
  }

  const open = forceOpen || expanded.has(node.id);
  const kids = node.children ?? [];
  const count = countSites(node);
  return (
    <li role="treeitem" aria-expanded={open} aria-selected={false} className="group/bm">
      {mode === 'edit' ? (
        <div style={pad} className="py-1 pr-2">
          <InlineName
            initial={node.title}
            placeholder="Folder name"
            onCancel={() => setMode('idle')}
            onSubmit={(name) => {
              setMode('idle');
              void run(renameNode(node.id, name));
            }}
          />
        </div>
      ) : (
        <div style={pad} className="bm-row flex items-center gap-1.5 rounded-lg py-1 pr-1">
          <button type="button" onClick={() => toggle(node.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-label={`${open ? 'Collapse' : 'Expand'} ${node.title}`}>
            <span className={`bm-chevron text-white/40 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>
              <ChevronIcon />
            </span>
            <FolderIcon open={open} root={root} />
            <span className={`truncate text-[12.5px] ${root ? 'font-semibold tracking-wide text-white/90' : 'font-medium text-white/85'}`}>{node.title}</span>
            <span className="shrink-0 font-mono text-[10px] text-white/35">{count}</span>
          </button>
          {!locked && (
            <span className="bm-actions flex shrink-0 items-center gap-0.5">
              <IconBtn
                label={`Add sub folder to ${node.title}`}
                tip="Add sub folder"
                onClick={() => {
                  reveal(node.id);
                  setMode('add');
                }}
              >
                <PlusIcon />
              </IconBtn>
              {!root && (
                <>
                  <IconBtn label={`Edit ${node.title}`} onClick={() => setMode('edit')}>
                    <PenIcon />
                  </IconBtn>
                  <IconBtn label={`Delete ${node.title}`} danger onClick={() => (count > 0 || kids.length > 0 ? setMode('confirm') : remove())}>
                    <TrashIcon />
                  </IconBtn>
                </>
              )}
            </span>
          )}
        </div>
      )}
      {mode === 'confirm' && (
        <div role="alertdialog" aria-label={`Delete ${node.title}?`} style={{ marginLeft: 8 + depth * 14 }} className="bm-confirm my-1 mr-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-[11.5px]">
          <span className="flex-1 text-white/85">
            Delete “{node.title}” and its {count} bookmark{count === 1 ? '' : 's'} from the browser?
          </span>
          <button type="button" onClick={() => setMode('idle')} className="rounded-md px-2 py-0.5 text-white/60 hover:bg-white/10">
            Cancel
          </button>
          <button type="button" onClick={remove} className="rounded-md bg-red-500/80 px-2 py-0.5 font-semibold text-white hover:bg-red-500">
            Delete
          </button>
        </div>
      )}
      {open && (
        <ul role="group">
          {mode === 'add' && (
            <li style={{ paddingLeft: 8 + (depth + 1) * 14 }} className="py-1 pr-2">
              <InlineName
                placeholder="Sub folder name"
                onCancel={() => setMode('idle')}
                onSubmit={(name) => {
                  setMode('idle');
                  void run(createFolder(node.id, name));
                }}
              />
            </li>
          )}
          {kids.map((c) => (
            <BmRow key={c.id} node={c} depth={depth + 1} expanded={expanded} forceOpen={forceOpen} toggle={toggle} reveal={reveal} run={run} />
          ))}
          {kids.length === 0 && mode !== 'add' && (
            <li style={{ paddingLeft: 30 + depth * 14 }} className="py-1 text-[11px] text-white/30">
              Empty folder
            </li>
          )}
        </ul>
      )}
    </li>
  );
});

function SiteEdit({ node, onDone, run }: { node: BmNode; onDone: () => void; run: Run }) {
  const [title, setTitle] = useState(node.title);
  const [url, setUrl] = useState(node.url ?? '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onDone();
        void run(renameNode(node.id, title.trim() || node.title, normalizeUrl(url.trim() || node.url!)));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onDone();
        }
      }}
      className="flex flex-col gap-1.5"
    >
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Bookmark name" className="bm-input rounded-lg border px-2.5 py-1 text-[12px] outline-none" />
      <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Bookmark URL" className="bm-input rounded-lg border px-2.5 py-1 font-mono text-[11px] outline-none" />
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onDone} className="rounded-md px-2 py-0.5 text-[11px] text-white/55 hover:bg-white/10">
          Cancel
        </button>
        <button type="submit" className="rounded-md bg-[var(--color-accent)] px-2.5 py-0.5 text-[11px] font-semibold text-white">
          Save
        </button>
      </div>
    </form>
  );
}

function InlineName({ initial = '', placeholder, onSubmit, onCancel }: { initial?: string; placeholder: string; onSubmit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSubmit(v.trim());
        else onCancel();
      }}
      className="flex gap-1.5"
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={onCancel}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="bm-input min-w-0 flex-1 rounded-lg border px-2.5 py-1 text-[12px] outline-none"
      />
      <button type="submit" onMouseDown={(e) => e.preventDefault()} className="rounded-lg bg-[var(--color-accent)] px-2.5 text-[11px] font-semibold text-white">
        Save
      </button>
    </form>
  );
}

function IconBtn({ label, tip, danger, onClick, children }: { label: string; tip?: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={tip ?? label}
      className={`bm-icon flex size-6 items-center justify-center rounded-md ${danger ? 'is-danger' : ''}`}
    >
      {children}
    </button>
  );
}

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
const ChevronIcon = () => (
  <svg {...svg} className="size-3.5">
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const PlusIcon = () => (
  <svg {...svg} className="size-3.5">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const PenIcon = () => (
  <svg {...svg} className="size-3.5">
    <path d="M12 20h9M16.4 3.6a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const TrashIcon = () => (
  <svg {...svg} className="size-3.5">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);
export const TreeIcon = () => (
  <svg {...svg} className="size-3.5">
    <rect x="9" y="3" width="6" height="5" rx="1" />
    <rect x="3" y="16" width="6" height="5" rx="1" />
    <rect x="15" y="16" width="6" height="5" rx="1" />
    <path d="M12 8v4M6 16v-4h12v4" />
  </svg>
);
export function FolderIcon({ open, root }: { open?: boolean; root?: boolean }) {
  return (
    <svg {...svg} className={`size-4 shrink-0 ${root ? 'text-[var(--color-accent)]' : 'text-amber-300/85'}`}>
      {open ? (
        <path d="M3 8V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1M3 8l1.5 10a2 2 0 0 0 2 1.7h11a2 2 0 0 0 2-1.7L21 10H5" />
      ) : (
        <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      )}
    </svg>
  );
}
