import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addDays, dayKey, findConflicts, onDay, startOfMonth, startOfWeek, workload, type CalItem, type ConflictReport } from '../../lib/calendar';
import { ConflictBadge, ItemChip } from './ItemBlock';
import type { Point } from './meta';

interface Props {
  cursor: Date;
  items: CalItem[];
  conflicts: ConflictReport;
  now: number;
  h24: boolean;
  flashKey: string | null;
  onCreate: (date: string, startMin: number, endMin: number, at: Point) => void;
  onOpen: (item: CalItem, at: Point) => void;
  onToggleTodo: (id: string) => void;
  onPickDay: (d: Date) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CHIP_H = 29; // one chip row, gap included
const HEAD_H = 46; // day number row, padding and the “+ more” line
const LOAD_LABEL = ['Free', 'Optimal', 'Busy', 'Overloaded'];

// Month capacity heatmap: each day is a card whose top edge glows green /
// amber / crimson as meetings, due dates, deadlines and conflicts pile up.
export const MonthView = memo(function MonthView({ cursor, items, conflicts, now, h24, flashKey, onCreate, onOpen, onToggleTodo, onPickDay }: Props) {
  const firstMs = startOfWeek(startOfMonth(cursor)).getTime();
  const month = cursor.getMonth();
  const todayKey = dayKey(now);
  const gridRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(3);
  // As many chips as a cell has room for; the rest go behind “+ N more”.
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setFit(Math.max(1, Math.floor((el.clientHeight / 6 - HEAD_H) / CHIP_H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cells = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const d = addDays(new Date(firstMs), i);
        const list = onDay(items, d);
        return { d, list, load: workload(list), conflicts: findConflicts(list).count };
      }),
    [items, firstMs],
  );

  const create = (d: Date, at: Point) => {
    const isToday = dayKey(d) === todayKey;
    const start = isToday ? Math.min(22 * 60, (new Date(now).getHours() + 1) * 60) : 9 * 60;
    onCreate(dayKey(d), start, start + 60, at);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3" data-testid="cal-month">
      <div className="cc-fg3 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px]">
        <span>Workload capacity — the top edge of each day shows how much collides on it</span>
        <span className="flex items-center gap-3">
          <Legend level={1} label="Optimal (1–3)" />
          <Legend level={2} label="Busy (4–6)" />
          <Legend level={3} label="Overloaded (7+)" />
        </span>
      </div>
      <div className="grid shrink-0 grid-cols-7 gap-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cc-fg3 px-2 text-[10.5px] font-bold tracking-[0.14em] uppercase">
            {w}
          </div>
        ))}
      </div>
      <div ref={gridRef} className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-2" role="grid" aria-label={cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}>
        {cells.map(({ d, list, load, conflicts: n }) => {
          const key = dayKey(d);
          const isToday = key === todayKey;
          const out = d.getMonth() !== month;
          const shown = list.length > fit + 1 ? list.slice(0, fit) : list.slice(0, fit + 1);
          const more = list.length - shown.length;
          return (
            <div
              key={key}
              role="gridcell"
              data-day={key}
              data-load={load.level}
              aria-label={`${d.toDateString()}: ${list.length} item${list.length === 1 ? '' : 's'}, ${LOAD_LABEL[load.level]}`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-cal-item], button')) return;
                create(d, { x: e.clientX, y: e.clientY });
              }}
              className={`cc-mcell relative flex min-h-0 min-w-0 cursor-pointer flex-col gap-1 overflow-hidden rounded-xl border p-2 ${out ? 'is-out' : ''} ${isToday ? 'is-today' : ''}`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onPickDay(d)}
                  title="Open this day"
                  className={`cc-daynum flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-bold tabular-nums ${isToday ? 'is-today' : ''}`}
                >
                  {d.getDate()}
                </button>
                {n > 0 && <ConflictBadge n={n} />}
                {load.score > 0 && (
                  <span className="cc-capacity ml-auto truncate font-mono text-[9.5px] tabular-nums" title={`${load.score} meetings, due dates, deadlines and conflicts`}>
                    {LOAD_LABEL[load.level]} ({load.score})
                  </span>
                )}
              </div>
              {shown.map((it) => (
                <ItemChip key={it.key} item={it} h24={h24} conflicts={conflicts.byKey.get(it.key) ?? 0} flash={flashKey === it.key} onOpen={onOpen} onToggleTodo={onToggleTodo} />
              ))}
              {more > 0 && (
                <button type="button" onClick={() => onPickDay(d)} className="cc-more self-start rounded px-1.5 text-[10.5px] font-semibold">
                  + {more} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function Legend({ level, label }: { level: 1 | 2 | 3; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="cc-legend size-2.5 rounded-sm" data-load={level} />
      {label}
    </span>
  );
}
