// Cockpit widths when the side columns are resized by whole category cards.
// The centre always shows a whole number of cards (1–3); the space it gives
// up goes to the side whose handle was dragged. Pure maths, so it is tested
// on its own (cardSnap.test.ts).

export interface SnapGeometry {
  width: number; // the cockpit row, px
  handle: number; // each resize handle, px
  leftBase: number; // the side columns at rest, px
  rightBase: number;
  chrome: number; // centre frame minus the cards themselves (padding, borders), px
  card: number; // one category card, px
  gap: number; // between cards, px
}

export const MAX_CARDS = 3;

// How many cards the centre holds with both sides at rest (capped at 3). A card
// that is cut by only a sliver still counts — the row already shows it.
const SLIVER = 0.15;
export function cardsAtRest(g: SnapGeometry): number {
  const room = g.width - 2 * g.handle - g.leftBase - g.rightBase - g.chrome;
  return Math.max(0, Math.min(MAX_CARDS, Math.floor((room + g.gap) / (g.card + g.gap) + SLIVER)));
}

// Cards the sides may take between them so the centre keeps at least one.
export const maxTaken = (g: SnapGeometry) => Math.max(0, cardsAtRest(g) - 1);

// Keeps both counts valid for this geometry (the right side gives way first).
export function clampTaken(g: SnapGeometry, left: number, right: number): { left: number; right: number } {
  const max = maxTaken(g);
  const l = Math.max(0, Math.min(max, Math.round(left) || 0));
  const r = Math.max(0, Math.min(max - l, Math.round(right) || 0));
  return { left: l, right: r };
}

// Column widths in px, or null for the default layout (nothing taken).
export function snapColumns(g: SnapGeometry, left: number, right: number): { left: number; right: number; cards: number } | null {
  const t = clampTaken(g, left, right);
  const taken = t.left + t.right;
  if (!taken) return null;
  const cards = cardsAtRest(g) - taken;
  const centre = g.chrome + cards * g.card + (cards - 1) * g.gap;
  const slack = g.width - 2 * g.handle - g.leftBase - g.rightBase - centre;
  return {
    left: Math.round(g.leftBase + (slack * t.left) / taken),
    right: Math.round(g.rightBase + (slack * t.right) / taken),
    cards,
  };
}

// A drag of dx px becomes whole-card steps: a short pull (past `dead` px)
// already snaps one card; every further card width adds another.
export function dragSteps(dx: number, unit: number, dead = 36): number {
  const d = Math.abs(dx);
  if (d < dead) return 0;
  return Math.sign(dx) * (1 + Math.floor((d - dead) / unit));
}
