import { describe, expect, test } from 'vitest';
import { countSites, filterTree, findNode, isInside, type BmNode } from './bookmarks';

const tree: BmNode[] = [
  { id: '1', parentId: '0', title: 'Bookmarks bar', children: [
    { id: 'f1', parentId: '1', title: 'Dev', children: [
      { id: 's1', parentId: 'f1', title: 'GitHub', url: 'https://github.com' },
      { id: 'f2', parentId: 'f1', title: 'Docs', children: [{ id: 's2', parentId: 'f2', title: 'MDN', url: 'https://developer.mozilla.org' }] },
    ] },
    { id: 's3', parentId: '1', title: 'News', url: 'https://news.ycombinator.com' },
  ] },
];

describe('bookmark tree helpers', () => {
  test('findNode finds deep nodes', () => expect(findNode(tree, 's2')?.title).toBe('MDN'));
  test('isInside blocks moving a folder into itself or a descendant', () => {
    expect(isInside(tree, 'f2', 'f1')).toBe(true);
    expect(isInside(tree, 'f1', 'f1')).toBe(true);
    expect(isInside(tree, 'f1', 'f2')).toBe(false);
  });
  test('countSites counts every site below a folder', () => expect(countSites(tree[0])).toBe(3));
  test('filterTree keeps matching sites with their folder path', () => {
    const out = filterTree(tree, 'mdn');
    expect(findNode(out, 's2')).not.toBeNull();
    expect(findNode(out, 's1')).toBeNull();
    expect(findNode(out, 's3')).toBeNull();
  });
  test('a matching folder keeps all its contents', () => expect(countSites(filterTree(tree, 'dev')[0])).toBe(2));
});
