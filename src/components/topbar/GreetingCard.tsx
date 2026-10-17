import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import { useNow } from '../../hooks/useNow';
import { formatDateLine } from '../../lib/time';
import { dayPart, friendlyLine, quoteFor } from '../../lib/greeting';

// The first thing you see: a warm greeting with your name, a line that fits
// the moment (Friday, late night, early morning…), and a daily motivational
// quote you can shuffle. A soft aurora tinted to the time of day drifts
// behind it. Narrow cards stack; wide ones (tablet row) lay out side by side.

export const GreetingCard = memo(function GreetingCard({ onSetName }: { onSetName?: () => void }) {
  // Minute resolution is plenty for the greeting and the date.
  const now = useNow(60_000);
  const name = useStore((s) => s.settings.greetingName.trim());
  const showQuote = useStore((s) => s.settings.showQuote ?? true);
  const [shuffle, setShuffle] = useState(0);
  const { part, hello, emoji } = dayPart(now);
  const quote = quoteFor(now, shuffle);

  return (
    <section
      data-testid="greeting-card"
      data-daypart={part}
      aria-label="Greeting"
      className="greeting-card glass @container relative flex h-full min-w-0 flex-col overflow-hidden px-4 pt-3 pb-3"
    >
      <span aria-hidden className="greeting-aurora" />

      <div className="relative flex min-h-0 flex-1 flex-col gap-1.5 @min-[560px]:flex-row @min-[560px]:items-center @min-[560px]:gap-6">
        <div className="min-w-0 @min-[560px]:flex-1">
          <div className="flex items-center gap-2">
            <span aria-hidden className={`greeting-emoji text-[1.35rem] leading-none greeting-emoji--${part}`}>
              {emoji}
            </span>
            <p className="text-gradient truncate font-display text-[10px] font-semibold tracking-[0.2em]">
              {formatDateLine(now)}
            </p>
          </div>
          <h1 className="mt-1 font-display leading-[1.05] font-bold tracking-tight text-white">
            <span className="block text-[15px] font-semibold text-white/75">
              {hello}
              {name ? ',' : ''}
            </span>
            {name ? (
              <span className="greeting-name block truncate pb-0.5 text-[1.85rem]">{name}</span>
            ) : (
              <button
                type="button"
                onClick={onSetName}
                className="mt-0.5 block text-left text-[12px] font-medium text-[var(--color-accent)] hover:underline"
              >
                Add your name ✍️
              </button>
            )}
          </h1>
          <p data-testid="greeting-line" className="greeting-line mt-1 truncate text-[11.5px] text-white/70">
            {friendlyLine(now)}
          </p>
        </div>

        {showQuote && (
          <figure className="group/quote greeting-quote relative mt-auto min-w-0 @min-[560px]:mt-0 @min-[560px]:max-w-[55%]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.blockquote
                key={quote.text}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="border-l-2 border-[var(--color-accent)]/60 pl-2.5"
              >
                <p data-testid="greeting-quote" className="line-clamp-2 text-[11.5px] leading-snug text-white/85 italic">
                  “{quote.text}”
                </p>
                <figcaption className="mt-0.5 text-[10px] text-white/55">— {quote.author}</figcaption>
              </motion.blockquote>
            </AnimatePresence>
            <button
              type="button"
              onClick={() => setShuffle((n) => n + 1)}
              aria-label="Another quote"
              title="Another quote"
              className="absolute right-0 bottom-0 flex size-5 items-center justify-center rounded-md text-[11px] text-white/50 opacity-0 transition-opacity group-hover/quote:opacity-100 hover:bg-white/10 hover:text-white focus-visible:opacity-100"
            >
              ↻
            </button>
          </figure>
        )}
      </div>
    </section>
  );
});
