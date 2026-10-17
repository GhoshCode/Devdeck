import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from '../../store';
import { COMMANDS, complete, detectPlatform, parseCommand, runCommand, type CommandResult } from '../../services/commands';

// C — slim CLI bar under TIME + A/B (spec §3.3). Enter runs, Ctrl+Enter opens
// links in a new tab, Tab completes, ↑/↓ walk history. The admin toggle is
// per-session on purpose: elevated mode should never be sticky across tabs.

const HISTORY_LIMIT = 30;

export const CommandPrompt = memo(function CommandPrompt() {
  const sites = useStore((s) => s.sites);
  const [value, setValue] = useState('');
  const [admin, setAdmin] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<string[]>([]);
  const cursorRef = useRef(-1);
  const platform = useMemo(() => detectPlatform(), []);

  // Results fade after a few seconds; errors and output linger a little longer.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), result.kind === 'open' ? 2500 : 8000);
    return () => clearTimeout(t);
  }, [result]);

  // It is a popover: any click outside it dismisses it.
  useEffect(() => {
    if (!result) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setResult(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [result]);

  const execute = async (newTab: boolean) => {
    const input = value.trim();
    if (!input) return;
    historyRef.current = [input, ...historyRef.current.filter((h) => h !== input)].slice(0, HISTORY_LIMIT);
    cursorRef.current = -1;
    const res = runCommand(input, { admin, platform, sites });
    const { name } = parseCommand(input);
    setShowHelp(name === 'help' || name === '?');
    if (res.kind === 'open') {
      if (newTab) window.open(res.url, '_blank', 'noopener');
      else window.location.assign(res.url);
    } else if (res.kind === 'copy') {
      try {
        await navigator.clipboard.writeText(res.text);
      } catch {
        setResult({ kind: 'output', message: res.text });
        return;
      }
    }
    setResult(res);
    if (res.kind !== 'error') setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void execute(e.ctrlKey || e.metaKey);
    } else if (e.key === 'Tab' && value) {
      const next = complete(value, sites);
      if (next) {
        e.preventDefault();
        setValue(next);
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const h = historyRef.current;
      if (!h.length) return;
      e.preventDefault();
      const cur = cursorRef.current + (e.key === 'ArrowUp' ? 1 : -1);
      cursorRef.current = Math.max(-1, Math.min(h.length - 1, cur));
      setValue(cursorRef.current === -1 ? '' : h[cursorRef.current]);
    } else if (e.key === 'Escape') {
      setResult(null);
      e.currentTarget.blur();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`glass-raised flex h-12 items-center gap-2 rounded-2xl pr-1.5 pl-3.5 font-mono text-xs transition-colors ${
          admin ? 'border-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_0_18px_rgba(251,191,36,0.15)]' : ''
        }`}
      >
        <span aria-hidden className={admin ? 'font-bold text-amber-300' : 'text-[var(--color-accent)]'}>
          {admin ? '#' : '>'}
        </span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null); // typing dismisses the previous result
          }}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label="Command prompt"
          placeholder={admin ? 'elevated command…' : 'enter command or shortcut… (help)'}
          className="min-w-0 flex-1 bg-transparent text-white/90 outline-none placeholder:text-white/30"
        />
        <button
          type="button"
          onClick={() => setAdmin((a) => !a)}
          aria-pressed={admin}
          aria-label="Administrator mode"
          title={admin ? 'Administrator mode ON — unknown commands become an elevated terminal launcher' : 'Administrator mode'}
          className={`flex size-7 items-center justify-center rounded-lg transition-colors ${
            admin
              ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/70'
              : 'text-white/40 hover:bg-white/10 hover:text-white/80'
          }`}
        >
          <AdminIcon />
        </button>
      </div>

      {result && (
        <div
          role="status"
          data-testid="command-result"
          className={`glass-raised absolute top-full right-0 z-40 mt-1.5 min-w-full rounded-xl px-3 py-2 font-mono text-[11px] leading-snug break-words select-text ${showHelp ? 'w-max max-w-[480px]' : 'left-0'} ${
            result.kind === 'error' ? 'text-red-300' : result.kind === 'copy' ? 'text-amber-200' : 'text-white/85'
          }`}
        >
          {showHelp && result.kind === 'output' ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {COMMANDS.map((c) => (
                <div key={c.name} className="contents">
                  <dt className="whitespace-nowrap text-[var(--color-accent)]">{c.usage}</dt>
                  <dd className="font-sans text-white/60">{c.help}</dd>
                </div>
              ))}
            </dl>
          ) : (
            result.message
          )}
        </div>
      )}
    </div>
  );
});

// Wrench crossed over a gear — the "system administrator" glyph from the spec.
function AdminIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="9" r="2.2" />
      <path d="M9 3.5v1.6M9 12.9v1.6M3.5 9h1.6M12.9 9h1.6M5.1 5.1l1.1 1.1M11.8 11.8l1.1 1.1M5.1 12.9l1.1-1.1M11.8 6.2l1.1-1.1" />
      <path d="M14.5 14.5l5.2 5.2a1.5 1.5 0 0 1-2.1 2.1l-5.2-5.2" />
      <path d="M20.5 13.2a3.2 3.2 0 0 1-4.2 3.1" />
    </svg>
  );
}
