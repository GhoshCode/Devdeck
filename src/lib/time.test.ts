import { describe, expect, test } from 'vitest';
import { clockParts, formatDateLine, localDateKey } from './time';
import { GREETINGS, greetingPhrase, segmentOf } from './greetings';

const at = (h: number, m = 0, s = 0) => new Date(2026, 9, 15, h, m, s);

describe('clockParts', () => {
  test('12h mode maps midnight and noon to 12 with a meridiem', () => {
    expect(clockParts(at(0, 5, 9), false)).toEqual({ hours: '12', minutes: '05', seconds: '09', meridiem: 'AM' });
    expect(clockParts(at(12), false).hours).toBe('12');
    expect(clockParts(at(21, 30), false)).toMatchObject({ hours: '09', meridiem: 'PM' });
  });

  test('24h mode zero-pads and has no meridiem', () => {
    expect(clockParts(at(7, 4), true)).toMatchObject({ hours: '07', minutes: '04', meridiem: null });
  });
});

describe('greetings', () => {
  it.each([
    [10, 'office'],
    [14, 'office'],
    [15, 'afternoon'],
    [19, 'afternoon'],
    [20, 'geek'],
    [1, 'geek'],
    [2, 'night'],
    [8, 'night'],
  ] as const)('%i:00 is %s', (h, seg) => {
    expect(segmentOf(at(h))).toBe(seg);
  });

  it('has 5–8 phrases per segment and re-rolls within it', () => {
    for (const list of Object.values(GREETINGS)) {
      expect(list.length).toBeGreaterThanOrEqual(5);
      expect(list.length).toBeLessThanOrEqual(8);
    }
    expect(greetingPhrase('geek', 0)).toBe('LATE-NIGHT HACKING');
    expect(greetingPhrase('geek', GREETINGS.geek.length)).toBe('LATE-NIGHT HACKING');
    expect(greetingPhrase('night', -1)).toBe(GREETINGS.night.at(-1));
  });
});

test('date helpers', () => {
  expect(formatDateLine(at(10))).toBe('THURSDAY, OCTOBER 15, 2026');
  expect(localDateKey(at(23, 59))).toBe('2026-10-15');
});
