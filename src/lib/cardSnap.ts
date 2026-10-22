// Cockpit widths. The page opens in a two-card mode; the tabs inside the
// cards box switch between whole-card modes (1, 2, 3), each with both side
// columns sharing the rest evenly, and the handles between the columns resize
// freely (px). Pure maths, so it is tested on its own (cardSnap.test.ts).

export interface SnapGeometry {
  width: number; // the cockpit row, px
  handle: number; // each resize handle, px
  leftBase: number; // the side columns in the widest (three-card) mode, px
  rightBase: number;
  chrome: number; // centre frame minus the cards themselves (padding, borders), px
  card: number; // one category card, px
  gap: number; // between cards, px
  count?: number; // categories there are (the modes never show more cards than this)
}

export const MAX_CARDS = 3;
export const DEFAULT_CARDS = 2; // the mode a fresh page opens in

// The most cards the centre can hold with both sides at their base (1–3,
// capped by the categories there are). A card cut by only a sliver still counts.
const SLIVER = 0.15;
export function cardsAtRest(g: SnapGeometry): number {
  const room = g.width - 2 * g.handle - g.leftBase - g.rightBase - g.chrome;
  return Math.max(0, Math.min(MAX_CARDS, g.count ?? MAX_CARDS, Math.floor((room + g.gap) / (g.card + g.gap) + SLIVER)));
}

// The centre's width between these side widths, px.
const centreOf = (g: SnapGeometry, left: number, right: number) => g.width - 2 * g.handle - left - right;
// Room for exactly n cards, px.
function centreFor(g: SnapGeometry, n: number) {
  return g.chrome + n * g.card + (n - 1) * g.gap;
}

// An n-card mode: the centre is exactly n cards wide and both side columns get
// the same extra width over their base, so the page stays balanced. Asking
// for more cards than fit gives the widest mode there is.
export function modeColumns(g: SnapGeometry, n: number): { left: number; right: number; cards: number } {
  const cards = Math.max(1, Math.min(n, cardsAtRest(g) || 1));
  const slack = Math.max(0, g.width - 2 * g.handle - centreFor(g, cards) - g.leftBase - g.rightBase);
  const toLeft = Math.floor(slack / 2);
  return { left: g.leftBase + toLeft, right: g.rightBase + slack - toLeft, cards };
}

// Cards (fractional) the centre shows between these side widths.
export function centreCards(g: SnapGeometry, left: number, right: number): number {
  return (centreOf(g, left, right) - g.chrome + g.gap) / (g.card + g.gap);
}

// Whole cards in view (1–3); a card cut by only a sliver still counts.
export const wholeCards = (g: SnapGeometry, left: number, right: number) =>
  Math.max(1, Math.min(MAX_CARDS, g.count ?? MAX_CARDS, Math.floor(centreCards(g, left, right) + SLIVER)));

// Most px a side may have next to the other side's width (the centre keeps one card).
export const sideMax = (g: SnapGeometry, other: number) => Math.max(0, g.width - 2 * g.handle - centreFor(g, 1) - other);

// The columns for what is saved: free px widths from the outside handles win;
// otherwise the chosen card mode (null = the default two-card mode). Free
// widths are clamped between their base and what leaves the centre one card.
export function freeColumns(
  g: SnapGeometry,
  leftW: number | null,
  rightW: number | null,
  mode: number | null = null,
): { left: number; right: number; cards: number } {
  if (leftW === null && rightW === null) return modeColumns(g, mode ?? DEFAULT_CARDS);
  const right = Math.round(Math.max(g.rightBase, Math.min(rightW ?? g.rightBase, sideMax(g, g.leftBase))));
  const left = Math.round(Math.max(g.leftBase, Math.min(leftW ?? g.leftBase, sideMax(g, right))));
  return { left, right, cards: wholeCards(g, left, right) };
}

// One click on an edge tab (either side): a part-card view snaps to the whole
// cards it shows (2.5 → 2); a whole view goes one card fewer, and from one
// card back to the widest mode (… 3 → 2 → 1 → 3).
export function nextMode(g: SnapGeometry, left: number, right: number): number {
  const n = centreCards(g, left, right);
  const frac = n - Math.floor(n);
  const most = Math.max(1, cardsAtRest(g));
  if (frac >= SLIVER && frac <= 0.95) return Math.max(1, Math.min(most, Math.floor(n)));
  const whole = Math.min(most, frac > 0.95 ? Math.ceil(n) : Math.floor(n));
  return whole <= 1 ? most : whole - 1;
}
