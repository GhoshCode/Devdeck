import { describe, expect, it } from 'vitest';
import { autoScale, clampScale } from './uiScale';

describe('interface size', () => {
  it('Auto keeps 100 % on ordinary desktop widths', () => {
    for (const w of [1440, 1600, 1920, 2200]) expect(autoScale(w)).toBe(1);
  });
  it('Auto shrinks on small laptop screens, never below 80 %', () => {
    expect(autoScale(1366)).toBe(0.95);
    expect(autoScale(1280)).toBe(0.9);
    expect(autoScale(1024)).toBe(0.8); // 71 % would be too small: held at 80 %
  });
  it('Auto grows on very wide screens, never above 125 %', () => {
    expect(autoScale(2560)).toBe(1.15);
    expect(autoScale(3840)).toBe(1.25);
  });
  it('phones and tablets stay at 100 %', () => {
    expect(autoScale(375)).toBe(1);
    expect(autoScale(768)).toBe(1);
  });
  it('a manual size is kept in range, in 5 % steps', () => {
    expect(clampScale(0.5)).toBe(0.8);
    expect(clampScale(1.07)).toBe(1.05);
    expect(clampScale(2)).toBe(1.25);
  });
});
