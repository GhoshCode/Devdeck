import { memo, type CSSProperties } from 'react';
import { agenda, dayKey, type CalItem, type ConflictReport } from '../../lib/calendar';
import { ItemCard } from './ItemBlock';
import type { Point } from './meta';

interface Props {
  items: CalItem[]; // today … two weeks ahead
  overdue: CalItem[];
  conflicts: ConflictReport;
  now: number;
  h24: boolean;
  flashKey: string | null;
  onOpen: (item: CalItem, at: Point) => void;
  onToggleTodo: (id: string) => void;
  onAdd: (at: Point) => void;
}

// Agenda / command stream: a three-column executive briefing.
export const AgendaView = memo(function AgendaView({ items, overdue, conflicts, now, h24, flashKey, onOpen, onToggleTodo, onAdd }: Props) {
  const g = agenda(items, now, overdue);
  const columns = [
    { id: 'next', title: 'Immediate next', hint: 'Running now or within 2 hours', list: g.next, tone: 'var(--color-accent)', empty: 'Clear runway for the next two hours.' },
    { id: 'later', title: 'Later today', hint: 'Everything else booked today', list: g.later, tone: '#10b981', empty: 'Nothing else booked today.' },
    { id: 'deadlines', title: 'Upcoming deadlines', hint: 'Overdue first, then the next 14 days', list: g.deadlines, tone: '#38bdf8', empty: 'No deadlines in the next two weeks.' },
  ];
  const whenOf = (it: CalItem) => {
    if (dayKey(it.start) === dayKey(now)) return it.allDay || it.end > now || it.kind === 'event' ? 'Today' : 'Overdue';
    if (it.start < now) return 'Overdue';
    return new Date(it.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  };
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-3 lg:overflow-hidden" data-testid="cal-agenda">
      {columns.map((c) => (
        <section key={c.id} aria-labelledby={`agenda-${c.id}`} className="cc-lane flex min-h-0 flex-col rounded-2xl border p-3" style={{ '--lane': c.tone } as CSSProperties}>
          <header className="cc-line mb-3 flex items-center justify-between gap-2 border-b pb-2.5">
            <div className="min-w-0">
              <h3 id={`agenda-${c.id}`} className="cc-fg text-[12px] font-bold tracking-[0.12em] uppercase">
                {c.title}
              </h3>
              <p className="cc-fg3 truncate text-[11px]">{c.hint}</p>
            </div>
            <span className="cc-count rounded-full px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums">{c.list.length}</span>
          </header>
          <div className="cc-scroll -mr-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {c.list.length === 0 ? (
              <p className="cc-empty rounded-xl border border-dashed px-4 py-8 text-center text-[12px]">{c.empty}</p>
            ) : (
              c.list.map((it) => (
                <ItemCard key={`${c.id}:${it.key}`} item={it} h24={h24} when={whenOf(it)} conflicts={conflicts.byKey.get(it.key) ?? 0} flash={flashKey === it.key} onOpen={onOpen} onToggleTodo={onToggleTodo} />
              ))
            )}
          </div>
          <button type="button" onClick={(e) => onAdd({ x: e.clientX, y: e.clientY })} className="cc-btn mt-3 w-full justify-center">
            + Add to {c.title.toLowerCase()}
          </button>
        </section>
      ))}
    </div>
  );
});
