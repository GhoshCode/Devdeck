import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useNow } from '../../hooks/useNow';
import { DAY, addDays, dayKey, startOfDay, startOfMonth, startOfWeek } from '../../lib/calendar';

// A plain month calendar in macOS-style glass, next to the Calendar bar.
// No events — just dates: today glows in the accent, ISO week numbers run
// down the side, and the footer tells you about the picked day.
// Double-click the month or year: Month and Year wheels open side by side to
// jump any number of months / years away.
// Keys: ←/→/↑/↓ move a day / week, PgUp/PgDn a month, T today, Esc closes
// (the wheel first, then the calendar).

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const FIRST_YEAR = 1900;
const LAST_YEAR = 2200;
const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => String(FIRST_YEAR + i));
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }));
const ROW = 34; // wheel row height
const W = 312;

// ISO-8601 week number (weeks start Monday; week 1 holds the first Thursday).
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
}

const dayOfYear = (d: Date) => Math.round((startOfDay(d).getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / DAY) + 1;
const daysInYear = (y: number) => (new Date(y, 1, 29).getMonth() === 1 ? 366 : 365);

export const MiniCalendarButton = memo(function MiniCalendarButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Calendar (dates only)"
        title="Calendar"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="mini-calendar-button"
        className={`mini-cal-btn glass-raised flex h-[58px] w-[52px] shrink-0 items-center justify-center rounded-2xl ${open ? 'is-open' : ''}`}
      >
        <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M3.5 9.5h17M8 3v4M16 3v4" />
          <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" strokeWidth="2.6" />
        </svg>
      </button>
      {createPortal(<AnimatePresence>{open && ref.current && <MiniCalendar anchor={ref.current} onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
});

function MiniCalendar({ anchor, onClose }: { anchor: HTMLElement; onClose: () => void }) {
  const now = useNow(1000);
  const panel = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() => startOfMonth(now));
  const [picked, setPicked] = useState(() => startOfDay(now));
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);
  const [wheel, setWheel] = useState(false);
  const wheelRef = useRef(wheel);
  wheelRef.current = wheel;

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const h = panel.current?.offsetHeight ?? 420;
      const right = r.right + 12 + W <= window.innerWidth - 8;
      const left = right ? r.right + 12 : Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
      const top = right ? Math.max(8, Math.min(r.top, window.innerHeight - h - 8)) : Math.min(r.bottom + 10, window.innerHeight - h - 8);
      setPos({ left, top, origin: right ? 'left top' : 'top' });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    // Esc closes it wherever focus is (it never reaches the page's own Esc handlers).
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      if (wheelRef.current) setWheel(false);
      else onClose();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc, true);
    };
  }, [anchor, onClose]);

  const pick = (d: Date) => {
    setPicked(startOfDay(d));
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) setMonth(startOfMonth(d));
  };
  const shiftMonth = (n: number) => {
    const m = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(m);
    setPicked(new Date(m.getFullYear(), m.getMonth(), Math.min(picked.getDate(), new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate())));
  };
  const today = () => pick(new Date());
  const jump = (year: number, m: number) => {
    const target = new Date(year, m, 1);
    setMonth(target);
    setPicked(new Date(year, m, Math.min(picked.getDate(), new Date(year, m + 1, 0).getDate())));
  };

  const onKey = (e: KeyboardEvent) => {
    if (wheel) return; // the wheel has its own keys
    const moves: Record<string, () => void> = {
      ArrowLeft: () => pick(addDays(picked, -1)),
      ArrowRight: () => pick(addDays(picked, 1)),
      ArrowUp: () => pick(addDays(picked, -7)),
      ArrowDown: () => pick(addDays(picked, 7)),
      PageUp: () => shiftMonth(-1),
      PageDown: () => shiftMonth(1),
      t: today,
      T: today,
    };
    const fn = moves[e.key];
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  const weeks = useMemo(() => {
    const first = startOfWeek(month);
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(first, w * 7 + i)));
  }, [month]);

  const todayKey = dayKey(now);
  const pickedKey = dayKey(picked);
  const diff = Math.round((picked.getTime() - startOfDay(now).getTime()) / DAY);
  const rel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <motion.div
      ref={panel}
      role="dialog"
      aria-label="Calendar"
      tabIndex={-1}
      onKeyDown={onKey}
      data-testid="mini-calendar"
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', stiffness: 460, damping: 32 }}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, width: W, transformOrigin: pos?.origin }}
      className="mini-cal fixed z-[95] rounded-[20px] p-4 outline-none"
    >
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onClose} aria-label="Close" className="mini-cal-light is-close" />
        <span className="mini-cal-light is-min" aria-hidden />
        <span className="mini-cal-light is-max" aria-hidden />
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" title="Previous month (PgUp)" className="mini-cal-nav">
            <Chev d="m15 6-6 6 6 6" />
          </button>
          <button type="button" onClick={today} title="Today (T)" className="mini-cal-today">
            Today
          </button>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" title="Next month (PgDn)" className="mini-cal-nav">
            <Chev d="m9 6 6 6-6 6" />
          </button>
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <p className="leading-none" aria-live="polite">
          <button type="button" onDoubleClick={() => setWheel(true)} title="Double-click to choose a month" className="mini-cal-month mini-cal-pickable text-[26px] font-light tracking-tight">
            {month.toLocaleDateString(undefined, { month: 'long' })}
          </button>{' '}
          <button type="button" onDoubleClick={() => setWheel(true)} title="Double-click to choose a year" className="mini-cal-year mini-cal-pickable text-[26px] font-semibold tabular-nums">
            {month.getFullYear()}
          </button>
        </p>
        <p className="mini-cal-clock font-mono text-[11px] tabular-nums">
          {pad(now.getHours())}
          <span className="mini-cal-blink">:</span>
          {pad(now.getMinutes())}
          <span className="opacity-50">:{pad(now.getSeconds())}</span>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-[22px_repeat(7,minmax(0,1fr))] gap-y-1" role="grid" aria-label={month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}>
        <span className="mini-cal-dim text-center font-mono text-[9px] leading-7" aria-hidden>
          W
        </span>
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={`text-center font-mono text-[10px] font-semibold tracking-wider uppercase leading-7 ${i > 4 ? 'mini-cal-weekend' : 'mini-cal-dim'}`}>
            {w}
          </span>
        ))}
        {weeks.map((row) => (
          <div key={dayKey(row[0])} role="row" className="contents">
            <span className="mini-cal-week text-center font-mono text-[9.5px] leading-9 tabular-nums" aria-hidden>
              {isoWeek(row[0])}
            </span>
            {row.map((d, i) => {
              const k = dayKey(d);
              const isToday = k === todayKey;
              const isPicked = k === pickedKey;
              const out = d.getMonth() !== month.getMonth();
              return (
                <button
                  key={k}
                  type="button"
                  role="gridcell"
                  aria-selected={isPicked}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={d.toDateString()}
                  onClick={() => pick(d)}
                  className={`mini-cal-day mx-auto flex size-9 items-center justify-center rounded-full text-[13px] tabular-nums ${isToday ? 'is-today' : ''} ${isPicked ? 'is-picked' : ''} ${out ? 'is-out' : ''} ${i > 4 ? 'is-weekend' : ''}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mini-cal-foot mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
        <div className="min-w-0">
          <p className="mini-cal-strong truncate text-[12.5px] font-semibold">{picked.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p className="mini-cal-dim font-mono text-[10px] tabular-nums">
            Day {dayOfYear(picked)}/{daysInYear(picked.getFullYear())} · Week {isoWeek(picked)}
          </p>
        </div>
        <span className="mini-cal-rel shrink-0 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold tabular-nums">{rel}</span>
      </div>

      <AnimatePresence>
        {wheel && (
          <motion.div
            key="wheels"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16 }}
            className="mini-cal-wheel-panel absolute inset-x-3 top-[86px] bottom-3 z-10 flex flex-col rounded-2xl p-3"
          >
            <div className="flex items-center justify-between px-1">
              <span className="mini-cal-dim font-mono text-[10px] font-semibold tracking-[0.18em] uppercase">Choose month &amp; year</span>
              <button type="button" onClick={() => setWheel(false)} className="mini-cal-today">
                Done
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="grid w-full grid-cols-[1.4fr_1fr] gap-1">
                <Wheel label="Month" items={MONTHS} index={month.getMonth()} onPick={(i) => jump(month.getFullYear(), i)} onDone={() => setWheel(false)} />
                <Wheel label="Year" items={YEARS} index={month.getFullYear() - FIRST_YEAR} onPick={(i) => jump(FIRST_YEAR + i, month.getMonth())} onDone={() => setWheel(false)} />
              </div>
            </div>
            <p className="mini-cal-dim text-center font-mono text-[9.5px]">Scroll · ↑/↓ · double-click or Enter to pick</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// A vertical, snapping wheel: the centred row is the choice, marked › 2014 ‹.
// Scrolling settles on a row; a click scrolls to it; double-click / Enter
// confirms; ↑/↓ step one row.
function Wheel({ label, items, index, onPick, onDone }: { label: string; items: string[]; index: number; onPick: (i: number) => void; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(index);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A click / key sets the value at once; its smooth scroll must not report rows on the way.
  const target = useRef<{ i: number; until: number } | null>(null);

  useLayoutEffect(() => {
    ref.current?.scrollTo({ top: index * ROW, behavior: 'instant' });
    ref.current?.focus({ preventScroll: true });
    // centre on the current value once, when the wheel opens
  }, []);
  useEffect(() => () => clearTimeout(settle.current), []);

  const to = (i: number) => {
    const n = Math.max(0, Math.min(items.length - 1, i));
    target.current = { i: n, until: Date.now() + 700 };
    ref.current?.scrollTo({ top: n * ROW, behavior: 'smooth' });
    setAt(n);
    onPick(n);
  };
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW)));
    const t = target.current;
    if (t && Date.now() < t.until && i !== t.i) return;
    target.current = null;
    setAt(i);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => onPick(i), 110);
  };

  return (
    <div className="relative w-full" style={{ height: ROW * 5 }}>
      <span aria-hidden className="mini-cal-wheel-band pointer-events-none absolute inset-x-2 rounded-xl" style={{ top: ROW * 2, height: ROW }} />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`wheel-${label}-${at}`}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            to(at + (e.key === 'ArrowDown' ? 1 : -1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            onDone();
          }
        }}
        className="mini-cal-wheel scrollbar-none h-full snap-y snap-mandatory overflow-y-auto outline-none"
        style={{ paddingTop: ROW * 2, paddingBottom: ROW * 2 }}
      >
        {items.map((it, i) => {
          const d = Math.abs(i - at);
          return (
            <button
              key={it}
              id={`wheel-${label}-${i}`}
              type="button"
              role="option"
              aria-selected={i === at}
              tabIndex={-1}
              onClick={() => to(i)}
              onDoubleClick={() => {
                to(i);
                onDone();
              }}
              className={`mini-cal-wheel-row flex w-full snap-center items-center justify-center gap-3 tabular-nums ${i === at ? 'is-on' : ''}`}
              style={{ height: ROW, opacity: d === 0 ? 1 : Math.max(0.18, 0.75 - d * 0.22), transform: `scale(${d === 0 ? 1 : Math.max(0.78, 1 - d * 0.08)})` }}
            >
              {i === at && <span className="mini-cal-wheel-mark" aria-hidden>›</span>}
              {it}
              {i === at && <span className="mini-cal-wheel-mark" aria-hidden>‹</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chev({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
