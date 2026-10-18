import { describe, expect, it } from 'vitest';
import { addMonths, describeTimer, normalizeTimer, timerEnd, viewTimer, type Timer } from './timer';

const start = new Date(2026, 9, 18, 10, 0, 0).getTime(); // Sun 18 Oct 2026 10:00
const H = 3_600_000;
const D = 24 * H;

describe('timer', () => {
  it('ends after the chosen length, months by the calendar', () => {
    expect(timerEnd({ amount: 90, unit: 'minutes', start })).toBe(start + 90 * 60_000);
    expect(timerEnd({ amount: 4, unit: 'days', start })).toBe(start + 4 * D);
    expect(new Date(timerEnd({ amount: 2, unit: 'months', start })).getDate()).toBe(18);
    expect(new Date(addMonths(new Date(2026, 0, 31).getTime(), 1)).getDate()).toBe(28); // Jan 31 → Feb 28
  });

  it('shows days until the last day, then hh:mm:ss', () => {
    const t: Timer = { amount: 4, unit: 'days', start };
    expect(viewTimer(t, start).text).toBe('4 days left');
    expect(viewTimer(t, start + 2.5 * D).text).toBe('2 days left');
    const last = viewTimer(t, start + 3 * D + 1000);
    expect(last.text).toBe('23:59:59');
    expect(last.ticking).toBe(true);
  });

  it('shows months, then days in the last month, then time on the last day', () => {
    const t: Timer = { amount: 3, unit: 'months', start };
    expect(viewTimer(t, start).text).toBe('3 months left');
    expect(viewTimer(t, start + 40 * D).text).toBe('2 months left');
    const end = timerEnd(t);
    expect(viewTimer(t, end - 10 * D).text).toBe('10 days left');
    expect(viewTimer(t, end - 2 * H).text).toBe('02:00:00');
  });

  it('counts hours and minutes as a clock and flags the last hour', () => {
    const t: Timer = { amount: 2, unit: 'hours', start };
    expect(viewTimer(t, start).text).toBe('02:00:00');
    expect(viewTimer(t, start + 90 * 60_000)).toMatchObject({ text: '00:30:00', state: 'soon' });
    expect(viewTimer(t, start + 3 * H)).toMatchObject({ text: "Time's up", state: 'done', ticking: false });
  });

  it('labels and validates', () => {
    expect(describeTimer({ amount: 1, unit: 'months' })).toBe('1 month');
    expect(describeTimer({ amount: 25, unit: 'minutes' })).toBe('25 min');
    expect(normalizeTimer({ amount: 0, unit: 'days' }, 1)).toBeNull();
    expect(normalizeTimer({ amount: 3, unit: 'weeks' }, 1)).toBeNull();
    expect(normalizeTimer({ amount: 3, unit: 'days' }, 7)).toEqual({ amount: 3, unit: 'days', start: 7 });
  });
});
