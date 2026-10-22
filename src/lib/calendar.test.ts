import { describe, expect, it } from 'vitest';
import { FIRST_SECTION, type CalendarEvent, type ProcessingItem, type Todo } from '../types';
import {
  HOUR,
  MIN,
  agenda,
  autoResolve,
  atTime,
  briefing,
  collectItems,
  groupReminders,
  countdown,
  findConflicts,
  focusShieldSlot,
  freeGaps,
  layoutColumns,
  overdueTodos,
  parseDay,
  workload,
  type CalItem,
} from './calendar';
import { calendarAlert, upcomingEvents } from './alertEvents';

const D = '2026-10-19';
const ev = (id: string, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  title: id,
  date: D,
  start,
  end,
  category: 'meeting',
  priority: 'normal',
  attendees: [],
  location: '',
  notes: '',
  remindMins: 10,
  createdAt: 0,
  ...extra,
});
const todo = (id: string, dueTime: string | null, extra: Partial<Todo> = {}): Todo => ({ id, text: id, dueDate: D, dueTime, createdAt: 0, order: 0, archivedAt: null, ...extra });
const proc = (id: string, section: string, extra: Partial<ProcessingItem> = {}): ProcessingItem => ({
  id,
  name: id,
  url: 'https://example.com',
  siteId: null,
  section,
  order: 0,
  schedule: { enabled: false, frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], timeOfDay: '09:00', from: '2026-01', to: '2026-12' },
  ...extra,
});
const dayStart = parseDay(D).getTime();
const range = (src: { events?: CalendarEvent[]; todos?: Todo[]; processing?: ProcessingItem[] }) =>
  collectItems({ events: src.events ?? [], todos: src.todos ?? [], processing: src.processing ?? [] }, dayStart, dayStart + 24 * HOUR);

describe('collectItems', () => {
  it('puts events, dated to-dos and processing / queue due dates on one sorted timeline', () => {
    const items = range({
      events: [ev('board', '10:00', '11:00')],
      todos: [todo('memo', '09:00'), todo('allday', null), todo('done', '08:00', { archivedAt: 1 })],
      processing: [proc('deploy', FIRST_SECTION, { dueDate: D, dueTime: '12:00' }), proc('audit', 'Queue', { dueDate: D, dueTime: null })],
    });
    expect(items.map((i) => `${i.kind}:${i.sourceId}`)).toEqual(['todo:allday', 'queue:audit', 'todo:memo', 'event:board', 'processing:deploy']);
    expect(items.find((i) => i.sourceId === 'allday')!.allDay).toBe(true);
    expect(items.find((i) => i.sourceId === 'memo')!.end - items.find((i) => i.sourceId === 'memo')!.start).toBe(30 * MIN);
  });

  it('expands daily reminder schedules into occurrences but skips minute / hourly rhythms', () => {
    const daily = proc('standup', FIRST_SECTION, { schedule: { ...proc('x', '').schedule, enabled: true, timeOfDay: '09:30' } });
    const hourly = proc('ping', FIRST_SECTION, { schedule: { ...proc('x', '').schedule, enabled: true, frequency: 'hourly' } });
    const week = collectItems({ events: [], todos: [], processing: [daily, hourly] }, dayStart, dayStart + 7 * 24 * HOUR);
    expect(week).toHaveLength(7);
    expect(week.every((i) => i.reminder && i.sourceId === 'standup')).toBe(true);
    expect(new Date(week[0].start).getHours()).toBe(9);
  });
});

describe('layoutColumns', () => {
  it('splits overlapping blocks side by side and keeps others full width', () => {
    const items = range({ events: [ev('a', '09:00', '10:00'), ev('b', '09:30', '10:30'), ev('c', '11:00', '12:00')] });
    const placed = Object.fromEntries(layoutColumns(items).map((p) => [p.item.sourceId, [p.col, p.cols]]));
    expect(placed).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });
});

