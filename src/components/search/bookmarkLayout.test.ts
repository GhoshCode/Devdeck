import { describe, expect, test } from 'vitest';
import type { BmNode } from '../../services/bookmarks';
import { BOX_W, MAX_SITES, layoutTree } from './bookmarkLayout';

const site = (id: string, parentId: string): BmNode => ({ id, parentId, title: id, url: `https://${id}.dev` });
const roots: BmNode[] = [
  { id: '1', parentId: '0', title: 'Bar', children: [
    site('s1', '1'),
    { id: 'a', parentId: '1', title: 'A', children: [site('a1', 'a'), { id: 'a2', parentId: 'a', title: 'A2', children: [] }] },
    { id: 'b', parentId: '1', title: 'B', children: Array.from({ length: 12 }, (_, i) => site(`b${i}`, 'b')) },
  ] },
];
const none = new Set<string>();

describe('bookmark tree layout', () => {
  test('children sit below their parent and boxes never overlap', () => {
    const { boxes } = layoutTree(roots, none, none);
    const by = Object.fromEntries(boxes.map((b) => [b.node.id, b]));
    expect(by.a.y).toBeGreaterThan(by['1'].y + by['1'].h);
    expect(by.a2.y).toBeGreaterThan(by.a.y + by.a.h);
    for (const p of boxes) for (const q of boxes) {
      if (p === q) continue;
      const overlapX = p.x < q.x + BOX_W && q.x < p.x + BOX_W;
      const overlapY = p.y < q.y + q.h && q.y < p.y + p.h;
      expect(overlapX && overlapY).toBe(false);
    }
  });
  test('the parent is centred over its sub folders', () => {
    const { boxes } = layoutTree(roots, none, none);
    const by = Object.fromEntries(boxes.map((b) => [b.node.id, b]));
    const mid = (by.a.x + by.b.x + BOX_W) / 2;
    expect(Math.abs(by['1'].x + BOX_W / 2 - mid)).toBeLessThan(1);
  });
  test('long folders show MAX_SITES and count the rest; expanding shows all', () => {
    const b = layoutTree(roots, none, none).boxes.find((x) => x.node.id === 'b')!;
    expect(b.sites).toHaveLength(MAX_SITES);
    expect(b.hiddenSites).toBe(12 - MAX_SITES);
    const all = layoutTree(roots, none, new Set(['b'])).boxes.find((x) => x.node.id === 'b')!;
    expect(all.sites).toHaveLength(12);
  });
  test('collapsing a folder hides its sub folders and their edges', () => {
    const { boxes, edges } = layoutTree(roots, new Set(['a']), none);
    expect(boxes.some((x) => x.node.id === 'a2')).toBe(false);
    expect(edges.some((e) => e.to === 'a2')).toBe(false);
    expect(boxes.find((x) => x.node.id === 'a')!.collapsed).toBe(true);
  });
});

describe('compact stacking for large trees', () => {
  // 6 top folders × 8 sub folders × 10 sites each: a flat org chart would be
  // ~48 boxes wide; stacking leaf sub-folders keeps it to one column per top folder.
  const big: BmNode[] = [
    { id: '1', parentId: '0', title: 'Bar', children: Array.from({ length: 6 }, (_, i) => ({
      id: `f${i}`, parentId: '1', title: `F${i}`, children: Array.from({ length: 8 }, (_, j) => ({
        id: `f${i}-${j}`, parentId: `f${i}`, title: `F${i}.${j}`, children: Array.from({ length: 10 }, (_, k) => site(`s${i}-${j}-${k}`, `f${i}-${j}`)),
      })),
    })) },
  ];
  test('leaf sub-folders stack under their parent and the tree stays narrow', () => {
    const { boxes, width } = layoutTree(big, new Set(), new Set());
    const f0 = boxes.find((b) => b.node.id === 'f0')!;
    const kids = boxes.filter((b) => b.parentId === 'f0');
    expect(kids).toHaveLength(8);
    expect(new Set(kids.map((k) => k.x)).size).toBe(1); // one column
    expect(kids.every((k) => k.x > f0.x && k.y > f0.y)).toBe(true); // indented below
    expect(width).toBeLessThan(6 * (BOX_W + 80) + 100);
  });
});
