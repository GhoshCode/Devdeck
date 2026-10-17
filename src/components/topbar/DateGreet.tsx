import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import { useNow } from '../../hooks/useNow';
import { formatDateLine, greetingFor } from '../../lib/time';
import { quoteFor } from '../../lib/greeting';

// DATE & GREET (top-left of the top bar, above the clock): uppercase date line, the
// time-of-day greeting with your name, and a daily motivational quote
// (Appearance → Greeting can turn it off; hover it for another).
export const DateGreet = memo(function DateGreet() {
  // Minute resolution is plenty for a date and a greeting.
  const now = useNow(60_000);
  const name = useStore((s) => s.settings.greetingName);
  const showQuote = useStore((s) => s.settings.showQuote ?? true);
  const [shuffle, setShuffle] = useState(0);
  const quote = quoteFor(now, shuffle);

  return (
    <div className="flex min-w-0 flex-col items-start gap-1 text-left">
      <p className="text-gradient font-display text-xs font-semibold tracking-[0.22em]">{formatDateLine(now)}</p>
      <h1 className="truncate font-display text-[1.6rem] leading-tight font-bold tracking-tight text-white/95">
        {greetingFor(now, name)}
      </h1>
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
              <p data-testid="greeting-quote" title={`${quote.text} — ${quote.author}`}className="line-clamp-2 text-[12px] leading-snug text-white/75 italic">
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
