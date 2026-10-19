import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { detectPlatform } from '../../services/commands';
import { runInTerminal, type TerminalResult } from '../../services/terminal';

// C — the terminal box under the Git widget. Enter runs the command in a new
// terminal window on this computer (PowerShell on Windows, the default
// terminal on Linux / macOS) through the DevDeck desktop helper; the admin
// toggle runs it elevated (UAC / sudo). ↑/↓ walk history. The admin toggle is
// per-session on purpose: elevated mode should never be sticky across tabs.
// Built-in commands (calc, open, gh…) live in the search bar.

const HISTORY_LIMIT = 30;
// Only the label: the helper opens the OS's own terminal (on Linux the first
// of x-terminal-emulator, gnome-terminal, konsole, xfce4-terminal, kitty,
// alacritty, xterm) and runs the command with bash.
const SHELL = { windows: 'PowerShell', mac: 'Terminal', linux: 'your terminal' } as const;

type Notice = { kind: 'ok' | 'error' | 'setup'; message: string };

export const CommandPrompt = memo(function CommandPrompt({ onSetup }: { onSetup?: () => void }) {
  const [value, setValue] = useState('');
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Notice | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<string[]>([]);
  const cursorRef = useRef(-1);
  const platform = useMemo(() => detectPlatform(), []);
  const shell = SHELL[platform];

  // Results fade after a few seconds; errors linger a little longer.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), result.kind === 'ok' ? 3000 : 9000);
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

  const execute = async () => {
    const input = value.trim();
    if (!input || busy) return;
    historyRef.current = [input, ...historyRef.current.filter((h) => h !== input)].slice(0, HISTORY_LIMIT);
    cursorRef.current = -1;
    setBusy(true);
    const res: TerminalResult = await runInTerminal(input, admin);
    setBusy(false);
    if (res.ok) {
      setResult({ kind: 'ok', message: `Running in ${shell}${admin ? ' as administrator' : ''} — see the new window` });
      setValue('');
    } else {
      setResult({ kind: res.reason === 'no-helper' || res.reason === 'not-extension' ? 'setup' : 'error', message: res.message });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void execute();
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
        data-admin={admin || undefined}
        className="term flex h-10 items-center gap-2 rounded-xl pr-1 pl-2.5 font-mono text-xs"
      >
        {/* Window chrome that matches the OS: traffic lights on macOS, a terminal mark elsewhere. */}
        {platform === 'mac' ? (
          <span aria-hidden className="term-dots flex shrink-0 gap-1">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <span aria-hidden data-os={platform} className="term-mark flex h-5 shrink-0 items-center justify-center rounded-[5px] px-1 text-[10px] font-bold">
            &gt;_
          </span>
        )}
        <span aria-hidden className={`term-seg flex h-6 shrink-0 items-center gap-1 pr-3 pl-2 text-[11px] font-bold ${busy ? 'animate-pulse' : ''}`}>
          {admin ? '#' : platform === 'windows' ? 'PS' : '$'}
          <span className="term-seg-path font-medium">❯ ~</span>
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
          placeholder={admin ? `run in ${shell} as administrator…` : `run a command in ${shell}…`}
          className="term-input min-w-0 flex-1 bg-transparent outline-none"
        />
        <button
          type="button"
          onClick={() => setAdmin((a) => !a)}
          aria-pressed={admin}
          aria-label="Administrator mode"
          title={admin ? `Administrator mode ON — commands run in an elevated ${shell}` : 'Administrator mode'}
          className={`flex size-7 items-center justify-center rounded-lg transition-colors ${
            admin ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/70' : 'text-white/40 hover:bg-white/10 hover:text-white/80'
          }`}
        >
          <AdminIcon />
        </button>
      </div>

      {result && (
        <div
          role="status"
          data-testid="command-result"
          className={`glass-raised absolute top-full right-0 left-0 z-40 mt-1.5 rounded-xl px-3 py-2 font-mono text-[11px] leading-snug break-words select-text ${
            result.kind === 'ok' ? 'text-emerald-300' : result.kind === 'setup' ? 'text-amber-200' : 'text-red-300'
          }`}
        >
          {result.message}
          {result.kind === 'setup' && onSetup && (
            <button type="button" onClick={onSetup} className="ml-2 font-sans font-semibold text-[var(--color-accent)] hover:underline">
              Set up →
            </button>
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
