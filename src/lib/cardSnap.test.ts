import { describe, expect, it } from 'vitest';
import { cardsAtRest, clampTaken, dragSteps, snapColumns, type SnapGeometry } from './cardSnap';

// A wide screen: 1900px cockpit, 250 / 300 side columns, 400px cards.
const g: SnapGeometry = { width: 1900, handle: 12, leftBase: 250, rightBase: 300, chrome: 60, card: 400, gap: 20 };

describe('cardSnap', () => {
  it('counts whole cards at rest, capped at three', () => {
    expect(cardsAtRest(g)).toBe(3);
    expect(cardsAtRest({ ...g, width: 3000 })).toBe(3);
    expect(cardsAtRest({ ...g, width: 1500 })).toBe(2);
    expect(cardsAtRest({ ...g, width: 1872 })).toBe(3); // 10px short of three still counts as three
  });

  it('keeps at least one card in the centre', () => {
    expect(clampTaken(g, 5, 5)).toEqual({ left: 2, right: 0 });
    expect(clampTaken(g, 1, 3)).toEqual({ left: 1, right: 1 });
    expect(clampTaken({ ...g, width: 1100 }, 1, 1)).toEqual({ left: 0, right: 0 });
  });

  it('sizes the centre to exactly n cards and gives the rest to the dragged side', () => {
    expect(snapColumns(g, 0, 0)).toBeNull();
    const one = snapColumns(g, 1, 0)!;
    expect(one.cards).toBe(2);
    expect(one.right).toBe(300);
    expect(g.width - 2 * g.handle - one.left - one.right).toBe(60 + 2 * 400 + 20);
    const both = snapColumns(g, 1, 1)!;
    expect(both.cards).toBe(1);
    expect(g.width - 2 * g.handle - both.left - both.right).toBe(460);
  });

  it('snaps a short pull to one card', () => {
    expect(dragSteps(10, 420)).toBe(0);
    expect(dragSteps(50, 420)).toBe(1);
    expect(dragSteps(-50, 420)).toBe(-1);
    expect(dragSteps(500, 420)).toBe(2);
  });
});
