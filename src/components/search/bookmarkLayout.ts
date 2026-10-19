import { isFolder, type BmNode } from '../../services/bookmarks';

// Top-to-bottom tree layout for Tree View. Each folder is a box holding its
// own sites; sub-folders hang below it, centred under their parent. To stay
// readable with thousands of bookmarks, a folder whose sub-folders have no
// further (expanded) folders stacks them vertically, indented under it, rather
// than spreading them sideways — so the tree grows with depth, not breadth.
// Subtrees take disjoint column ranges, so boxes never overlap. Pure → tested.

export const BOX_W = 232;
export const HEADER_H = 40;
export const SITE_H = 26;
export const MAX_SITES = 8; // more sit behind "+N more" until the folder is opened up
const H_GAP = 28;
const V_GAP = 56;
const PAD = 10;
const INDENT = 30; // stacked sub-folders sit this far right of their parent
const STACK_GAP = 14;

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
  edges: Array<{ from: string; to: string; x1: number; y1: number; x2: number; y2: number; stacked?: boolean }>;
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
  // Sub-folders stack vertically when none of them shows sub-folders of its own.
  const stacks = (n: BmNode) => {
    const kids = collapsed.has(n.id) ? [] : subFolders(n);
    return kids.length > 0 && kids.every((k) => collapsed.has(k.id) || subFolders(k).length === 0);
  };
  const width = (n: BmNode): number => {
    const hit = widthCache.get(n.id);
    if (hit !== undefined) return hit;
    const kids = collapsed.has(n.id) ? [] : subFolders(n);
    const w = !kids.length ? BOX_W : stacks(n) ? BOX_W + INDENT : Math.max(BOX_W, kids.reduce((s, k) => s + width(k), 0) + H_GAP * (kids.length - 1));
    widthCache.set(n.id, w);
    return w;
  };

  const place = (n: BmNode, left: number, y: number, depth: number, parent: LaidBox | null, stackedChild = false): LaidBox => {
    const w = width(n);
    const allSites = (n.children ?? []).filter((c) => !isFolder(c));
    const sites = expandedSites.has(n.id) ? allSites : allSites.slice(0, MAX_SITES);
    const hidden = allSites.length - sites.length;
    const kids = subFolders(n);
    const isCollapsed = collapsed.has(n.id);
    const stacked = stacks(n);
    const box: LaidBox = {
      node: n,
      x: stacked ? left : left + (w - BOX_W) / 2,
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
    if (parent && !stackedChild) {
      edges.push({ from: parent.node.id, to: n.id, x1: parent.x + BOX_W / 2, y1: parent.y + parent.h, x2: box.x + BOX_W / 2, y2: y });
    }
    if (isCollapsed) return box;
    if (stacked) {
      let cy = y + box.h + STACK_GAP;
      for (const k of kids) {
        const child = place(k, left + INDENT, cy, depth + 1, box, true);
        edges.push({ from: n.id, to: k.id, x1: box.x + 16, y1: box.y + box.h, x2: child.x, y2: child.y + HEADER_H / 2, stacked: true });
        cy = child.y + child.h + STACK_GAP;
      }
      return box;
    }
    let cursor = left;
    const childW = kids.reduce((s, k) => s + width(k), 0) + H_GAP * Math.max(0, kids.length - 1);
    cursor += (w - childW) / 2;
    for (const k of kids) {
      place(k, cursor, y + box.h + V_GAP, depth + 1, box);
      cursor += width(k) + H_GAP;
    }
    return box;
  };

  let left = 0;
  for (const r of roots) {
    place(r, left, 0, 0, null);
    left += width(r) + H_GAP * 2;
  }
  return { boxes, edges, width: Math.max(0, left - H_GAP * 2), height: maxY };
}
