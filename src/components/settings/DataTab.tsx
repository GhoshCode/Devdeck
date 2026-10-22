import { useState, type ChangeEvent } from 'react';
import { useStore } from '../../store';
import type { ImportSummary } from '../../types';
import { DataCleanup } from './DataCleanup';

export function DataTab() {
  const exportState = useStore((s) => s.exportState);
  const importState = useStore((s) => s.importState);
  const resetToSeed = useStore((s) => s.resetToSeed);

  const categories = useStore((s) => s.categories);
  const subcategories = useStore((s) => s.subcategories);
  const sites = useStore((s) => s.sites);

  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleExport = () => {
    const json = exportState();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devdeck-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = importState(text);
        if (result.ok) {
          setImportSummary(result.summary);
          setImportSuccess(true);
        } else {
          setImportError(result.error);
        }
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : 'Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    resetToSeed();
    setShowResetConfirm(false);
  };

  return (
    <div className="space-y-5 text-sm text-white/90">

      {/* Live State Summary Pills */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-inner flex flex-col p-3 rounded-xl border border-white/10">
          <span className="set-card-hint text-[11.5px]">Categories</span>
          <span className="text-lg font-bold text-white tabular-nums">{categories.length}</span>
        </div>
        <div className="glass-inner flex flex-col p-3 rounded-xl border border-white/10">
          <span className="set-card-hint text-[11.5px]">Subcategories</span>
          <span className="text-lg font-bold text-white tabular-nums">{subcategories.length}</span>
        </div>
        <div className="glass-inner flex flex-col p-3 rounded-xl border border-white/10">
          <span className="set-card-hint text-[11.5px]">Sites</span>
          <span className="text-lg font-bold text-white tabular-nums">{sites.length}</span>
        </div>
      </div>

      {/* 2. Export Section */}
      <section className="set-card space-y-4 rounded-2xl border p-5">
        <div>
          <h4 className="set-card-title text-[13.5px] font-semibold">Back up</h4>
          <p className="set-card-hint mt-0.5 text-[12px]">Save everything — sites, lists, to-dos, settings — to a file you can restore later or on another computer. Your GitHub token is never included.</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors border border-white/10"
        >
          <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Download backup
        </button>
      </section>

      {/* 3. Import Section */}
      <section className="set-card space-y-4 rounded-2xl border p-5">
        <div>
          <h4 className="set-card-title text-[13.5px] font-semibold">Restore</h4>
          <p className="set-card-hint mt-0.5 text-[12px]">Load a backup file. It replaces what is here now.</p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors border border-white/10">
          <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Choose a backup file…
          <input type="file" accept="application/json" onChange={handleFileImport} className="hidden" />
        </label>

        {importError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {importError}
          </div>
        )}

        {importSuccess && importSummary && (
          <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <p className="font-semibold">Successfully imported backup!</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-white/80">
              <div>Categories: <strong className="text-white">{importSummary.categories}</strong></div>
              <div>Subcategories: <strong className="text-white">{importSummary.subcategories}</strong></div>
              <div>Sites: <strong className="text-white">{importSummary.sites}</strong></div>
              <div>Quick Links: <strong className="text-white">{importSummary.quickLinks}</strong></div>
            </div>
          </div>
        )}
      </section>

      {/* 4. Danger Zone: Factory Seed */}
      <DataCleanup />

      <section className="set-card is-danger space-y-4 rounded-2xl border p-5">
        <div>
          <h4 className="text-[13.5px] font-semibold text-red-400">Start over</h4>
          <p className="set-card-hint mt-0.5 text-[12px]">Reset DevDeck to its starting categories and sites. Back up first if you might want anything back.</p>
        </div>

        {showResetConfirm ? (
          <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-950/30 p-4">
            <p className="text-xs font-medium text-red-300">
              Are you sure? This will revert DevDeck to initial defaults.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Yes, Reset Everything
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs text-white/80 hover:bg-white/15"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Reset to Factory Seed
          </button>
        )}
      </section>
    </div>
  );
}
