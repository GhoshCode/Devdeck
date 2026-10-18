import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import { isDemo } from '../../lib/demoData';

// Settings → Data: clear the app's caches, permanently clear chosen kinds of
// old data, and load / remove demo data for manual testing.

// Everything DevDeck caches outside its main data: weather, feeds, GitHub,
// favicons… (localStorage "devdeck:cache:*", session storage, Cache Storage).
async function clearAppCaches(): Promise<number> {
  let n = 0;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('devdeck:cache:')) {
        localStorage.removeItem(key);
        n++;
      }
    }
  } catch {
    // storage unavailable
  }
  try {
    n += sessionStorage.length;
    sessionStorage.clear();
  } catch {
    // ignore
  }
  try {
    if ('caches' in globalThis) {
      const names = await caches.keys();
      await Promise.all(names.map((k) => caches.delete(k)));
      n += names.length;
    }
  } catch {
    // ignore
  }
  return n;
}

export function DataCleanup() {
  const trash = useStore((s) => s.trash);
  const todos = useStore((s) => s.todos);
  const processing = useStore((s) => s.processing);
  const feeds = useStore((s) => s.feeds);
  const clearData = useStore((s) => s.clearData);
  const loadDemoData = useStore((s) => s.loadDemoData);
  const clearDemoData = useStore((s) => s.clearDemoData);

  const [cacheMsg, setCacheMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const demoCount =
    processing.filter((p) => isDemo(p.id)).length +
    todos.filter((t) => isDemo(t.id)).length +
    feeds.topics.filter((t) => isDemo(t.id)).length +
    feeds.sources.filter((s) => isDemo(s.id)).length;
  const rows = [
    { key: 'deletedSites' as const, label: 'Deleted sites', hint: 'in the recycle bin', count: trash.sites.length },
    { key: 'removedProcessing' as const, label: 'Removed Focus / Queue sites', hint: 'kept after removal', count: trash.processing.length },
    { key: 'completedTodos' as const, label: 'Completed to-do tasks', hint: 'the archive', count: todos.filter((t) => t.archivedAt !== null).length },
    { key: 'demo' as const, label: 'Demo data', hint: 'sites, tasks, topics, sources', count: demoCount },
  ];
  const [pick, setPick] = useState<Record<string, boolean>>({ deletedSites: true, removedProcessing: true, completedTodos: true, demo: false });
  const chosen = rows.filter((r) => pick[r.key] && r.count > 0);
  const total = chosen.reduce((n, r) => n + r.count, 0);

  return (
    <>
      <section aria-label="Clear cache" className="glass-inner space-y-3 rounded-2xl border border-white/10 p-5">
        <div>
          <h4 className="font-semibold text-white">Clear cache</h4>
          <p className="text-xs text-white/55">
            Drops cached weather, news, jobs, GitHub activity and icons so everything loads fresh. Your sites, tasks and settings stay.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => setCacheMsg(`Cleared ${await clearAppCaches()} cached entries — fresh data loads next time.`)}
            className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
          >
            Clear cache
          </button>
          {cacheMsg && (
            <span role="status" className="text-[11px] text-emerald-300">
              {cacheMsg}
            </span>
          )}
        </div>
      </section>

      <section aria-label="Clear data" className="glass-inner space-y-3 rounded-2xl border border-white/10 p-5">
        <div>
          <h4 className="font-semibold text-white">Clear data</h4>
          <p className="text-xs text-white/55">Permanently remove old data you no longer need. Choose what goes.</p>
        </div>
        {!open ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setDone(null);
              }}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/20"
            >
              Clear data…
            </button>
            {done && (
              <span role="status" className="text-[11px] text-emerald-300">
                {done}
              </span>
            )}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="clear-data-panel space-y-2 rounded-xl border p-3">
            <ul className="space-y-1.5">
              {rows.map((r) => (
                <li key={r.key}>
                  <label className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${r.count ? 'cursor-pointer hover:bg-white/[0.05]' : 'opacity-45'}`}>
                    <input
                      type="checkbox"
                      checked={!!pick[r.key] && r.count > 0}
                      disabled={!r.count}
                      onChange={(e) => setPick((p) => ({ ...p, [r.key]: e.target.checked }))}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-white/90">{r.label}</span>
                      <span className="block text-[10.5px] text-white/45">{r.hint}</span>
                    </span>
                    <span className="rounded-full bg-white/10 px-2 font-mono text-[11px] text-white/70">{r.count}</span>
                  </label>
                </li>
              ))}
            </ul>
            <AnimatePresence initial={false}>
              {confirm && (
                <motion.div
                  role="alertdialog"
                  aria-label="Confirm permanent deletion"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
                    ⚠ This can't be undone. Permanently delete {total} item{total === 1 ? '' : 's'}? Continue with permanent deletion?
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirm(false);
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-white/60 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!total}
                onClick={() => {
                  if (!confirm) return setConfirm(true);
                  clearData(Object.fromEntries(chosen.map((r) => [r.key, true])));
                  setDone(`Permanently deleted ${total} item${total === 1 ? '' : 's'}.`);
                  setConfirm(false);
                  setOpen(false);
                }}
                className="rounded-lg bg-red-500/85 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
              >
                {confirm ? 'Yes, delete permanently' : `Permanently delete${total ? ` (${total})` : ''}`}
              </button>
            </div>
          </motion.div>
        )}
      </section>

      <section aria-label="Demo data" className="glass-inner space-y-3 rounded-2xl border border-white/10 p-5">
        <div>
          <h4 className="font-semibold text-white">Demo data (for testing)</h4>
          <p className="text-xs text-white/55">
            Adds 52 Focus + 52 Queue sites (every reminder type, timers in every state), 156 to-dos (overdue, today, upcoming, repeating,
            completed), 30 topics and 210 news / job sources. Your own data is untouched; remove it all again with one click.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={loadDemoData} className="accent-gradient rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white">
            {demoCount ? 'Reload demo data' : 'Load demo data'}
          </button>
          {demoCount > 0 && (
            <button type="button" onClick={clearDemoData} className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
              Remove demo data ({demoCount})
            </button>
          )}
        </div>
      </section>
    </>
  );
}
