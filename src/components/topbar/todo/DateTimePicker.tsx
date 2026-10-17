import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { localDateKey } from '../../../lib/time';

// Due date & time picker for to-dos: quick picks, a month calendar and time
// slots, in a popover anchored to the button that opened it. Rendered in a
// portal so the to-do card's rounded clipping never cuts it off.

export interface DueValue {
  dueDate: string | null; // 'YYYY-MM-DD'
  dueTime: string | null; // 'HH:mm'
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TIME_SLOTS = ['09:00', '12:00', '15:00', '18:00', '21:00'];
const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const longFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const pad = (n: number) => String(n).padStart(2, '0');

const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function formatTime12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

export function describeDue(v: DueValue): string {
  if (!v.dueDate) return 'No due date';
  const day = longFmt.format(fromKey(v.dueDate));
  return v.dueTime ? `${day} · ${formatTime12(v.dueTime)}` : day;
}

export function DateTimePicker({
  anchor,
  value,
  onChange,
  onClose,
}: {
  anchor: HTMLElement;
  value: DueValue;
  onChange: (v: DueValue) => void;
  onClose: () => void;
}) {
  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);
  const selected = value.dueDate ? fromKey(value.dueDate) : null;
  const [view, setView] = useState(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Below the anchor, flipped above or nudged left when it would leave the screen.
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const w = ref.current?.offsetWidth ?? 288;
      const h = ref.current?.offsetHeight ?? 420;
      const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
      const below = r.bottom + 6;
      const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below;
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    // Capture + stopImmediatePropagation: Escape closes only the picker, not the to-do card.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [anchor, onClose]);

  const setDate = (d: Date | null) => onChange({ dueDate: d ? localDateKey(d) : null, dueTime: d ? value.dueTime : null });
  const setTime = (t: string | null) => value.dueDate && onChange({ dueDate: value.dueDate, dueTime: t });

  const quick: Array<{ label: string; hint: string; date: Date | null }> = [
    { label: 'Today', hint: longFmt.format(today).split(',')[0], date: today },
    { label: 'Tomorrow', hint: longFmt.format(addDays(today, 1)).split(',')[0], date: addDays(today, 1) },
    { label: 'This weekend', hint: 'Sat', date: addDays(today, (6 - today.getDay() + 7) % 7) },
    { label: 'Next week', hint: 'Mon', date: addDays(today, ((8 - today.getDay()) % 7) || 7) },
    { label: 'In 2 weeks', hint: longFmt.format(addDays(today, 14)).split(', ')[1], date: addDays(today, 14) },
    { label: 'No date', hint: '', date: null },
  ];

  // 6 rows × 7 days starting on the Sunday before the 1st.
  const cells = useMemo(() => {
    const start = addDays(view, -view.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [view]);

  const [hh, mm] = (value.dueTime ?? '09:00').split(':');

  return createPortal(
    <motion.div
      ref={ref}
      role="dialog"
      aria-label="Due date and time"
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14 }}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="dropdown-menu dtp fixed z-[70] w-[288px] rounded-2xl border p-3 shadow-2xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white">{describeDue(value)}</span>
        {value.dueDate && (
          <button type="button" onClick={() => setDate(null)} className="text-[11px] text-white/55 hover:text-red-300">
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {quick.map((q) => {
          const active = q.date ? value.dueDate === localDateKey(q.date) : !value.dueDate;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => setDate(q.date)}
              aria-pressed={active}
              className={`dtp-chip flex items-center justify-between rounded-lg border px-2 py-1.5 text-[11px] ${active ? 'is-active' : ''}`}
            >
              <span className="font-medium text-white/90">{q.label}</span>
              <span className="font-mono text-[10px] text-white/45">{q.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          aria-label="Previous month"
          className="flex size-6 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
        >
          ‹
        </button>
        <span className="text-[12px] font-semibold text-white/90">{monthFmt.format(view)}</span>
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          aria-label="Next month"
          className="flex size-6 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
        >
          ›
        </button>
      </div>
      <div className="mt-1 grid grid-cols-7 text-center font-mono text-[9.5px] text-white/40">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div role="grid" aria-label={monthFmt.format(view)} className="grid grid-cols-7 gap-0.5">
        {cells.map((d) => {
          const key = localDateKey(d);
          const inMonth = d.getMonth() === view.getMonth();
          const isToday = key === localDateKey(today);
          const isSel = key === value.dueDate;
          const past = d < today;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={longFmt.format(d)}
              onClick={() => setDate(d)}
              className={`dtp-day flex h-7 items-center justify-center rounded-lg text-[11.5px] tabular-nums ${
                isSel ? 'is-selected' : isToday ? 'is-today' : ''
              } ${inMonth ? (past ? 'text-white/35' : 'text-white/85') : 'text-white/20'}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className={`mt-3 border-t border-white/[0.08] pt-2.5 ${value.dueDate ? '' : 'pointer-events-none opacity-40'}`}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white/70">Time</span>
          <button
            type="button"
            role="switch"
            aria-checked={!!value.dueTime}
            aria-label="Set a time"
            onClick={() => setTime(value.dueTime ? null : '09:00')}
            className={`switch relative h-[18px] w-[30px] rounded-full transition-colors ${value.dueTime ? 'is-on' : ''}`}
          >
            <span
              className={`absolute top-[2px] left-[2px] size-[14px] rounded-full bg-white shadow transition-transform ${
                value.dueTime ? 'translate-x-3' : ''
              }`}
            />
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {TIME_SLOTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTime(t)}
              aria-pressed={value.dueTime === t}
              className={`dtp-chip rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] text-white/85 ${value.dueTime === t ? 'is-active' : ''}`}
            >
              {formatTime12(t)}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-white/70">
          <span>Exact</span>
          <select
            value={hh}
            onChange={(e) => setTime(`${e.target.value}:${mm}`)}
            aria-label="Hour"
            className="dtp-select rounded-md border px-1 py-0.5"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={pad(h)}>
                {pad(h)}
              </option>
            ))}
          </select>
          :
          <select
            value={mm}
            onChange={(e) => setTime(`${hh}:${e.target.value}`)}
            aria-label="Minute"
            className="dtp-select rounded-md border px-1 py-0.5"
          >
            {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].includes(mm) ? null : (
              <option value={mm}>{mm}</option>
            )}
            {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={onClose} className="accent-gradient rounded-lg px-3.5 py-1 text-[11px] font-semibold text-white">
          Done
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}
