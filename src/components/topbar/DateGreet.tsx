import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import { useNow } from '../../hooks/useNow';
import { formatDateLine, greetingFor } from '../../lib/time';
import { quoteFor, type Quote } from '../../lib/greeting';
import { cachedQuote, fetchQuote } from '../../services/quotes';
import { fetchOnThisDay, type DayEvent } from '../../services/onThisDay';
import { GREET_STYLES, NAME_FONTS, type NameFont } from '../../types';

// The uppercase date line, under the clock.
export const DateLine = memo(function DateLine() {
  const now = useNow(60_000);
  return <p className="text-gradient font-display text-[13px] font-semibold tracking-[0.22em]">{formatDateLine(now)}</p>;
});

// Every 10 minutes a soft spotlight sweeps across your name, left to right
// (only the name — not the greeting or the quote). Skipped with reduced motion.
const SPOTLIGHT_EVERY_MS = 10 * 60_000;

function SpotlightName({ name, font }: { name: string; font: NameFont }) {
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
      className={`greet-name-face name-font-${font} ${sweep ? 'greet-spotlight' : ''}`}
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

// "On this day": one tech/computing event from today's date in history
// (Wikipedia); ↻ shows the next one. Hidden when there's nothing for today
// or the feed can't be reached.
const OnThisDay = memo(function OnThisDay() {
  const now = useNow(60_000);
  const day = `${now.getMonth()}-${now.getDate()}`;
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [at, setAt] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchOnThisDay(new Date())
      .then((list) => {
        if (!alive) return;
        setEvents(list);
        setAt(list.length ? Math.floor(Math.random() * list.length) : 0);
      })
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [day]);
  if (!events.length) return null;
  const ev = events[at % events.length];
  const label = ev.kind === 'born' ? 'Born: ' : ev.kind === 'died' ? 'Died: ' : '';
  return (
    <div className="group/otd flex max-w-full min-w-0 items-center gap-1">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`${ev.year}${ev.text}`}
          data-testid="on-this-day"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          title={`On this day in ${ev.year}: ${label}${ev.text}`}
          className="line-clamp-1 min-w-0 text-[13px] leading-snug text-white/80"
        >
          <span className="otd-label mr-1.5 font-mono text-[10.5px] font-semibold tracking-[0.14em] text-white/45 uppercase">On this day</span>
          <span className="font-semibold text-white/90">{ev.year}</span>
          <span className="text-white/40"> — </span>
          {ev.url ? (
            <a href={ev.url} target="_blank" rel="noreferrer" className="hover:underline">
              {label}
              {ev.text}
            </a>
          ) : (
            <>
              {label}
              {ev.text}
            </>
          )}
        </motion.p>
      </AnimatePresence>
      {(
        <button
          type="button"
          disabled={events.length < 2}
          onClick={() => setAt((n) => n + 1)}
          aria-label="Another event from this day"
          title={events.length < 2 ? 'The only tech event for today' : `Another event (${(at % events.length) + 1} of ${events.length})`}
          data-testid="on-this-day-next"
          className="otd-refresh flex size-[18px] shrink-0 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35"
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 11a8 8 0 1 0-2.3 5.7" />
            <path d="M20 4v7h-7" />
          </svg>
        </button>
      )}
    </div>
  );
});

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
  const showOnThisDay = useStore((s) => s.settings.showOnThisDay ?? true);
  // Quote from the quotes API (kept for the day); the built-in list only
  // fills in until it arrives, or offline.
  const [quote, setQuote] = useState<Quote>(() => cachedQuote(new Date()) ?? quoteFor(new Date()));
  const qday = `${now.getMonth()}-${now.getDate()}`;
  useEffect(() => {
    let alive = true;
    void fetchQuote(new Date()).then((q) => alive && setQuote(q));
    return () => {
      alive = false;
    };
  }, [qday]);
  const nextQuote = () => void fetchQuote(new Date(), true).then(setQuote);
  // Your name: click for the next typeface, right-click for the previous one,
  // double-click to rename it right here.
  const nameFont = useStore((s) => s.settings.nameFont ?? 'grotesk');
  const fontAt = Math.max(0, NAME_FONTS.findIndex((f) => f.id === nameFont));
  const font = NAME_FONTS[fontAt];
  const stepFont = (d: number) => updateSettings({ nameFont: NAME_FONTS[(fontAt + d + NAME_FONTS.length) % NAME_FONTS.length].id });
  const [editing, setEditing] = useState<string | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (clickTimer.current && clearTimeout(clickTimer.current)), []);
  const saveName = () => {
    if (editing !== null && editing.trim()) updateSettings({ greetingName: editing.trim().slice(0, 40) });
    setEditing(null);
  };

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
        className="max-w-full font-display text-[2.15rem] leading-[1.2] font-bold tracking-tight text-balance break-words text-white/95 cursor-pointer select-none"
      >
        {/* The style (Appearance → Greeting) colours the words; the name keeps its own look. */}
        <span data-testid="greet-words" className={`greet-words greet-${greetStyle}`}>
          {greetingFor(now)}
          {name.trim() && ','}
        </span>
        {name.trim() && (
          <>
            {' '}
            {editing !== null ? (
              <input
                autoFocus
                value={editing}
                maxLength={40}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditing(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') setEditing(null);
                }}
                aria-label="Your name"
                size={Math.max(6, editing.length + 1)}
                className="name-edit-input rounded-lg px-2 align-middle text-[0.8em] font-semibold outline-none"
              />
            ) : (
              <span
                role="button"
                tabIndex={0}
                title={`Name font: ${font.name} — click: next font · right-click: previous · double-click: rename`}
                onClick={(e) => {
                  e.stopPropagation(); // not a greeting-style change
                  if (clickTimer.current) clearTimeout(clickTimer.current);
                  clickTimer.current = setTimeout(() => stepFont(1), 240);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (clickTimer.current) clearTimeout(clickTimer.current);
                  setEditing(name.trim());
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  stepFont(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'F2') {
                    e.preventDefault();
                    setEditing(name.trim());
                  }
                }}
              >
                <SpotlightName name={font.upper ? name.trim().toUpperCase() : name.trim()} font={font.id} />
              </span>
            )}
          </>
        )}
      </h1>
      {!name.trim() && <AddName onSave={(n) => updateSettings({ greetingName: n })} />}
      </div>
      {showOnThisDay && <OnThisDay />}
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
            onClick={nextQuote}
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
