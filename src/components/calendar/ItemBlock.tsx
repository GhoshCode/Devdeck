import { memo, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { fmtRange, fmtTime, type CalItem } from '../../lib/calendar';
import { KIND_LABEL, badgeOf, itemColor, type Point } from './meta';

// Four kinds that read apart at a glance (prototype styling):
//   Queue       — slate card, dashed amber border, amber accent bar
//   To-do       — sky gradient, a completion checkbox right on the card
//   Processing  — emerald gradient with a live pulse dot
//   Event       — violet/obsidian gradient, category-coloured accent bar,
//                 time range, attendees / tags and a priority badge

interface Common {
  item: CalItem;
  h24: boolean;
  conflicts: number;
  flash: boolean;
  onOpen: (item: CalItem, at: Point) => void;
  onToggleTodo: (id: string) => void;
}

const pointOf = (e: MouseEvent | KeyboardEvent) => {
  if ('clientX' in e && e.clientX) return { x: e.clientX, y: e.clientY };
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: r.right, y: r.top + 12 };
};

const activate = (fn: (at: Point) => void) => ({
  onClick: (e: MouseEvent) => {
    e.stopPropagation();
    fn(pointOf(e));
  },
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    fn(pointOf(e));
  },
});

const timeOf = (item: CalItem, h24: boolean) => (item.allDay ? 'All day' : item.reminder ? fmtTime(item.start, h24) : fmtRange(item.start, item.end, h24));

