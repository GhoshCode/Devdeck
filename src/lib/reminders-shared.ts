// React-free reminder helpers shared by the page and the extension service
// worker (src/background.ts must not pull React into its bundle).

import type { ProcessingItem } from '../types';
import { nextFireTime } from './schedule';

export const REMINDERS_STORAGE_KEY = 'devdeck:reminders';

export type ReminderItem = Pick<ProcessingItem, 'id' | 'name' | 'url' | 'schedule'> & { section?: string };

export const toReminderItems = (items: readonly ProcessingItem[]): ReminderItem[] =>
  items.map(({ id, name, url, schedule, section }) => ({ id, name, url, schedule, section }));

// The soonest fire time across all items, and which items fire then.
export function nextDue(items: readonly ReminderItem[], now: Date): { at: number; items: ReminderItem[] } | null {
  let at = Infinity;
  let due: ReminderItem[] = [];
  for (const item of items) {
    const t = nextFireTime(item.schedule, now)?.getTime();
    if (t === undefined) continue;
    if (t < at) {
      at = t;
      due = [item];
    } else if (t === at) {
      due.push(item);
    }
  }
  return due.length ? { at, items: due } : null;
}
