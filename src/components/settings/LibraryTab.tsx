import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../../store';
import type { Site } from '../../types';
import { Favicon } from '../Favicon';
import { deriveNameFromUrl, normalizeUrl } from '../../utils';
import { Select } from '../ui/Select';

const GENERAL_VALUE = '__general__'; // the Select needs a non-empty value for "no subcategory"

interface LibraryTabProps {
  initialPrefillUrl?: string;
  onClearPrefill?: () => void;
}

export function LibraryTab({
  initialPrefillUrl = '',
  onClearPrefill,
}: LibraryTabProps) {
  const categories = useStore((s) => s.categories);
  const subcategories = useStore((s) => s.subcategories);
  const sites = useStore((s) => s.sites);

  const addCategory = useStore((s) => s.addCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);

  const addSubcategory = useStore((s) => s.addSubcategory);
  const updateSubcategory = useStore((s) => s.updateSubcategory);
  const deleteSubcategory = useStore((s) => s.deleteSubcategory);

  const addSite = useStore((s) => s.addSite);
  const updateSite = useStore((s) => s.updateSite);
  const deleteSite = useStore((s) => s.deleteSite);
  const togglePrimary = useStore((s) => s.togglePrimary);

  // Add site form state
  const [isAddingSite, setIsAddingSite] = useState(Boolean(initialPrefillUrl));
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteUrl, setSiteUrl] = useState(initialPrefillUrl);
  const [siteName, setSiteName] = useState('');
  const [siteCategoryId, setSiteCategoryId] = useState(categories[0]?.id || '');
  const [siteSubcategoryId, setSiteSubcategoryId] = useState<string | null>(null);
  const [sitePrimary, setSitePrimary] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // New category inline state
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#a78bfa');

  // New subcategory state
  const [addingSubcatForCatId, setAddingSubcatForCatId] = useState<string | null>(null);
  const [newSubcatName, setNewSubcatName] = useState('');

  // Delete confirmation
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  // Inline editing IDs
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingSubcatId, setEditingSubcatId] = useState<string | null>(null);
  const [editingSubcatName, setEditingSubcatName] = useState('');

  const handleUrlChange = (val: string) => {
    setSiteUrl(val);
    setUrlError(null);
    if (!siteName || siteName === deriveNameFromUrl(siteUrl)) {
      const derived = deriveNameFromUrl(val);
      if (derived) setSiteName(derived);
    }
  };

  const handleOpenAddSite = () => {
    setEditingSite(null);
    setSiteUrl('');
    setSiteName('');
    setSiteCategoryId(categories[0]?.id || '');
    setSiteSubcategoryId(null);
    setSitePrimary(false);
    setUrlError(null);
    setIsAddingSite(true);
  };

  const handleOpenEditSite = (site: Site) => {
    setEditingSite(site);
    setSiteUrl(site.url);
    setSiteName(site.name);
    setSiteCategoryId(site.categoryId);
    setSiteSubcategoryId(site.subcategoryId);
    setSitePrimary(site.primary);
    setUrlError(null);
    setIsAddingSite(true);
  };

  const handleSaveSite = (e: FormEvent) => {
    e.preventDefault();
    if (!siteUrl.trim() || !siteCategoryId) return;

    const normalized = normalizeUrl(siteUrl);

    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        setUrlError('Please enter a valid URL with domain (e.g. github.com)');
        return;
      }
    } catch {
      setUrlError('Invalid URL format. Please enter a valid web address.');
      return;
    }

    const finalName = siteName.trim() || deriveNameFromUrl(normalized) || 'Untitled';

    if (editingSite) {
      updateSite(editingSite.id, {
        name: finalName,
        url: normalized,
        categoryId: siteCategoryId,
        subcategoryId: siteSubcategoryId,
        primary: sitePrimary,
      });
    } else {
      addSite({
        name: finalName,
        url: normalized,
        categoryId: siteCategoryId,
        subcategoryId: siteSubcategoryId,
        primary: sitePrimary,
      });
    }

    setIsAddingSite(false);
    setEditingSite(null);
    onClearPrefill?.();
  };

  const handleSaveNewCategory = (e: FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory({ name: newCatName.trim(), color: newCatColor });
    setNewCatName('');
    setIsAddingCat(false);
  };

  const handleSaveNewSubcategory = (categoryId: string) => {
    if (!newSubcatName.trim()) return;
    addSubcategory({ name: newSubcatName.trim(), categoryId });
    setNewSubcatName('');
    setAddingSubcatForCatId(null);
  };

  const selectedCategorySubcategories = useMemo(() => {
    return subcategories.filter((s) => s.categoryId === siteCategoryId);
  }, [subcategories, siteCategoryId]);

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-4xl space-y-6 p-6 text-sm text-white/90">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pr-12">
        <div>
          <h3 className="font-display text-base font-semibold text-white">Library</h3>
          <p className="text-xs text-white/50">Manage categories, subcategories, and your curated sites.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddingCat(true)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
          >
            + New Category
          </button>
          <button
            type="button"
            onClick={handleOpenAddSite}
            className="rounded-xl bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg hover:opacity-95 transition-opacity"
          >
            + Add Site
          </button>
        </div>
      </div>

      {/* New Category Inline Form */}
      {isAddingCat && (
        <form onSubmit={handleSaveNewCategory} className="glass-inner flex flex-wrap items-center gap-3 p-4 rounded-xl">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Category Name"
            className="flex-1 min-w-[160px] rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none"
            autoFocus
            required
          />
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="size-5 cursor-pointer rounded border-0 bg-transparent"
            />
            <span className="font-mono text-xs text-white/60">{newCatColor}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsAddingCat(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              Add Category
            </button>
          </div>
        </form>
      )}

      {/* Add / Edit Site Modal Form */}
      {isAddingSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveSite}
            className="glass w-full max-w-md space-y-4 rounded-2xl border-white/20 bg-[#150e24] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="font-display text-sm font-semibold text-white">
                {editingSite ? 'Edit Site' : 'Add New Site'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsAddingSite(false);
                  onClearPrefill?.();
                }}
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* URL Input & Favicon Preview */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-white/70 uppercase">URL</label>
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Favicon url={siteUrl || 'https://example.com'} name={siteName || 'Site'} className="size-5" />
                </div>
                <input
                  type="text"
                  value={siteUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
                  autoFocus
                  required
                />
              </div>
              {urlError && <p className="text-[11px] text-red-400">{urlError}</p>}
            </div>

            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-white/70 uppercase">Display Name</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g. GitHub"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
                required
              />
            </div>

            {/* Category Select */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-white/70 uppercase">Category</label>
                <Select
                  value={siteCategoryId}
                  onChange={(v) => {
                    setSiteCategoryId(v);
                    setSiteSubcategoryId(null);
                  }}
                  ariaLabel="Category"
                  className="w-full"
                  options={categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                    icon: <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} />,
                  }))}
                />
              </div>

              {/* Subcategory Select */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-white/70 uppercase">Subcategory</label>
                <Select
                  value={siteSubcategoryId || GENERAL_VALUE}
                  onChange={(v) => setSiteSubcategoryId(v === GENERAL_VALUE ? null : v)}
                  ariaLabel="Subcategory"
                  className="w-full"
                  options={[
                    { value: GENERAL_VALUE, label: 'General (None)' },
                    ...selectedCategorySubcategories.map((sc) => ({ value: sc.id, label: sc.name })),
                  ]}
                />
              </div>
            </div>

            {/* Primary Toggle */}
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
              <div>
                <p className="text-xs font-semibold text-white">Primary Site</p>
                <p className="text-[10px] text-white/40">Pinned to category's horizontal tile row</p>
              </div>
              <input
                type="checkbox"
                checked={sitePrimary}
                onChange={(e) => setSitePrimary(e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
            </label>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsAddingSite(false);
                  onClearPrefill?.();
                }}
                className="rounded-lg px-3.5 py-1.5 text-xs text-white/50 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-white shadow-lg hover:opacity-95"
              >
                {editingSite ? 'Save Changes' : 'Add to DevDeck'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Category Confirm Modal */}
      {deletingCatId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass w-full max-w-sm space-y-4 rounded-2xl border-red-500/20 bg-[#150e24] p-5 shadow-2xl">
            <h4 className="font-semibold text-sm text-red-400">Delete Category?</h4>
            <p className="text-xs text-white/70">
              This will permanently delete this category, along with all of its subcategories and sites.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingCatId(null)}
                className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCategory(deletingCatId);
                  setDeletingCatId(null);
                }}
                className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Tree */}
      <div className="space-y-6">
        {sortedCategories.map((category) => {
          const catSubcategories = subcategories
            .filter((sc) => sc.categoryId === category.id)
            .sort((a, b) => a.order - b.order);

          const catSites = sites.filter((s) => s.categoryId === category.id);
          const generalSites = catSites
            .filter((s) => s.subcategoryId === null)
            .sort((a, b) => a.order - b.order);

          return (
            <div key={category.id} className="glass-inner space-y-3 p-4 rounded-2xl border-white/10">
              {/* Category Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={category.color}
                    onChange={(e) => updateCategory(category.id, { color: e.target.value })}
                    className="size-4 cursor-pointer rounded border-0 bg-transparent"
                    title="Change category color"
                  />
                  {editingCatId === category.id ? (
                    <input
                      type="text"
                      value={editingCatName}
                      onChange={(e) => setEditingCatName(e.target.value)}
                      onBlur={() => {
                        if (editingCatName.trim()) {
                          updateCategory(category.id, { name: editingCatName.trim() });
                        }
                        setEditingCatId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editingCatName.trim()) {
                            updateCategory(category.id, { name: editingCatName.trim() });
                          }
                          setEditingCatId(null);
                        }
                      }}
                      className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-bold text-white focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingCatId(category.id);
                        setEditingCatName(category.name);
                      }}
                      className="font-display text-sm font-bold uppercase tracking-wider text-white hover:text-white/80 cursor-pointer"
                      title="Click to rename"
                    >
                      {category.name}
                    </span>
                  )}
                  <span className="text-[10px] text-white/30 tabular-nums">({catSites.length} sites)</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingSubcatForCatId(category.id);
                      setNewSubcatName('');
                    }}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    + Subcategory
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingCatId(category.id)}
                    className="rounded-lg p-1.5 text-red-400/60 hover:bg-red-500/15 hover:text-red-400"
                    title="Delete category"
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

              {/* Inline Add Subcategory input */}
              {addingSubcatForCatId === category.id && (
                <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl">
                  <input
                    type="text"
                    value={newSubcatName}
                    onChange={(e) => setNewSubcatName(e.target.value)}
                    placeholder="Subcategory Name"
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white placeholder-white/30 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveNewSubcategory(category.id)}
                    className="rounded-lg bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/20"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingSubcatForCatId(null)}
                    className="rounded-lg px-2 text-xs text-white/40 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* General Group sites */}
              {generalSites.length > 0 && (
                <div className="space-y-1 pl-3 border-l-2 border-white/10">
                  <span className="text-[10px] font-semibold text-white/40 uppercase">General</span>
                  <div className="space-y-1">
                    {generalSites.map((site) => (
                      <SiteLibraryRow
                        key={site.id}
                        site={site}
                        categoryColor={category.color}
                        onEdit={handleOpenEditSite}
                        onDelete={deleteSite}
                        onTogglePrimary={togglePrimary}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Subcategories & their sites */}
              {catSubcategories.map((subcat) => {
                const subSites = catSites
                  .filter((s) => s.subcategoryId === subcat.id)
                  .sort((a, b) => a.order - b.order);

                return (
                  <div key={subcat.id} className="space-y-1.5 pl-3 border-l-2 border-white/10">
                    <div className="flex items-center justify-between">
                      {editingSubcatId === subcat.id ? (
                        <input
                          type="text"
                          value={editingSubcatName}
                          onChange={(e) => setEditingSubcatName(e.target.value)}
                          onBlur={() => {
                            if (editingSubcatName.trim()) {
                              updateSubcategory(subcat.id, { name: editingSubcatName.trim() });
                            }
                            setEditingSubcatId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editingSubcatName.trim()) {
                                updateSubcategory(subcat.id, { name: editingSubcatName.trim() });
                              }
                              setEditingSubcatId(null);
                            }
                          }}
                          className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span
                          onClick={() => {
                            setEditingSubcatId(subcat.id);
                            setEditingSubcatName(subcat.name);
                          }}
                          className="text-xs font-semibold text-white/80 hover:text-white cursor-pointer"
                          title="Click to rename"
                        >
                          {subcat.name}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteSubcategory(subcat.id)}
                        className="text-[10px] text-white/40 hover:text-red-400"
                        title="Delete subcategory (sites move to General)"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="space-y-1">
                      {subSites.length === 0 ? (
                        <p className="text-[10px] text-white/25 italic">No sites in this subcategory</p>
                      ) : (
                        subSites.map((site) => (
                          <SiteLibraryRow
                            key={site.id}
                            site={site}
                            categoryColor={category.color}
                            onEdit={handleOpenEditSite}
                            onDelete={deleteSite}
                            onTogglePrimary={togglePrimary}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SiteLibraryRow({
  site,
  categoryColor,
  onEdit,
  onDelete,
  onTogglePrimary,
}: {
  site: Site;
  categoryColor: string;
  onEdit: (site: Site) => void;
  onDelete: (id: string) => void;
  onTogglePrimary: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.06] transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <Favicon url={site.url} name={site.name} categoryColor={categoryColor} className="size-4" />
        <span className="truncate text-xs font-medium text-white/90">{site.name}</span>
        <span className="truncate text-[10px] text-white/30">{site.url.replace(/^https?:\/\//, '')}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onTogglePrimary(site.id)}
          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold transition-colors ${
            site.primary
              ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
              : 'text-white/30 hover:text-white/60'
          }`}
          title="Toggle Primary site tile"
        >
          {site.primary ? 'Primary' : 'Normal'}
        </button>
        <button
          type="button"
          onClick={() => onEdit(site)}
          className="text-white/40 hover:text-white text-xs p-1"
          title="Edit site"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={() => onDelete(site.id)}
          className="text-white/40 hover:text-red-400 text-xs p-1"
          title="Delete site"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