export function ItemBlock({ item, h24, conflicts, flash, style, compact, roomy, onOpen, onToggleTodo }: Common & { style: CSSProperties; compact: boolean; roomy: boolean }) {
  const time = timeOf(item, h24);
  const tags = item.attendees?.filter((a) => a.startsWith('#')) ?? [];
  const people = item.attendees?.filter((a) => !a.startsWith('#')) ?? [];
  const detail = item.kind === 'event' ? [people.join(', '), item.location].filter(Boolean).join(' · ') : item.notes;
  return (
    <div
      data-cal-item
      data-kind={item.kind}
      data-key={item.key}
      role="button"
      tabIndex={0}
      aria-label={`${KIND_LABEL[item.kind]}: ${item.title}, ${time}${conflicts ? `, ${conflicts} conflict${conflicts === 1 ? '' : 's'}` : ''}`}
      {...activate((at) => onOpen(item, at))}
      onPointerDown={(e) => e.stopPropagation()}
      className={`cc-item @container absolute z-10 overflow-hidden rounded-xl ${flash ? 'is-flash' : ''} ${conflicts ? 'is-conflict' : ''}`}
      style={{ ...style, '--k': itemColor(item) } as CSSProperties}
    >
      <span className="cc-accent absolute inset-y-0 left-0 w-1" aria-hidden />
      <div className={`flex h-full min-w-0 flex-col pl-2.5 ${compact ? 'justify-center pr-1.5' : 'gap-0.5 py-1.5 pr-2 @max-[110px]:pl-2'}`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <Lead item={item} onToggleTodo={onToggleTodo} />
          {compact ? (
            <>
              <span className="cc-badge hidden shrink-0 rounded px-1.5 py-px font-mono text-[9px] font-bold tracking-wider @[320px]:inline">{badgeOf(item)}</span>
              <p className="cc-item-title min-w-0 flex-1 truncate text-[12px] leading-tight font-semibold">
                {item.title} <span className="cc-item-time ml-1 font-mono text-[10.5px] font-medium tabular-nums">{time}</span>
              </p>
            </>
          ) : (
            <>
              <span className="cc-badge hidden shrink-0 rounded px-1.5 py-px font-mono text-[9px] font-bold tracking-wider @[200px]:inline">{badgeOf(item)}</span>
              <span className="cc-item-time min-w-0 truncate font-mono text-[10.5px] tabular-nums">{time}</span>
            </>
          )}
          <span className="ml-auto hidden shrink-0 items-center gap-1 @[150px]:flex">
            {conflicts > 0 && <ConflictBadge n={conflicts} wide />}
            {item.kind === 'event' && (item.priority === 'high' || item.priority === 'critical') && <PriorityBadge p={item.priority} />}
          </span>
        </div>
        {!compact && (
          <p className={`cc-item-title text-[12.5px] leading-snug font-semibold ${roomy ? 'line-clamp-2' : 'truncate'}`}>{item.title}</p>
        )}
        {roomy && (detail || tags.length > 0) && (
          <p className="cc-item-meta flex min-w-0 items-center gap-1 truncate text-[11px]">
            {item.kind === 'event' && people.length > 0 && <PeopleIcon />}
            {tags.map((t) => (
              <span key={t} className="cc-tag shrink-0 rounded px-1 font-mono text-[9.5px]">
                {t}
              </span>
            ))}
            <span className="truncate">{detail}</span>
          </p>
        )}
      </div>
      {conflicts > 0 && <span className="cc-conflict-dot absolute top-1 right-1 size-1.5 rounded-full @[150px]:hidden" aria-hidden />}
    </div>
  );
}

// One-line chip: all-day row and month cells.
export const ItemChip = memo(function ItemChip({ item, h24, conflicts, flash, onOpen, onToggleTodo }: Common) {
  return (
    <div
      data-cal-item
      data-kind={item.kind}
      data-key={item.key}
      role="button"
      tabIndex={0}
      aria-label={`${KIND_LABEL[item.kind]}: ${item.title}`}
      {...activate((at) => onOpen(item, at))}
      onPointerDown={(e) => e.stopPropagation()}
      className={`cc-chip relative flex min-w-0 shrink-0 items-center gap-1.5 overflow-hidden rounded-md py-[3px] pr-1.5 pl-2.5 text-left ${flash ? 'is-flash' : ''} ${conflicts ? 'is-conflict' : ''}`}
      style={{ '--k': itemColor(item) } as CSSProperties}
    >
      <span className="cc-accent absolute inset-y-0 left-0 w-[3px]" aria-hidden />
      <Lead item={item} onToggleTodo={onToggleTodo} small />
      {!item.allDay && <span className="cc-item-time shrink-0 font-mono text-[10px] tabular-nums">{fmtTime(item.start, h24)}</span>}
      <span className="cc-item-title min-w-0 flex-1 truncate text-[11px] font-semibold">{item.title}</span>
      {conflicts > 0 && <ConflictBadge n={conflicts} />}
    </div>
  );
});

// A roomy card for the agenda stream.
export function ItemCard({ item, h24, conflicts, flash, onOpen, onToggleTodo, when }: Common & { when: string }) {
  return (
    <div
      data-cal-item
      data-kind={item.kind}
      data-key={item.key}
      role="button"
      tabIndex={0}
      aria-label={`${KIND_LABEL[item.kind]}: ${item.title}`}
      {...activate((at) => onOpen(item, at))}
      className={`cc-item relative shrink-0 overflow-hidden rounded-xl py-2.5 pr-3 pl-4 ${flash ? 'is-flash' : ''} ${conflicts ? 'is-conflict' : ''}`}
      style={{ '--k': itemColor(item) } as CSSProperties}
    >
      <span className="cc-accent absolute inset-y-0 left-0 w-1" aria-hidden />
      <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums">
        <span className="cc-item-time truncate">
          {when} · {timeOf(item, h24)}
        </span>
        <span className="cc-badge ml-auto shrink-0 rounded px-1.5 py-px text-[9px] font-bold tracking-wider">{badgeOf(item)}</span>
      </div>
      <div className="mt-1 flex min-w-0 items-start gap-2">
        <Lead item={item} onToggleTodo={onToggleTodo} />
        <p className="cc-item-title min-w-0 flex-1 text-[12.5px] leading-snug font-semibold">{item.title}</p>
        {conflicts > 0 && <ConflictBadge n={conflicts} wide />}
        {item.kind === 'event' && (item.priority === 'high' || item.priority === 'critical') && <PriorityBadge p={item.priority} />}
      </div>
      {(item.location || item.notes) && <p className="cc-item-meta mt-1 line-clamp-2 text-[11px]">{[item.location, item.notes].filter(Boolean).join(' · ')}</p>}
    </div>
  );
}

function Lead({ item, onToggleTodo, small = false }: { item: CalItem; onToggleTodo: (id: string) => void; small?: boolean }) {
  if (item.kind === 'todo')
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={false}
        aria-label={`Mark “${item.title}” done`}
        title="Mark done"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleTodo(item.sourceId);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={`cc-check flex shrink-0 items-center justify-center rounded-full border-[1.5px] ${small ? 'size-3' : 'size-3.5'}`}
      >
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m2.5 6.2 2.2 2.2 4.8-4.8" />
        </svg>
      </button>
    );
  if (item.kind === 'processing')
    return (
      <span className="relative flex size-2 shrink-0 items-center justify-center" aria-hidden>
        <span className="cc-pulse absolute inset-0 animate-ping rounded-full" />
        <span className="cc-pulse relative size-2 animate-pulse rounded-full" />
      </span>
    );
  if (item.kind === 'queue') return <span className={`cc-queue-dot shrink-0 rounded-full border-[1.5px] border-dashed ${small ? 'size-2.5' : 'size-2.5'}`} aria-hidden />;
  return null;
}

export function ConflictBadge({ n, wide = false }: { n: number; wide?: boolean }) {
  return (
    <span className="cc-conflict flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px font-mono text-[9.5px] font-bold tabular-nums" title={`${n} conflict${n === 1 ? '' : 's'}`}>
      <BoltIcon className="size-2.5" />
      {wide ? `Conflict${n > 1 ? ` ×${n}` : ''}` : n}
    </span>
  );
}

function PriorityBadge({ p }: { p: 'high' | 'critical' }) {
  return <span className={`cc-prio shrink-0 rounded-full px-1.5 py-px font-mono text-[9px] font-bold tracking-wider ${p === 'critical' ? 'is-crit' : ''}`}>{p === 'critical' ? 'CRITICAL' : 'HIGH'}</span>;
}

export function BoltIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.7 3.1 2.4 3.5 5.2" />
    </svg>
  );
}
