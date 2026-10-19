import { beforeEach, describe, expect, test } from 'vitest';
import type { ProcessingItem, Todo } from '../types';
import { FIRST_SECTION } from '../types';
import { defaultSchedule } from '../store';
import { overdueSummary, upcomingEvents } from './useInPageAlerts';
import { _resetAlerts, getAlerts, pushAlert, snoozeAlert, takeDueSnoozes } from '../components/ui/alertStore';

const NOW = new Date(2026, 9, 20, 10, 0, 0).getTime();
const todo = (over: Partial<Todo>): Todo => ({ id: 't', text: 'Task', dueDate: null, dueTime: null, createdAt: NOW - 1000, order: 0, archivedAt: null, ...over });
const item = (over: Partial<ProcessingItem>): ProcessingItem => ({
  id: 'p', name: 'GitHub', url: 'https://github.com', siteId: null, section: FIRST_SECTION, order: 0, schedule: { ...defaultSchedule(), enabled: false }, ...over,
});

describe('alert events', () => {
  test('a to-do with a due time today becomes a todo alert at that time', () => {
    const [e] = upcomingEvents([], [todo({ dueDate: '2026-10-20', dueTime: '18:30', priority: 1 })], NOW);
    expect(e.data.kind).toBe('todo');
    expect(e.data.eyebrow).toContain('P1');
    expect(new Date(e.at).getHours()).toBe(18);
  });
  test('date-only to-dos and archived ones make no timed alert', () => {
    expect(upcomingEvents([], [todo({ dueDate: '2026-10-20' }), todo({ id: 'x', dueDate: '2026-10-20', dueTime: '11:00', archivedAt: NOW })], NOW)).toHaveLength(0);
  });
  test('timers end into alerts, styled by section', () => {
    const evs = upcomingEvents(
      [item({ timer: { amount: 2, unit: 'hours', start: NOW } }), item({ id: 'q', section: 'Queue', timer: { amount: 1, unit: 'hours', start: NOW } })],
      [todo({ timer: { amount: 30, unit: 'minutes', start: NOW } })],
      NOW,
    );
    expect(evs.map((e) => e.data.kind)).toEqual(['todo', 'queue', 'processing']);
  });
  test('scheduled reminders: Currently processing vs Queue', () => {
    const sched = { ...defaultSchedule(), enabled: true, frequency: 'daily' as const, timeOfDay: '11:00', from: '2026-01', to: '2026-12' };
    const evs = upcomingEvents([item({ schedule: sched }), item({ id: 'q', section: 'Queue', schedule: sched })], [], NOW);
    expect(evs.map((e) => e.data.kind).sort()).toEqual(['processing', 'queue']);
    expect(evs.every((e) => e.reminder)).toBe(true);
  });
  test('overdue summary counts each source', () => {
    const s = overdueSummary(
      [item({ timer: { amount: 1, unit: 'minutes', start: NOW - 3600_000 } }), item({ id: 'q', section: 'Queue', timer: { amount: 1, unit: 'minutes', start: NOW - 3600_000 } })],
      [todo({ dueDate: '2026-10-19' }), todo({ id: 'u', dueDate: '2026-10-25' })],
      NOW,
    );
    expect(s?.counts).toEqual({ todos: 1, queue: 1, processing: 1 });
    expect(overdueSummary([], [todo({ dueDate: '2026-10-25' })], NOW)).toBeNull();
  });
});

describe('alert store', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetAlerts();
  });
  test('the same key shows once, even after dismissing', () => {
    const a = { key: 'k1', kind: 'todo' as const, title: 'x' };
    expect(pushAlert(a)).toBe(true);
    expect(pushAlert(a)).toBe(false);
    _resetAlerts();
    expect(pushAlert(a)).toBe(false);
    expect(pushAlert(a, true)).toBe(true);
  });
  test('snooze hides it and brings it back after 10 minutes', () => {
    const a = { key: 'k2', kind: 'queue' as const, title: 'y' };
    pushAlert(a);
    snoozeAlert(a);
    expect(getAlerts()).toHaveLength(0);
    expect(takeDueSnoozes(Date.now()).due).toHaveLength(0);
    const later = takeDueSnoozes(Date.now() + 10 * 60_000 + 1);
    expect(later.due.map((d) => d.key)).toEqual(['k2']);
    expect(takeDueSnoozes(Date.now() + 20 * 60_000).due).toHaveLength(0); // taken once
  });
});
