import { useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { useStore } from '../../store';
import type { Site } from '../../types';
import { deriveNameFromUrl, normalizeUrl } from '../../utils';
import { Favicon } from '../Favicon';
import { Select } from '../ui/Select';

// The one "Add / Edit site" window, shared by Settings → Library and the
// Site Map. When adding, a recycle bin under the form lists deleted sites so
// an accidental delete can be put back (into the category picked above).

const GENERAL = '__general__';

export function SiteFormDialog({
  editing = null,
  prefillUrl = '',
  categoryId,
  subcategoryId = null,
  primary = false,
  onClose,
}: {
  editing?: Site | null;
  prefillUrl?: string;
  categoryId?: string;
  subcategoryId?: string | null;
  primary?: boolean;
  onClose: () => void;
}) {
  const categories = useStore((s) => s.categories);
  const subcategories = useStore((s) => s.subcategories);
  const addSite = useStore((s) => s.addSite);
  const updateSite = useStore((s) => s.updateSite);
  const sorted = useMemo(() => [...categories].sort((a, b) => a.order - b.order), [categories]);

  const [url, setUrl] = useState(editing?.url ?? prefillUrl);
  const [name, setName] = useState(editing?.name ?? (prefillUrl ? deriveNameFromUrl(normalizeUrl(prefillUrl)) : ''));
  const [cat, setCat] = useState(editing?.categoryId ?? categoryId ?? sorted[0]?.id ?? '');
  const [sub, setSub] = useState<string | null>(editing?.subcategoryId ?? subcategoryId);
  const [isPrimary, setPrimary] = useState(editing?.primary ?? primary);
  const [error, setError] = useState<string | null>(null);
  const subs = subcategories.filter((s) => s.categoryId === cat).sort((a, b) => a.order - b.order);

  const onUrl = (v: string) => {
    setError(null);
    if (!name || name === deriveNameFromUrl(normalizeUrl(url))) setName(deriveNameFromUrl(normalizeUrl(v)));
    setUrl(v);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !cat) return;
    const normalized = normalizeUrl(url);
    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname.includes('.')) return setError('Please enter a valid URL with domain (e.g. github.com)');
    } catch {
      return setError('Invalid URL format. Please enter a valid web address.');
    }
    const finalName = name.trim() || deriveNameFromUrl(normalized) || 'Untitled';
    if (editing) updateSite(editing.id, { name: finalName, url: normalized, categoryId: cat, subcategoryId: sub, primary: isPrimary });
    else addSite({ name: finalName, url: normalized, categoryId: cat, subcategoryId: sub, primary: isPrimary });
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <motion.div
        role="dialog"
        aria-label={editing ? 'Edit site' : 'Add new site'}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="site-form ultra-thin-scrollbar max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border p-6 shadow-2xl"
      >
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h4 className="font-display text-sm font-semibold text-white">{editing ? 'Edit Site' : 'Add New Site'}</h4>
            <button type="button" onClick={onClose} aria-label="Close" className="text-white/40 hover:text-white">
              ✕
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-white/70 uppercase">URL</label>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <Favicon url={url || 'https://example.com'} name={name || 'Site'} className="size-5" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => onUrl(e.target.value)}
                placeholder="https://example.com"
                aria-label="Site URL"
                className="site-form-input flex-1 rounded-xl border px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none"
                autoFocus
                required
              />
            </div>
            {error && <p className="text-[11px] text-red-400">{error}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-white/70 uppercase">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GitHub"
              aria-label="Display name"
              className="site-form-input w-full rounded-xl border px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-white/70 uppercase">Category</label>
              <Select
                value={cat}
                onChange={(v) => {
                  setCat(v);
                  setSub(null);
                }}
                ariaLabel="Category"
                className="w-full"
                options={sorted.map((c) => ({ value: c.id, label: c.name, icon: <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} /> }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-white/70 uppercase">Subcategory</label>
              <Select
                value={sub ?? GENERAL}
                onChange={(v) => setSub(v === GENERAL ? null : v)}
                ariaLabel="Subcategory"
                className="w-full"
                options={[{ value: GENERAL, label: 'General (None)' }, ...subs.map((s) => ({ value: s.id, label: s.name }))]}
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
            <div>
              <p className="text-xs font-semibold text-white">Primary Site</p>
              <p className="text-[10px] text-white/40">Pinned to the category's top row</p>
            </div>
            <input type="checkbox" checked={isPrimary} onChange={(e) => setPrimary(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          </label>
          <div className="flex justify-end gap-2 border-t border-white/10 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-1.5 text-xs text-white/50 hover:bg-white/5">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-white shadow-lg hover:opacity-95">
              {editing ? 'Save Changes' : 'Add to DevDeck'}
            </button>
          </div>
        </form>
        {!editing && <RecycleBin categoryId={cat} subcategoryId={sub} />}
      </motion.div>
    </div>,
    document.body,
  );
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

// Deleted sites, newest first; Restore puts one back into the section chosen
// in the form above.
function RecycleBin({ categoryId, subcategoryId }: { categoryId: string; subcategoryId: string | null }) {
  const trashed = useStore((s) => s.trash.sites);
  const restoreSite = useStore((s) => s.restoreSite);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const shown = trashed.filter((t) => !q.trim() || `${t.name} ${t.url}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <section aria-label="Deleted sites" className="mt-4 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-[11px] text-white/55 hover:text-white/85"
      >
        <BinGlyph className="size-4" />
        <span className="font-semibold">Deleted / archived sites</span>
        <span className="rounded-full bg-white/10 px-1.5 font-mono text-[10px]">{trashed.length}</span>
        <span className="ml-auto text-[10px]">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {trashed.length === 0 ? (
            <p className="text-[11px] text-white/40">Nothing deleted yet.</p>
          ) : (
            <>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search deleted sites…"
                aria-label="Search deleted sites"
                className="site-form-input w-full rounded-lg border px-2.5 py-1.5 text-[11px] text-white placeholder-white/30 focus:outline-none"
              />
              <ul className="ultra-thin-scrollbar max-h-[190px] space-y-1 overflow-y-auto">
                {shown.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.05]">
                    <Favicon url={t.url} name={t.name} className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-white/85">{t.name}</span>
                      <span className="block truncate text-[10px] text-white/40">
                        {t.fromCategory}
                        {t.fromSubcategory ? ` › ${t.fromSubcategory}` : ''} · {ago(t.deletedAt)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => restoreSite(t.id, categoryId, subcategoryId)}
                      aria-label={`Restore ${t.name}`}
                      className="undo-btn shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function BinGlyph({ className = 'size-4', open = false }: { className?: string; open?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* the lid swings open around its left hinge */}
      <g className="bin-lid" style={{ transformOrigin: '4px 5px', transform: open ? 'rotate(-28deg) translateY(-1px)' : undefined }}>
        <path d="M3.5 5.5h13" />
        <path d="M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
      </g>
      <path d="M5 7.5l.8 9a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l.8-9" />
      <path d="M8.5 10.5l.3 4M11.5 10.5l-.3 4" />
    </svg>
  );
}
