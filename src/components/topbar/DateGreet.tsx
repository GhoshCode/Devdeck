import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import { useNow } from '../../hooks/useNow';
import { formatDateLine, greetingFor } from '../../lib/time';
import { quoteFor } from '../../lib/greeting';
import { GREET_STYLES } from '../../types';

// The uppercase date line, under the clock.
export const DateLine = memo(function DateLine() {
  const now = useNow(60_000);
  return <p className="text-gradient font-display text-[13px] font-semibold tracking-[0.22em]">{formatDateLine(now)}</p>;
});

// Every 10 minutes a soft spotlight sweeps across your name, left to right
// (only the name — not the greeting or the quote). Skipped with reduced motion.
const SPOTLIGHT_EVERY_MS = 10 * 60_000;

function SpotlightName({ name }: { name: string }) {
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const first = setTimeout(() => setSweep((n) => n + 1), 1200); // once shortly after opening
    const timer = setInterval(() => setSweep((n) => n + 1), SPOTLIGHT_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return (
    <span
      key={sweep}
      data-testid="greet-name"
      className={sweep ? 'greet-spotlight' : undefined}
      onAnimationEnd={(e) => e.currentTarget.classList.remove('greet-spotlight')}
    >
      {name}
    </span>
  );
}

// No name yet: a quiet "+ Add your name" beside the greeting, shown only while
// you hover the greeting. Enter saves, Esc or clicking away cancels.
function AddName({ onSave }: { onSave: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = () => {
    if (draft?.trim()) onSave(draft.trim().slice(0, 40));
    setDraft(null);
  };
  return (
    <span className="absolute top-1/2 left-full ml-3 -translate-y-1/2">
      {draft === null ? (
        <button
          type="button"
          onClick={() => setDraft('')}
          className="add-name-btn whitespace-nowrap rounded-lg border border-dashed px-2.5 py-1 text-[11.5px] font-medium opacity-0 transition-opacity group-hover/greet:opacity-100 focus-visible:opacity-100"
        >
          + Add your name
        </button>
      ) : (
        <input
          autoFocus
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setDraft(null);
          }}
          placeholder="Your name, then Enter"
          aria-label="Your name for the greeting"
          className="add-name-input w-44 rounded-lg border px-2.5 py-1 text-[12px] outline-none"
        />
      )}
    </span>
  );
}

// GREET (top-centre of the top bar, above the search): the time-of-day
// greeting with your name and a daily motivational quote (Appearance →
// Greeting can turn it off; hover it for another).
export const DateGreet = memo(function DateGreet() {
  // Minute resolution is plenty for a date and a greeting.
  const now = useNow(60_000);
  const name = useStore((s) => s.settings.greetingName);
  const showQuote = useStore((s) => s.settings.showQuote ?? true);
  const greetStyle = useStore((s) => s.settings.greetStyle ?? 'classic');
  const updateSettings = useStore((s) => s.updateSettings);
  // Click the greeting for the next style, right-click for the previous one.
  const at = Math.max(0, GREET_STYLES.findIndex((g) => g.id === greetStyle));
  const step = (d: number) => updateSettings({ greetStyle: GREET_STYLES[(at + d + GREET_STYLES.length) % GREET_STYLES.length].id });
  const [shuffle, setShuffle] = useState(0);
  const quote = quoteFor(now, shuffle);

  return (
    <div className="group/greet flex min-w-0 flex-col items-center gap-1 text-center">
      <div className="relative max-w-full">
      <h1
        onClick={() => step(1)}
        onContextMenu={(e) => {
          e.preventDefault();
          step(-1);
        }}
        title={`Greeting style: ${GREET_STYLES[at].name} — click: next · right-click: previous`}
        className="max-w-full truncate font-display text-[1.85rem] leading-tight font-bold tracking-tight text-white/95 cursor-pointer select-none"
      >
        {/* The style (Appearance → Greeting) colours the words; the name keeps its own look. */}
        <span data-testid="greet-words" className={`greet-words greet-${greetStyle}`}>
          {greetingFor(now)}
          {name.trim() && ','}
        </span>
        {name.trim() && (
          <>
            {' '}
            <SpotlightName name={name.trim().toUpperCase()} />
          </>
        )}
      </h1>
      {!name.trim() && <AddName onSave={(n) => updateSettings({ greetingName: n })} />}
      </div>
      {showQuote && (
        <figure className="group/quote relative max-w-[calc(100%-1.75rem)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.blockquote
              key={quote.text}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              <p
                data-testid="greeting-quote"
                title={`${quote.text} — ${quote.author}`}
                className="line-clamp-1 text-[12px] leading-snug text-white/75 italic"
              >
                “{quote.text}” <span className="text-[10.5px] tracking-wide text-white/50 not-italic">— {quote.author}</span>
              </p>
            </motion.blockquote>
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setShuffle((n) => n + 1)}
            aria-label="Another quote"
            title="Another quote"
            className="absolute top-0 -right-6 flex size-5 items-center justify-center rounded-md text-[11px] text-white/50 opacity-0 transition-opacity group-hover/quote:opacity-100 hover:bg-white/10 hover:text-white focus-visible:opacity-100"
          >
            ↻
          </button>
        </figure>
      )}
    </div>
  );
});