describe('findConflicts', () => {
  it('flags overlapping events and an event over a due time, but not two due tasks alone', () => {
    const items = range({
      events: [ev('a', '09:00', '10:00'), ev('b', '09:30', '10:30')],
      todos: [todo('t1', '14:00'), todo('t2', '14:00'), todo('t3', '09:45')],
    });
    const r = findConflicts(items);
    expect(r.pairs).toHaveLength(3); // a–b, a–t3, b–t3
    expect(r.byKey.get('todo:t1')).toBeUndefined();
  });

  it('counts an hour with more than three due dates as overloaded', () => {
    const items = range({ todos: ['a', 'b', 'c', 'd'].map((id) => todo(id, '15:15')) });
    const r = findConflicts(items);
    expect(r.hotHours).toEqual([atTime(D, '15:00')]);
    expect(r.count).toBe(1);
    expect(findConflicts(range({ todos: ['a', 'b', 'c'].map((id) => todo(id, '15:15')) })).count).toBe(0);
  });
});

describe('free time and Focus Shield', () => {
  const items = range({ events: [ev('a', '09:00', '10:00'), ev('b', '10:30', '12:00'), ev('c', '13:00', '14:00')] });

  it('lists the gaps between bookings', () => {
    const gaps = freeGaps(items, atTime(D, '08:00'), atTime(D, '15:00')).map(([a, b]) => [new Date(a).getHours(), (b - a) / MIN]);
    expect(gaps).toEqual([
      [8, 60],
      [10, 30],
      [12, 60],
      [14, 60],
    ]);
  });

  it('blocks the first free two hours, starting on a quarter hour', () => {
    const slot = focusShieldSlot(items, atTime(D, '08:07'))!;
    expect(new Date(slot.start).getHours()).toBe(14);
    expect(new Date(slot.start).getMinutes()).toBe(0);
    expect(slot.end - slot.start).toBe(2 * HOUR);
  });

  it('finds nothing when the evening is too short', () => {
    expect(focusShieldSlot([], atTime(D, '22:00'))).toBeNull();
  });
});

describe('briefing and workload', () => {
  it('summarises meetings, tasks, focus time and overload risk', () => {
    const items = range({
      events: [ev('a', '09:00', '12:00'), ev('b', '11:00', '13:00', { category: 'call' }), ev('c', '14:00', '18:00'), ev('focus', '18:00', '20:00', { category: 'deep-work' })],
      todos: [todo('t', '10:00')],
    });
    const b = briefing(items, parseDay(D), atTime(D, '07:00'));
    expect(b.meetings).toBe(3);
    expect(b.tasksDue).toBe(1);
    expect(b.conflicts).toBeGreaterThan(0);
    expect(b.focusHours).toBe(4); // 08–09 + 13–14 free, plus the 2h deep-work block
    expect(b.risk).toBe('High');
    expect(briefing([], parseDay(D), atTime(D, '07:00')).risk).toBe('Low');
  });

  it('grades a day for the month heatmap', () => {
    expect(workload([]).level).toBe(0);
    expect(workload(range({ events: [ev('a', '09:00', '10:00')] })).level).toBe(1);
    const busy = range({ events: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => ev(id, `${String(8 + i).padStart(2, '0')}:00`, `${String(8 + i).padStart(2, '0')}:30`)) });
    expect(workload(busy).level).toBe(3);
  });
});

describe('agenda', () => {
  it('groups by the next two hours, later today and upcoming deadlines', () => {
    const items: CalItem[] = collectItems(
      { events: [ev('now', '10:00', '11:00'), ev('soon', '11:30', '12:00'), ev('late', '17:00', '18:00')], todos: [todo('tmrw', '09:00', { dueDate: '2026-10-20' })], processing: [] },
      dayStart,
      dayStart + 3 * 24 * HOUR,
    );
    const g = agenda(items, atTime(D, '10:15'));
    expect(g.next.map((i) => i.sourceId)).toEqual(['now', 'soon']);
    expect(g.later.map((i) => i.sourceId)).toEqual(['late']);
    expect(g.deadlines.map((i) => i.sourceId)).toEqual(['tmrw']);
  });

  it('lists a passed due time once, as overdue', () => {
    const late = todo('late', '10:00');
    const now = atTime(D, '10:10');
    const items = collectItems({ events: [], todos: [late], processing: [] }, dayStart, dayStart + 24 * HOUR);
    const g = agenda(items, now, overdueTodos([late], now));
    expect(g.next).toHaveLength(0);
    expect(g.deadlines.map((i) => i.sourceId)).toEqual(['late']);
  });

});

