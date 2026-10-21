import { describe, expect, it } from 'vitest';
import { cardsAtRest, centreCards, freeColumns, restColumns, stepSide, type SnapGeometry } from './cardSnap';

// A wide screen: 1900px cockpit, 250 / 300 side columns, 400px cards.
const g: SnapGeometry = { width: 1900, handle: 12, leftBase: 250, rightBase: 300, chrome: 60, card: 400, gap: 20 };

describe('cardSnap', () => {
  it('counts whole cards at rest, capped at three', () => {
    expect(cardsAtRest(g)).toBe(3);
    expect(cardsAtRest({ ...g, width: 3000 })).toBe(3);
    expect(cardsAtRest({ ...g, width: 1500 })).toBe(2);
    expect(cardsAtRest({ ...g, width: 1872 })).toBe(3); // 10px short of three still counts as three
  });

  it('resizes the sides freely but keeps one card in the centre', () => {
    expect(freeColumns(g, null, null)).toEqual({ left: 250, right: 300, cards: 3 });
    const free = freeColumns(g, 600, null);
    expect(free.left).toBe(600);
    expect(free.cards).toBe(2); // 2.23 cards in view
    expect(freeColumns(g, 5000, null).left).toBe(1900 - 24 - 460 - 300); // one card left
    expect(freeColumns(g, 100, null).left).toBe(250); // never below the base
  });

  it('steps the centre down by whole cards from the edge tabs', () => {
    expect(stepSide(g, 'left', 250, 300)).toBe(250 + 1326 - 880); // 3.06 → 2
    expect(stepSide(g, 'left', 600, 300)).toBe(600 + 976 - 880); // 2.23 → 2
    const two = stepSide(g, 'right', 250, 600)!; // the right tab widens the news column
    expect(centreCards(g, 250, two)).toBeCloseTo(2);
    expect(stepSide(g, 'left', 696, 300)).toBe(696 + 880 - 460); // 2 → 1
    expect(stepSide(g, 'left', 1116, 300)).toBeNull(); // at one card the side gives its space back
  });
});

describe('restColumns (nothing resized)', () => {
  // 1748px: room for two cards plus 314px that is not quite a third
  const g: SnapGeometry = { width: 1748, handle: 12, leftBase: 250, rightBase: 300, chrome: 24, card: 400, gap: 12 };

  it('gives the leftover width to the news column first, then the left one', () => {
    const r = restColumns(g)!;
    expect(r.cards).toBe(2);
    const centre = g.chrome + 2 * g.card + g.gap;
    expect(r.left + r.right + 2 * g.handle + centre).toBe(g.width); // the centre is exactly two cards
    expect(r.right).toBe(560); // news grows to its cap first
    expect(r.left).toBeGreaterThan(g.leftBase); // the rest widens the left column
  });

  it('only the news column grows while the leftover fits under its cap', () => {
    const r = restColumns({ ...g, width: 1500 })!; // 90px over
    expect(r.left).toBe(g.leftBase);
    expect(r.right).toBeGreaterThan(g.rightBase);
  });

  it('keeps the default columns with three cards', () => {
    expect(restColumns({ ...g, width: 2200 })).toBeNull();
  });
});
