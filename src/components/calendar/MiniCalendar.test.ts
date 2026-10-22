import { describe, expect, it } from 'vitest';
import { isoWeek } from './MiniCalendar';

describe('isoWeek', () => {
  it('numbers weeks the ISO-8601 way', () => {
    expect(isoWeek(new Date(2026, 9, 20))).toBe(43);
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1); // Thursday → week 1
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53); // Friday → last week of 2026
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1); // Monday → week 1 of 2025
  });
});
