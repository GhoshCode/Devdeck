import { useStore } from '../../store';
import { SEARCH_ENGINES } from '../../services/search';
import { isExtension } from '../../lib/env';

// Settings → Profile → Search: the engine behind Enter / Ctrl+Enter, and
// (extension) whether a new tab puts the cursor in DevDeck's search.
export function SearchSettings() {
  const engine = useStore((s) => s.settings.searchEngine ?? 'google');
  const focus = useStore((s) => s.settings.newTabFocus ?? false);
  const updateSettings = useStore((s) => s.updateSettings);
  return (
    <section aria-label="Search" className="glass-inner space-y-3 rounded-2xl border border-white/10 p-5">
      <div>
        <span className="block text-xs font-semibold tracking-wider text-white/80 uppercase">Search</span>
        <p className="mt-0.5 text-[11px] text-white/55">
          Enter searches in a new tab · Ctrl+Enter opens a new window · Alt+Enter asks your AI (scroll on the AI icon to switch).
        </p>
      </div>
      <div role="radiogroup" aria-label="Search engine" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SEARCH_ENGINES.map((e) => (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={engine === e.id}
            onClick={() => updateSettings({ searchEngine: e.id })}
            className={`theme-card rounded-xl border px-3 py-2 text-left text-xs font-semibold text-white ${engine === e.id ? 'is-active' : ''}`}
          >
            {e.name}
          </button>
        ))}
      </div>
      {isExtension() && (
        <label className="flex cursor-pointer items-start gap-2.5 pt-1">
          <input type="checkbox" checked={focus} onChange={(e) => updateSettings({ newTabFocus: e.target.checked })} className="mt-0.5 size-4 cursor-pointer accent-[var(--color-accent)]" />
          <span>
            <span className="block text-[13px] font-medium text-white/85">Type straight into DevDeck on a new tab</span>
            <span className="block text-[11px] text-white/50">
              Chrome puts the cursor in its address bar on new tabs. With this on, DevDeck reopens itself once so your typing lands in its search; the address bar then shows the extension address.
            </span>
          </span>
        </label>
      )}
    </section>
  );
}