describe('calendar alerts', () => {
  it('counts down to the start, then shows Now', () => {
    const s = atTime(D, '10:00');
    expect(countdown(s, s + HOUR, s - 5 * MIN)).toBe('Starts in 5m');
    expect(countdown(s, s + HOUR, s - 80 * MIN)).toBe('Starts in 1h 20m');
    expect(countdown(s, s + HOUR, s + MIN)).toBe('Now');
    expect(countdown(s, s + HOUR, s + 2 * HOUR)).toBe('Ended');
  });

  it('schedules a capsule alert at the reminder lead time, and none without one', () => {
    const e = ev('board', '10:00', '11:00', { remindMins: 15, priority: 'critical', attendees: ['A', 'B'], location: 'Room 1' });
    const quiet = ev('quiet', '12:00', '13:00', { remindMins: null });
    const out = upcomingEvents([], [], atTime(D, '08:00'), [e, quiet]);
    expect(out).toHaveLength(1);
    expect(out[0].at).toBe(atTime(D, '09:45'));
    expect(out[0].data.kind).toBe('calendar');
    expect(calendarAlert(e).eyebrow).toBe('MEETING · CRITICAL');
    expect(calendarAlert(e).sub).toBe('10:00–11:00 · Room 1 · 2 attendees');
  });

  it('alerts a processing / queue due time with their existing designs', () => {
    const out = upcomingEvents([proc('ship', FIRST_SECTION, { dueDate: D, dueTime: '16:00' }), proc('later', 'Queue', { dueDate: D, dueTime: '17:00' })], [], atTime(D, '08:00'));
    expect(out.map((e) => [e.data.kind, e.data.eyebrow])).toEqual([
      ['processing', 'CURRENTLY PROCESSING · DUE'],
      ['queue', 'QUEUE · DUE'],
    ]);
  });
});

describe('autoResolve', () => {
  it('moves colliding due dates to the next free slot and leaves meetings alone', () => {
    const items = range({
      events: [ev('a', '09:00', '10:00'), ev('b', '10:30', '11:00')],
      todos: [todo('t1', '09:30'), todo('t2', '14:00')],
    });
    const moves = autoResolve(items, atTime(D, '08:00'));
    expect(moves.map((m) => [m.item.sourceId, new Date(m.start).getHours(), new Date(m.start).getMinutes()])).toEqual([['t1', 10, 0]]);
    const fixed = items.map((i) => (i.sourceId === 't1' ? { ...i, start: moves[0].start, end: moves[0].start + 30 * MIN } : i));
    expect(findConflicts(fixed).count).toBe(0);
  });

  it('spreads an overloaded hour', () => {
    const items = range({ todos: ['a', 'b', 'c', 'd'].map((id) => todo(id, '15:00')) });
    const starts = autoResolve(items, atTime(D, '08:00')).map((m) => m.start);
    expect(new Set(starts).size).toBe(starts.length);
  });
});

describe('groupReminders', () => {
  const r = (id: string, start: number, kind: 'processing' | 'queue' = 'queue'): CalItem => ({ key: `${kind}:${id}:${start}`, kind, sourceId: id, title: id, start, end: start + 900_000, allDay: false, reminder: true });
  it('merges reminders that fire together, keeps lone ones and everything else', () => {
    const due: CalItem = { key: 'todo:t', kind: 'todo', sourceId: 't', title: 'Ship', start: 1000, end: 2000, allDay: false, reminder: false };
    const out = groupReminders([r('a', 1000), r('b', 1000, 'processing'), r('c', 1000, 'processing'), r('d', 5000), due]);
    expect(out).toHaveLength(3);
    const g = out.find((i) => i.members)!;
    expect(g.members!.map((m) => m.sourceId)).toEqual(['a', 'b', 'c']);
    expect(g.title).toBe('3 reminders · a, b, c');
    expect(g.kind).toBe('processing'); // the larger share
    expect(out.find((i) => i.sourceId === 'd')!.members).toBeUndefined();
    expect(out).toContainEqual(due);
  });
});
