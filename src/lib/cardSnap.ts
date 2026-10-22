// Cockpit widths. The handles between the columns resize freely (px); the
// tabs inside the cards box step the centre down by whole cards (3 → 2 → 1,
// a part-card view snaps to the whole cards below it). Pure maths, so it is
// tested on its own (cardSnap.test.ts).

export interface SnapGeometry {
  width: number; // the cockpit row, px
  handle: number; // each resize handle, px
  leftBase: number; // the side columns at rest, px
  rightBase: number;
  chrome: number; // centre frame minus the cards themselves (padding, borders), px
  card: number; // one category card, px
  gap: number; // between cards, px
  rightMax?: number; // the news column grows to this before the left column gets any (default 560)
}

export const MAX_CARDS = 3;

// How many cards the centre holds with both sides at rest (capped at 3). A card
// that is cut by only a sliver still counts — the row already shows it.
const SLIVER = 0.15;
export function cardsAtRest(g: SnapGeometry): number {
  const room = g.width - 2 * g.handle - g.leftBase - g.rightBase - g.chrome;
  return Math.max(0, Math.min(MAX_CARDS, Math.floor((room + g.gap) / (g.card + g.gap) + SLIVER)));
}

// Nothing resized, 1 or 2 cards showing: the centre is exactly as wide as its
// cards, and the width left over widens the scraped-news column first (up to
// rightMax), then the left column. Three cards (the widest view) keep the
// default columns.
export function restColumns(g: SnapGeometry): { left: number; right: number; cards: number } | null {
  const cards = cardsAtRest(g);
  if (cards < 1 || cards >= MAX_CARDS) return null;
  const centre = centreFor(g, cards);
  const slack = g.width - 2 * g.handle - g.leftBase - g.rightBase - centre;
  if (slack <= 0) return null;
  const toRight = Math.min(slack, Math.max(0, (g.rightMax ?? 560) - g.rightBase));
  return { left: Math.round(g.leftBase + slack - toRight), right: Math.round(g.rightBase + toRight), cards };
}

// The centre's width between these side widths, px.
const centreOf = (g: SnapGeometry, left: number, right: number) => g.width - 2 * g.handle - left - right;
// Room for exactly n cards, px.
function centreFor(g: SnapGeometry, n: number) {
  return g.chrome + n * g.card + (n - 1) * g.gap;
}

// Cards (fractional) the centre shows between these side widths.
export function centreCards(g: SnapGeometry, left: number, right: number): number {
  return (centreOf(g, left, right) - g.chrome + g.gap) / (g.card + g.gap);
}

// Whole cards in view (1–3); a card cut by only a sliver still counts.
export const wholeCards = (g: SnapGeometry, left: number, right: number) =>
  Math.max(1, Math.min(MAX_CARDS, Math.floor(centreCards(g, left, right) + SLIVER)));

// Most px a side may have next to the other side's width (the centre keeps one card).
export const sideMax = (g: SnapGeometry, other: number) => Math.max(0, g.width - 2 * g.handle - centreFor(g, 1) - other);

// Column widths for the saved side widths (null = not resized). With neither
// resized the rest layout applies; each width is clamped between its base and
// what leaves the centre one card.
export function freeColumns(g: SnapGeometry, leftW: number | null, rightW: number | null): { left: number; right: number; cards: number } {
  if (leftW === null && rightW === null) {
    const r = restColumns(g);
    const left = r?.left ?? g.leftBase;
    const right = r?.right ?? g.rightBase;
    return { left, right, cards: wholeCards(g, left, right) };
  }
  const right = Math.round(Math.max(g.rightBase, Math.min(rightW ?? g.rightBase, sideMax(g, g.leftBase))));
  const left = Math.round(Math.max(g.leftBase, Math.min(leftW ?? g.leftBase, sideMax(g, right))));
  return { left, right, cards: wholeCards(g, left, right) };
}

// One click on an edge tab: the centre goes to the whole cards below what it
// shows now (2.5 → 2, 2 → 1) and that side takes the space. At one card the
// side gives its space back (null = reset).
export function stepSide(g: SnapGeometry, side: 'left' | 'right', left: number, right: number): number | null {
  const n = centreCards(g, left, right);
  // a view a sliver past whole cards counts as whole, so the step is a whole card
  const frac = n - Math.floor(n);
  const target = Math.min(MAX_CARDS, frac < SLIVER ? Math.floor(n) - 1 : frac > 0.95 ? Math.ceil(n) - 1 : Math.floor(n));
  if (target < 1) return null;
  const give = centreOf(g, left, right) - centreFor(g, target);
  return Math.round((side === 'left' ? left : right) + give);
}

// Dragging an edge tab: that side's width that leaves the centre exactly n
// cards (the other side as it is), or null when the rest layout already
// shows that many or the width would be its base or less.
export function sideFor(g: SnapGeometry, side: 'left' | 'right', left: number, right: number, n: number): number | null {
  if (n >= cardsAtRest(g)) return null; // as many as at rest: no resize needed
  const w = Math.round((side === 'left' ? left : right) + centreOf(g, left, right) - centreFor(g, Math.max(1, n)));
  return w <= (side === 'left' ? g.leftBase : g.rightBase) ? null : w;
}
