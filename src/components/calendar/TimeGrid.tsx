import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  DAY,
  MIN,
  SNAP_MIN,
  addDays,
  dayKey,
  findConflicts,
  fmtRange,
  fmtTime,
  layoutColumns,
  onDay,
  startOfDay,
  fmtDuration,
  workload,
  type CalItem,
  type ConflictReport,
} from '../../lib/calendar';
import { ItemBlock, ItemChip } from './ItemBlock';
import { hourLabel, zoneAbbr, zoneClock, type Point } from './meta';

interface Props {
  days: Date[];
  items: CalItem[];
  conflicts: ConflictReport;
  hourPx: number;
  now: number;
  h24: boolean;
  zone: string | null; // second time rail
  flashKey: string | null;
  onCreate: (date: string, startMin: number, endMin: number, at: Point) => void;
  onOpen: (item: CalItem, at: Point) => void;
  onToggleTodo: (id: string) => void;
  onPickDay?: (d: Date) => void;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TimeGrid = memo(function TimeGrid({ days, items, conflicts, hourPx, now, h24, zone, flashKey, onCreate, onOpen, onToggleTodo, onPickDay }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const todayKey = dayKey(now);
  const showsToday = days.some((d) => dayKey(d) === todayKey);
  const nowMin = (now - startOfDay(now).getTime()) / MIN;
  const firstKey = dayKey(days[0]);

  // Open on the morning, or just before now on today.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const flashed = flashKey ? items.find((i) => i.key === flashKey && !i.allDay) : undefined;
    const focusMin = flashed ? (flashed.start - startOfDay(flashed.start).getTime()) / MIN - 60 : showsToday ? nowMin - 90 : 7 * 60;
    el.scrollTop = Math.max(0, (focusMin / 60) * hourPx);
    // Only when the range, scale or flashed item changes — not every minute tick.
  }, [firstKey, days.length, hourPx, flashKey]);

