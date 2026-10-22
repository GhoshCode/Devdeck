// Reminder plumbing for Currently Processing: the page mirrors items into
// chrome.storage.local; the service worker (src/background.ts) owns
// chrome.alarms and shows each reminder as a DevDeck pop-up.

import { useEffect } from 'react';
import type { ProcessingItem } from '../types';
import { isExtension } from './env';
import { REMINDERS_STORAGE_KEY, toReminderItems } from './reminders-shared';

interface ChromeStorageLike {
  storage?: { local?: { set: (v: Record<string, unknown>) => Promise<void> | void } };
}

// Extension only: keep the service worker's copy of the schedule current.
export function useReminderMirror(items: readonly ProcessingItem[]): void {
  useEffect(() => {
    if (!isExtension()) return;
    const chrome = (globalThis as { chrome?: ChromeStorageLike }).chrome;
    void chrome?.storage?.local?.set({ [REMINDERS_STORAGE_KEY]: toReminderItems(items) });
  }, [items]);
}
