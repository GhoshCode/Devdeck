import { describe, expect, it } from 'vitest';
import { addMonths, describeTimer, normalizeTimer, timerEnd, viewTimer, type Timer } from './timer';

const start = new Date(2026, 9, 18, 19, 33, 0).getTime(); // Sun 18 Oct 2026 19:33
const M = 60_000;
const H = 60 * M;
const D = 24 * H;

describe('timer', () => {
  it('ends after the chosen length from creation — Sun 19:33 + 2 days = Tue 19:33', () => {
    const end = new Date(timerEnd({ amount: 2, unit: 'days', start }));
    expect([end.getDay(), end.getHours(), end.getMinutes()]).toEqual([2, 19, 33]);
    expect(timerEnd({ amount: 90, unit: 'minutes', start })).toBe(start + 90 * M);
    expect(new Date(timerEnd({ amount: 2, unit: 'months', start })).getDate()).toBe(18);
    expect(new Date(addMonths(new Date(2026, 0, 31).getTime(), 1)).getDate()).toBe(28); // Jan 31 → Feb 28
  });

  it('days left, then hh:mm on the last day', () => {
    const t: Timer = { amount: 3, unit: 'days', start };
    expect(viewTimer(t, start).text).toBe('3 days left');
    expect(viewTimer(t, start + 1 * D + 10 * H).text).toBe('2 days left'); // 38 h
    expect(viewTimer(t, start + 1.6 * D).text).toBe('1 day left'); // 33.6 h
    expect(viewTimer(t, start + 2 * D + 2 * H)).toMatchObject({ text: '22:00 left', state: 'running' });
    expect(viewTimer(t, start + 3 * D - 30 * M)).toMatchObject({ text: '00:30 left', state: 'soon' });
  });

  it('past due: hh:mm over the same day, then days overdue', () => {
    const t: Timer = { amount: 2, unit: 'days', start }; // due Tue 19:33
    const due = timerEnd(t);
    expect(viewTimer(t, due + 65 * M)).toMatchObject({ text: '01:05 over', state: 'over' }); // Tue 20:38
    expect(viewTimer(t, due + 5 * H).text).toBe('1 day overdue'); // Wed 00:33 — next day
    expect(viewTimer(t, due + 2 * D + 3 * H).text).toBe('2 days overdue');
  });

  it('months, then days in the last month, then hh:mm on the last day', () => {
    const t: Timer = { amount: 3, unit: 'months', start };
    expect(viewTimer(t, start).text).toBe('3 months left');
    expect(viewTimer(t, start + 40 * D).text).toBe('2 months left');
    const end = timerEnd(t);
    expect(viewTimer(t, end - 10 * D).text).toBe('10 days left');
    expect(viewTimer(t, end - 2 * H).text).toBe('02:00 left');
  });

  it('minute and hour timers keep a ticking hh:mm:ss', () => {
    const t: Timer = { amount: 2, unit: 'hours', start };
    expect(viewTimer(t, start)).toMatchObject({ text: '02:00:00', refreshMs: 1000 });
    expect(viewTimer(t, start + 90 * M)).toMatchObject({ text: '00:30:00', state: 'soon' });
    expect(viewTimer(t, start + 2 * H + 10 * M).text).toBe('00:10 over');
  });

  it('labels and validates', () => {
    expect(describeTimer({ amount: 1, unit: 'months' })).toBe('1 month');
    expect(describeTimer({ amount: 25, unit: 'minutes' })).toBe('25 min');
    expect(normalizeTimer({ amount: 0, unit: 'days' }, 1)).toBeNull();
    expect(normalizeTimer({ amount: 3, unit: 'weeks' }, 1)).toBeNull();
    expect(normalizeTimer({ amount: 3, unit: 'days' }, 7)).toEqual({ amount: 3, unit: 'days', start: 7 });
  });
});
