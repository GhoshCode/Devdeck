import { useStore } from '../../store';
import { SEARCH_ENGINES } from '../../services/search';

// Settings → Profile → Search: the engine behind Enter / Ctrl+Enter.
export function SearchSettings() {
  const engine = useStore((s) => s.settings.searchEngine ?? 'google');
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
    </section>
  );
}
