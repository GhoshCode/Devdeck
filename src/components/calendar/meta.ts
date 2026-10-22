import type { CalItem, CalKind } from '../../lib/calendar';
import { CATEGORY_COLOR, EVENT_CATEGORIES } from '../../lib/calendar';

export const KINDS: readonly CalKind[] = ['event', 'todo', 'processing', 'queue'];

export const KIND_LABEL: Record<CalKind, string> = {
  event: 'Events',
  todo: 'To-do',
  processing: 'Processing',
  queue: 'Queue',
};

export const itemColor = (i: Pick<CalItem, 'kind' | 'category'>) =>
  i.kind === 'event' ? CATEGORY_COLOR[i.category ?? 'meeting'] : i.kind === 'todo' ? '#38bdf8' : i.kind === 'processing' ? '#10b981' : '#f59e0b';

export const categoryLabel = (i: Pick<CalItem, 'category'>) => EVENT_CATEGORIES.find((c) => c.id === i.category)?.label ?? 'Event';

// The second time rail's choices (plus any zones already on the Multi-Timezone clock).
export const SECOND_ZONES: readonly string[] = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const shortFmt = new Map<string, Intl.DateTimeFormat>();
const hourFmt = new Map<string, Intl.DateTimeFormat>();

// "EST", "GMT+5:30", "UTC" — the zone's short name at that moment.
export function zoneAbbr(tz: string, at: number): string {
  try {
    let f = shortFmt.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' });
      shortFmt.set(tz, f);
    }
    return f.formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz;
  }
}

// Wall-clock time in a zone, "HH:mm" (or "9a" style for 12-hour rails).
export function zoneClock(tz: string, at: number, h24: boolean): string {
  try {
    let f = hourFmt.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });
      hourFmt.set(tz, f);
    }
    const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
    const h = Number(p.hour);
    const m = p.minute ?? '00';
    if (h24) return `${String(h).padStart(2, '0')}:${m}`;
    return `${h % 12 || 12}${m === '00' ? '' : `:${m}`}${h < 12 ? 'a' : 'p'}`;
  } catch {
    return '';
  }
}

export const hourLabel = (h: number, h24: boolean) => (h24 ? `${String(h).padStart(2, '0')}:00` : `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`);

export type Point = { x: number; y: number };

// The small uppercase badge on every calendar card.
export function badgeOf(i: Pick<CalItem, 'kind' | 'category' | 'reminder'>): string {
  if (i.kind === 'event') return categoryLabel(i).toUpperCase();
  if (i.reminder) return i.kind === 'processing' ? 'PROCESSING · REMINDER' : 'QUEUE · REMINDER';
  return i.kind === 'todo' ? 'TO-DO DUE' : i.kind === 'processing' ? 'PROCESSING' : 'QUEUE';
}
