import { describe, expect, it } from 'vitest';
import { cardsAtRest, centreCards, freeColumns, modeColumns, nextMode, type SnapGeometry } from './cardSnap';

// A wide screen: 1900px cockpit, 250 / 300 side columns, 400px cards.
const g: SnapGeometry = { width: 1900, handle: 12, leftBase: 250, rightBase: 300, chrome: 60, card: 400, gap: 20 };
const centre = (c: { left: number; right: number }) => g.width - 2 * g.handle - c.left - c.right;

describe('cardSnap', () => {
  it('counts whole cards at rest, capped at three and at the categories there are', () => {
    expect(cardsAtRest(g)).toBe(3);
    expect(cardsAtRest({ ...g, width: 3000 })).toBe(3);
    expect(cardsAtRest({ ...g, width: 1500 })).toBe(2);
    expect(cardsAtRest({ ...g, width: 1872 })).toBe(3); // 10px short of three still counts as three
    expect(cardsAtRest({ ...g, count: 2 })).toBe(2);
  });

  it('builds each card mode with the centre exactly n cards and both sides sharing the rest', () => {
    for (const n of [1, 2, 3]) {
      const m = modeColumns(g, n);
      expect(m.cards).toBe(n);
      expect(centre(m)).toBe(60 + n * 400 + (n - 1) * 20);
      expect(Math.abs(m.left - g.leftBase - (m.right - g.rightBase))).toBeLessThanOrEqual(1); // same extra each side
    }
    expect(modeColumns(g, 3).left).toBe(250 + 13); // the widest mode is close to the bases
    expect(modeColumns({ ...g, width: 1500 }, 3).cards).toBe(2); // three don't fit: the widest there is
    expect(modeColumns({ ...g, count: 1 }, 2).cards).toBe(1);
  });

  it('opens in the two-card mode; free widths win over the mode', () => {
    expect(freeColumns(g, null, null)).toEqual(modeColumns(g, 2));
    expect(freeColumns(g, null, null, 1)).toEqual(modeColumns(g, 1));
    const free = freeColumns(g, 600, null, 1);
    expect(free.left).toBe(600);
    expect(free.cards).toBe(2); // 2.23 cards in view
    expect(freeColumns(g, 5000, null).left).toBe(1900 - 24 - 460 - 300); // one card left
    expect(freeColumns(g, 100, null).left).toBe(250); // never below the base
  });

  it('cycles the modes from the edge tabs: 2 → 1 → 3 → 2, part cards snap down', () => {
    const at = (n: number) => modeColumns(g, n);
    expect(nextMode(g, at(2).left, at(2).right)).toBe(1);
    expect(nextMode(g, at(1).left, at(1).right)).toBe(3);
    expect(nextMode(g, at(3).left, at(3).right)).toBe(2);
    expect(centreCards(g, 600, 300)).toBeCloseTo(2.23, 2);
    expect(nextMode(g, 600, 300)).toBe(2); // 2.23 → 2
    expect(nextMode({ ...g, count: 1 }, at(1).left, at(1).right)).toBe(1);
  });
});
