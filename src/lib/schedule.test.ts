import { describe, expect, test } from 'vitest';
import type { Schedule } from '../types';
import { describeDays, describeSchedule, isActiveDay, nextFireTime } from './schedule';

const base: Schedule = {
  enabled: true,
  frequency: 'daily',
  daysOfWeek: [1, 2, 3, 4, 5],
  timeOfDay: '09:30',
  from: '2026-10',
  to: '2026-12',
};
// Thu 15 Oct 2026
const at = (d: number, h: number, m = 0, month = 9, y = 2026) => new Date(y, month, d, h, m);

describe('isActiveDay', () => {
  test('weekday inside the span', () => {
    expect(isActiveDay(base, at(15, 12))).toBe(true);
    expect(isActiveDay(base, at(17, 12))).toBe(false); // Saturday
    expect(isActiveDay(base, at(15, 12, 0, 8))).toBe(false); // September — before span
    expect(isActiveDay(base, new Date(2027, 0, 4))).toBe(false); // after span
    expect(isActiveDay({ ...base, enabled: false }, at(15, 12))).toBe(false);
  });
});

describe('nextFireTime', () => {
  test('daily: later today if the time has not passed, else the next active day', () => {
    expect(nextFireTime(base, at(15, 8))).toEqual(at(15, 9, 30));
    expect(nextFireTime(base, at(15, 10))).toEqual(at(16, 9, 30)); // Fri
    expect(nextFireTime(base, at(16, 10))).toEqual(at(19, 9, 30)); // skips the weekend
  });

  test('hourly fires on the hour and skips inactive days', () => {
    const hourly = { ...base, frequency: 'hourly' as const };
    expect(nextFireTime(hourly, at(15, 10, 20))).toEqual(at(15, 11));
    expect(nextFireTime(hourly, at(15, 11))).toEqual(at(15, 12)); // strictly after
    expect(nextFireTime(hourly, at(16, 23, 30))).toEqual(at(19, 0)); // Fri night → Mon 00:00
  });

  test('minute fires on the next minute', () => {
    const minute = { ...base, frequency: 'minute' as const };
    expect(nextFireTime(minute, new Date(2026, 9, 15, 10, 20, 15))).toEqual(at(15, 10, 21));
  });

  test('waits for the span to start and stops after it ends', () => {
    expect(nextFireTime(base, at(1, 8, 0, 8))).toEqual(at(1, 9, 30)); // Thu 1 Oct
    expect(nextFireTime(base, new Date(2026, 11, 31, 12))).toBeNull();
  });

  test('disabled or no days never fires', () => {
    expect(nextFireTime({ ...base, enabled: false }, at(15, 8))).toBeNull();
    expect(nextFireTime({ ...base, daysOfWeek: [] }, at(15, 8))).toBeNull();
  });
});

test('describeSchedule / describeDays', () => {
  expect(describeSchedule(base)).toBe('Daily at 09:30 · Mon–Fri · Oct–Dec 2026');
  expect(describeSchedule({ ...base, frequency: 'hourly', from: '2026-11', to: '2027-02' })).toBe(
    'Every hour · Mon–Fri · Nov 2026–Feb 2027',
  );
  expect(describeSchedule({ ...base, enabled: false })).toBe('Reminders off');
  expect(describeDays([0, 6])).toBe('Weekends');
  expect(describeDays([1, 3, 5])).toBe('Mon, Wed, Fri');
  expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
});

describe('weekly and monthly reminders', () => {
  const sun = new Date(2026, 9, 18, 19, 33); // Sun 18 Oct 2026
  test('weekly fires on the chosen weekdays, every N weeks from the span start', () => {
    const s: Schedule = { ...base, frequency: 'weekly', daysOfWeek: [2], timeOfDay: '10:00', interval: 1 };
    expect(nextFireTime(s, sun)).toEqual(new Date(2026, 9, 20, 10, 0)); // Tue
    // every 2 weeks, anchored to the week of 1 Oct: weeks 0, 2, 4… → 13 Oct, 27 Oct
    const two = { ...s, interval: 2 };
    expect(nextFireTime(two, sun)).toEqual(new Date(2026, 9, 27, 10, 0));
    expect(describeSchedule(two)).toBe('Every 2 weeks at 10:00 · Tue · Oct–Dec 2026');
  });
  test('monthly fires on a day of the month, clamps short months, supports the last day', () => {
    const s: Schedule = { ...base, frequency: 'monthly', dayOfMonth: 31, timeOfDay: '09:00', interval: 1 };
    expect(nextFireTime(s, sun)).toEqual(new Date(2026, 9, 31, 9, 0));
    expect(nextFireTime(s, new Date(2026, 9, 31, 10, 0))).toEqual(new Date(2026, 10, 30, 9, 0)); // Nov has 30 days
    expect(nextFireTime({ ...s, dayOfMonth: -1 }, new Date(2026, 10, 1))).toEqual(new Date(2026, 10, 30, 9, 0));
    expect(nextFireTime({ ...s, dayOfMonth: 5, interval: 2 }, sun)).toEqual(new Date(2026, 11, 5, 9, 0)); // Oct, Dec…
    expect(nextFireTime(s, new Date(2027, 0, 1))).toBeNull(); // span ended in Dec
    expect(describeSchedule({ ...s, dayOfMonth: -1 })).toBe('Monthly on the last day at 09:00 · Oct–Dec 2026');
    expect(describeSchedule({ ...s, dayOfMonth: 22, interval: 3 })).toBe('Every 3 months on the 22nd at 09:00 · Oct–Dec 2026');
  });
});
