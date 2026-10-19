// Browser bookmarks — the browser's own data, not DevDeck's library.
//
// The panel reads the live tree through chrome.bookmarks and writes every
// change straight back (create, rename, move, delete), so DevDeck and the
// browser's bookmark manager always show the same thing. Changes made in the
// browser arrive through the onCreated/onChanged/onMoved/onRemoved/… events.
// Only available inside the extension ("bookmarks" permission).

export interface BmNode {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  url?: string; // absent on folders
  children?: BmNode[];
  unmodifiable?: 'managed';
}

interface BookmarksApi {
  getTree(): Promise<BmNode[]>;
  create(b: { parentId?: string; index?: number; title?: string; url?: string }): Promise<BmNode>;
  update(id: string, changes: { title?: string; url?: string }): Promise<BmNode>;
  move(id: string, dest: { parentId?: string; index?: number }): Promise<BmNode>;
  remove(id: string): Promise<void>;
  removeTree(id: string): Promise<void>;
  onCreated: ChromeEvent;
  onRemoved: ChromeEvent;
  onChanged: ChromeEvent;
  onMoved: ChromeEvent;
  onChildrenReordered: ChromeEvent;
  onImportEnded: ChromeEvent;
}
interface ChromeEvent {
  addListener(fn: () => void): void;
  removeListener(fn: () => void): void;
}

export function bookmarksApi(): BookmarksApi | null {
  const api = (globalThis as { chrome?: { bookmarks?: BookmarksApi } }).chrome?.bookmarks;
  return api && typeof api.getTree === 'function' ? api : null;
}

export const isFolder = (n: BmNode) => !n.url;

// The browser's fixed top-level containers (Bookmarks bar, Other bookmarks,
// Mobile bookmarks) can't be renamed, deleted or moved.
export const isRootContainer = (n: BmNode) => n.parentId === '0' || n.id === '0';

// Re-reads the whole tree whenever anything changes (debounced: an import or a
// folder delete fires many events). Returns an unsubscribe.
export function watchBookmarks(onTree: (roots: BmNode[]) => void, onError: (e: Error) => void): () => void {
  const api = bookmarksApi();
  if (!api) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const load = () => {
    api
      .getTree()
      .then((t) => onTree(t[0]?.children ?? []))
      .catch((e: unknown) => onError(e instanceof Error ? e : new Error(String(e))));
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(load, 60);
  };
  const events = [api.onCreated, api.onRemoved, api.onChanged, api.onMoved, api.onChildrenReordered, api.onImportEnded];
  events.forEach((ev) => ev?.addListener(schedule));
  load();
  return () => {
    clearTimeout(timer);
    events.forEach((ev) => ev?.removeListener(schedule));
  };
}

// ---- tree helpers (pure, unit-tested) ----------------------------------------

export function findNode(roots: readonly BmNode[], id: string): BmNode | null {
  for (const n of roots) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

// True when `id` is `ancestorId` itself or sits anywhere inside it — a folder
// can't be moved into itself or its own descendants.
export function isInside(roots: readonly BmNode[], id: string, ancestorId: string): boolean {
  const anc = findNode(roots, ancestorId);
  return !!anc && (anc.id === id || !!findNode(anc.children ?? [], id));
}

export function countSites(n: BmNode): number {
  if (!isFolder(n)) return 1;
  return (n.children ?? []).reduce((sum, c) => sum + countSites(c), 0);
}

// Filtering: keeps a site when its title or URL matches, and a folder when its
// own title matches or anything inside it does. Matching folders keep all
// their content.
export function filterTree(roots: readonly BmNode[], query: string): BmNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return roots as BmNode[];
  const walk = (nodes: readonly BmNode[]): BmNode[] =>
    nodes.flatMap((n) => {
      if (!isFolder(n)) return `${n.title} ${n.url}`.toLowerCase().includes(q) ? [n] : [];
      if (n.title.toLowerCase().includes(q)) return [n];
      const kids = walk(n.children ?? []);
      return kids.length ? [{ ...n, children: kids }] : [];
    });
  return walk(roots);
}

// ---- writes ------------------------------------------------------------------

const need = () => {
  const api = bookmarksApi();
  if (!api) throw new Error('Browser bookmarks are only available in the DevDeck extension.');
  return api;
};

export const createFolder = (parentId: string, title: string) => need().create({ parentId, title });
export const renameNode = (id: string, title: string, url?: string) => need().update(id, url === undefined ? { title } : { title, url });
export const moveNode = (id: string, parentId: string, index?: number) => need().move(id, index === undefined ? { parentId } : { parentId, index });

// Deletes a site or a whole folder. Returns a snapshot that `restoreNode`
// can put back (same place, same contents — new ids).
export async function deleteNode(node: BmNode): Promise<BmNode> {
  const api = need();
  if (isFolder(node)) await api.removeTree(node.id);
  else await api.remove(node.id);
  return node;
}

export async function restoreNode(snapshot: BmNode): Promise<void> {
  const api = need();
  const put = async (n: BmNode, parentId: string, index?: number) => {
    const made = await api.create({ parentId, index, title: n.title, url: n.url });
    for (const c of n.children ?? []) await put(c, made.id);
  };
  if (snapshot.parentId) await put(snapshot, snapshot.parentId, snapshot.index);
}
