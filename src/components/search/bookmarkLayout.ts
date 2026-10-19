import { isFolder, type BmNode } from '../../services/bookmarks';

// Top-to-bottom tree layout for Tree View. Each folder is a box holding its
// own sites; sub-folders hang below it, centred under their parent. Subtrees
// take disjoint column ranges, so boxes never overlap. Pure → unit-tested.

export const BOX_W = 232;
export const HEADER_H = 40;
export const SITE_H = 26;
export const MAX_SITES = 8; // more sit behind "+N more" until the folder is opened up
const H_GAP = 28;
const V_GAP = 56;
const PAD = 10;

export interface LaidBox {
  node: BmNode;
  x: number;
  y: number;
  h: number;
  depth: number;
  sites: BmNode[]; // the sites shown in the box
  hiddenSites: number;
  folders: number; // direct sub-folders (shown or collapsed)
  collapsed: boolean;
  parentId: string | null;
}
export interface Layout {
  boxes: LaidBox[];
  edges: Array<{ from: string; to: string; x1: number; y1: number; x2: number; y2: number }>;
  width: number;
  height: number;
}

export function boxHeight(sitesShown: number, hidden: number) {
  return HEADER_H + (sitesShown + (hidden ? 1 : 0)) * SITE_H + (sitesShown || hidden ? PAD : 0);
}

export function layoutTree(roots: readonly BmNode[], collapsed: ReadonlySet<string>, expandedSites: ReadonlySet<string>): Layout {
  const boxes: LaidBox[] = [];
  const edges: Layout['edges'] = [];
  let maxY = 0;

  // Width of a folder's subtree (its box or its children's total, whichever is wider).
  const widthCache = new Map<string, number>();
  const subFolders = (n: BmNode) => (n.children ?? []).filter(isFolder);
  const width = (n: BmNode): number => {
    const hit = widthCache.get(n.id);
    if (hit !== undefined) return hit;
    const kids = collapsed.has(n.id) ? [] : subFolders(n);
    const w = kids.length ? Math.max(BOX_W, kids.reduce((s, k) => s + width(k), 0) + H_GAP * (kids.length - 1)) : BOX_W;
    widthCache.set(n.id, w);
    return w;
  };

  const place = (n: BmNode, left: number, y: number, depth: number, parent: LaidBox | null) => {
    const w = width(n);
    const allSites = (n.children ?? []).filter((c) => !isFolder(c));
    const sites = expandedSites.has(n.id) ? allSites : allSites.slice(0, MAX_SITES);
    const hidden = allSites.length - sites.length;
    const kids = subFolders(n);
    const isCollapsed = collapsed.has(n.id);
    const box: LaidBox = {
      node: n,
      x: left + (w - BOX_W) / 2,
      y,
      h: boxHeight(sites.length, hidden),
      depth,
      sites,
      hiddenSites: hidden,
      folders: kids.length,
      collapsed: isCollapsed,
      parentId: parent?.node.id ?? null,
    };
    boxes.push(box);
    maxY = Math.max(maxY, y + box.h);
    if (parent) {
      edges.push({ from: parent.node.id, to: n.id, x1: parent.x + BOX_W / 2, y1: parent.y + parent.h, x2: box.x + BOX_W / 2, y2: y });
    }
    if (isCollapsed) return;
    let cursor = left;
    const childW = kids.reduce((s, k) => s + width(k), 0) + H_GAP * Math.max(0, kids.length - 1);
    cursor += (w - childW) / 2;
    for (const k of kids) {
      place(k, cursor, y + box.h + V_GAP, depth + 1, box);
      cursor += width(k) + H_GAP;
    }
  };

  let left = 0;
  for (const r of roots) {
    place(r, left, 0, 0, null);
    left += width(r) + H_GAP * 2;
  }
  return { boxes, edges, width: Math.max(0, left - H_GAP * 2), height: maxY };
}
