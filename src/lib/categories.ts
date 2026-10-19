import type { Category } from '../types';

// Display order for the card row (§7 Q6): the single pinned card goes first,
// everything else keeps its stored order. Because `order` itself is never
// rewritten, unpinning drops the card straight back into its usual slot.
export function orderWithPin(categories: readonly Category[], pinnedId: string | null): Category[] {
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  const pinned = pinnedId ? sorted.find((c) => c.id === pinnedId) : undefined;
  return pinned ? [pinned, ...sorted.filter((c) => c !== pinned)] : sorted;
}

// Sites with no category ("Uncategorized / None"): categoryId '' and no
// subcategory. They come back from the recycle bin when their category is
// gone. Not a real category — the deck shows them as loose tiles after the
// last card, the Site Map in their own card.
export const UNCATEGORIZED_ID = '';
export const UNCATEGORIZED_NAME = 'Uncategorized';
export const UNCATEGORIZED_COLOR = '#94a3b8';
