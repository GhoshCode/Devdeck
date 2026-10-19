import { useStore } from '../../store';
import { AI_PROVIDERS, aiProvider, type AiProviderId } from '../../services/ai';

// Settings → Profile: which AI the search bar's AI toggle talks to. Gemini,
// ChatGPT and Claude get the text typed in and sent (extension); Perplexity
// and custom URLs take it in the link ({q}).

const NOTE: Record<AiProviderId, string> = {
  gemini: 'Typed in and sent for you',
  chatgpt: 'Typed in and sent for you',
  claude: 'Typed in and sent for you',
  perplexity: 'Runs straight from the link',
  custom: 'Any site with a {q} search URL',
};

export function AiProviderPicker() {
  const id = useStore((s) => s.settings.aiProvider ?? 'gemini');
  const customUrl = useStore((s) => s.settings.aiCustomUrl ?? '');
  const updateSettings = useStore((s) => s.updateSettings);
  const options: Array<{ id: AiProviderId; name: string; color: string }> = [
    ...AI_PROVIDERS.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    { id: 'custom', name: 'Custom', color: '#8b5cf6' },
  ];
  const current = aiProvider(id, customUrl);

  return (
    <section aria-label="AI assistant" className="glass-inner space-y-3 rounded-2xl border border-white/10 p-5">
      <div>
        <span className="block text-xs font-semibold tracking-wider text-white/80 uppercase">AI assistant</span>
        <p className="mt-0.5 text-[11px] text-white/55">
          With the AI toggle in the search bar on, Enter opens a new {current.name} chat with your text already sent.
        </p>
      </div>
      <div role="radiogroup" aria-label="AI assistant" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={id === o.id}
            onClick={() => updateSettings({ aiProvider: o.id })}
            className={`theme-card flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left ${id === o.id ? 'is-active' : ''}`}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <span className="size-2 rounded-full" style={{ background: o.color }} />
              {o.name}
            </span>
            <span className="text-[10px] leading-tight text-white/55">{NOTE[o.id]}</span>
          </button>
        ))}
      </div>
      {id === 'custom' && (
        <div className="space-y-1">
          <input
            value={customUrl}
            onChange={(e) => updateSettings({ aiCustomUrl: e.target.value.trim() })}
            placeholder="https://example.ai/search?q={q}"
            aria-label="Custom AI URL"
            spellCheck={false}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 font-mono text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
          />
          {!customUrl.includes('{q}') && (
            <p className="text-[11px] text-amber-300">Include {'{q}'} where your text should go — until then Gemini is used.</p>
          )}
        </div>
      )}
    </section>
  );
}