  const perDay = useMemo(() => days.map((d) => onDay(items, d)), [days, items]);
  const allDay = perDay.map((list) => list.filter((i) => i.allDay));
  const hasAllDay = allDay.some((l) => l.length);
  const zoneName = zone ? zoneAbbr(zone, now) : '';
  const single = days.length === 1;
  const railCols = `64px${zone ? ' 60px' : ''}`;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="cal-timegrid">
      {/* Day headers */}
      <div className="cc-line grid shrink-0 border-b" style={{ gridTemplateColumns: `${railCols} repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="cc-rail-head flex items-end justify-end px-2.5 pb-2 font-mono text-[10px] font-semibold tracking-wider uppercase">{localAbbr(now)}</div>
        {zone && (
          <div className="cc-rail-head is-second cc-line flex items-end justify-end border-l px-2 pb-2 font-mono text-[10px] font-semibold tracking-wider uppercase" title={zone}>
            {zoneName}
          </div>
        )}
        {days.map((d, i) => {
          const isToday = dayKey(d) === todayKey;
          const load = workload(perDay[i]);
          const count = perDay[i].length;
          return (
            <button
              key={dayKey(d)}
              type="button"
              disabled={!onPickDay}
              onClick={() => onPickDay?.(d)}
              className={`cc-dayhead cc-line flex min-w-0 items-center gap-2.5 border-l px-3 py-2 text-left ${isToday ? 'is-today' : ''}`}
              data-load={load.level}
            >
              <span className="flex flex-col leading-none">
                <span className="cc-fg3 text-[9.5px] font-bold tracking-[0.16em] uppercase">{DOW[d.getDay()]}</span>
                <span className={`cc-daynum mt-1 text-[18px] font-bold tabular-nums ${isToday ? 'is-today' : ''}`}>{d.getDate()}</span>
              </span>
              {single && (
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="cc-fg text-[13px] font-semibold">{d.toLocaleDateString(undefined, { weekday: 'long' })} · {d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                  <span className="cc-fg3 text-[11px]">Click any slot to schedule · drag to block a range</span>
                </span>
              )}
              <span className="ml-auto flex shrink-0 flex-col items-end gap-1" title={`${load.score} meetings, due dates and conflicts`}>
                <span className="cc-fg3 font-mono text-[10px] tabular-nums">
                  {count} item{count === 1 ? '' : 's'}
                </span>
                <span className="cc-loadbar h-1 w-10 overflow-hidden rounded-full">
                  <span className="block h-full rounded-full" style={{ width: `${Math.min(100, load.score * 14)}%` }} />
                </span>
              </span>
            </button>
          );
        })}

      </div>

      {/* Due dates without a time */}
      {hasAllDay && (
        <div className="cc-line grid shrink-0 border-b" style={{ gridTemplateColumns: `${railCols} repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="cc-fg3 flex items-start justify-end px-2 pt-1.5 text-[10px] font-semibold tracking-wider uppercase" style={zone ? { gridColumn: 'span 2' } : undefined}>
            All day
          </div>
          {allDay.map((list, i) => (
            <div key={i} className="cc-line flex max-h-[76px] min-w-0 flex-col gap-0.5 overflow-y-auto border-l p-1 cc-scroll">
              {list.map((it) => (
                <ItemChip key={it.key} item={it} h24={h24} conflicts={conflicts.byKey.get(it.key) ?? 0} flash={flashKey === it.key} onOpen={onOpen} onToggleTodo={onToggleTodo} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scroller} className="cc-scroll relative min-h-0 flex-1 overflow-y-auto" data-testid="cal-scroller">
        <div className="relative grid" style={{ height: 24 * hourPx, gridTemplateColumns: `${railCols} repeat(${days.length}, minmax(0, 1fr))` }}>
          <Rail hourPx={hourPx} label={(h) => hourLabel(h, h24)} nowMin={showsToday ? nowMin : null} nowText={fmtTime(now, h24)} primary />
          {zone && <Rail hourPx={hourPx} label={(h) => zoneClock(zone, startOfDay(days[0]).getTime() + h * 3_600_000, h24)} nowMin={showsToday ? nowMin : null} nowText={zoneClock(zone, now, h24)} />}
          {days.map((d, i) => (
            <DayColumn
              key={dayKey(d)}
              day={d}
              items={perDay[i]}
              conflicts={conflicts}
              hourPx={hourPx}
              h24={h24}
              nowMin={dayKey(d) === todayKey ? nowMin : null}
              past={addDays(d, 1).getTime() <= now}
              flashKey={flashKey}
              onCreate={onCreate}
              onOpen={onOpen}
              onToggleTodo={onToggleTodo}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

const localAbbr = (now: number) => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? 'Local';
  } catch {
    return 'Local';
  }
};

function Rail({ hourPx, label, nowMin, nowText, primary = false }: { hourPx: number; label: (h: number) => string; nowMin: number | null; nowText: string; primary?: boolean }) {
  return (
    <div className={`cc-rail relative ${primary ? '' : 'cc-line border-l is-second'}`} aria-hidden>
      {HOURS.map((h) =>
        h === 0 ? null : (
          <span key={h} className="cc-fg3 absolute right-2 -translate-y-1/2 font-mono text-[10px] tabular-nums" style={{ top: h * hourPx }}>
            {label(h)}
          </span>
        ),
      )}
      {nowMin !== null && (
        <span data-testid={primary ? 'cal-now-pill' : undefined} className="cc-now-pill absolute right-1 z-20 -translate-y-1/2 rounded-full px-1.5 py-px font-mono text-[10px] font-bold tabular-nums" style={{ top: (nowMin / 60) * hourPx }}>
          {nowText}
        </span>
      )}
    </div>
  );
}

interface ColumnProps {
  day: Date;
  items: CalItem[];
  conflicts: ConflictReport;
  hourPx: number;
  h24: boolean;
  nowMin: number | null;
  past: boolean;
  flashKey: string | null;
  onCreate: Props['onCreate'];
  onOpen: Props['onOpen'];
  onToggleTodo: Props['onToggleTodo'];
}

const floorSnap = (min: number) => Math.max(0, Math.min(24 * 60 - SNAP_MIN, Math.floor(min / SNAP_MIN) * SNAP_MIN));

function DayColumn({ day, items, conflicts, hourPx, h24, nowMin, past, flashKey, onCreate, onOpen, onToggleTodo }: ColumnProps) {
  const placed = useMemo(() => layoutColumns(items), [items]);
  const dayStart = startOfDay(day).getTime();
  const [drag, setDrag] = useState<{ anchor: number; cur: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null); // hour under the pointer
  const hot = useMemo(() => findConflicts(items).hotHours, [items]);

  const minAt = (e: ReactPointerEvent<HTMLDivElement>) => ((e.clientY - e.currentTarget.getBoundingClientRect().top) / hourPx) * 60;

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-cal-item]')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = floorSnap(minAt(e));
    setDrag({ anchor: m, cur: m });
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) {
      const h = (e.target as HTMLElement).closest('[data-cal-item]') ? null : Math.min(23, Math.floor(minAt(e) / 60));
      if (h !== hover) setHover(h);
      return;
    }
    setDrag({ ...drag, cur: floorSnap(minAt(e)) });
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const a = Math.min(drag.anchor, drag.cur);
    const b = Math.max(drag.anchor, drag.cur) + SNAP_MIN;
    setDrag(null);
    // A click books an hour; a drag books exactly what was swept.
    const [start, end] = b - a <= SNAP_MIN ? [a, Math.min(24 * 60 - 1, a + 60)] : [a, Math.min(24 * 60 - 1, b)];
    onCreate(dayKey(day), start, end, { x: e.clientX, y: e.clientY });
  };

  const sel = drag ? { a: Math.min(drag.anchor, drag.cur), b: Math.max(drag.anchor, drag.cur) + SNAP_MIN } : null;

  return (
    <div
      role="gridcell"
      aria-label={`${day.toDateString()} — click or drag to schedule`}
      data-day={dayKey(day)}
      className={`cc-col cc-line @container relative cursor-crosshair touch-none border-l select-none ${past ? 'is-past' : ''}`}
      style={{ '--hour': `${hourPx}px` } as CSSProperties}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={() => setHover(null)}
      onPointerCancel={() => setDrag(null)}
    >
      {hover !== null && !drag && (
        <div className="cc-hover-row pointer-events-none absolute inset-x-0" style={{ top: hover * hourPx, height: hourPx }} aria-hidden>
          <span className="cc-hover-hint absolute top-1.5 right-2 hidden rounded-md px-2 py-0.5 text-[10.5px] font-semibold tabular-nums @[260px]:inline">
            + Schedule at {fmtTime(dayStart + hover * 3_600_000, h24)}
          </span>
        </div>
      )}

      {hot.map((h) => (
        <div key={h} className="cc-hot absolute inset-x-0" style={{ top: ((h - dayStart) / 3_600_000) * hourPx, height: hourPx }} title="More than three due dates in this hour" />
      ))}
      {sel && (
        <div data-testid="cal-drag" className="cc-drag pointer-events-none absolute inset-x-1 z-30 rounded-lg px-2 py-1 font-mono text-[10.5px] font-semibold tabular-nums" style={{ top: (sel.a / 60) * hourPx, height: Math.max(((sel.b - sel.a) / 60) * hourPx, 14) }}>
          {fmtRange(dayStart + sel.a * MIN, dayStart + sel.b * MIN, h24)}
          <span className="ml-1 opacity-70">· {fmtDuration((sel.b - sel.a) * MIN)}</span>
        </div>
      )}
      {placed.map(({ item, col, cols }) => {
        const s = Math.max(item.start, dayStart);
        const e = Math.min(item.end, dayStart + DAY);
        const top = ((s - dayStart) / 3_600_000) * hourPx;
        const height = Math.max(((e - s) / 3_600_000) * hourPx - 2, 18);
        return (
          <ItemBlock
            key={item.key}
            item={item}
            h24={h24}
            conflicts={conflicts.byKey.get(item.key) ?? 0}
            flash={flashKey === item.key}
            style={{ top: top + 1, height, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
            compact={height < 46}
            roomy={height >= 64}
            onOpen={onOpen}
            onToggleTodo={onToggleTodo}
          />
        );
      })}
      {nowMin !== null && (
        <div data-testid="cal-now-line" className="cc-laser pointer-events-none absolute inset-x-0 z-20" style={{ top: (nowMin / 60) * hourPx }} aria-hidden>
          <span className="cc-laser-dot" />
        </div>
      )}
    </div>
  );
}
