import { beforeEach, describe, expect, test } from 'vitest';
import type { Site } from '../types';
import { useStore, migrate, normalizePersisted, SCHEMA_VERSION } from './store';
import { DEFAULT_FEEDS, DEFAULT_SETTINGS } from './seed';

const st = () => useStore.getState();
const site = (over: Partial<Site> & Pick<Site, 'id'>): Site => ({
  name: over.id.toUpperCase(),
  url: `https://${over.id}.com`,
  categoryId: 'c1',
  subcategoryId: null,
  primary: false,
  order: 0,
  visits: 0,
  lastVisited: null,
  ...over,
});

// A small, fully controlled fixture so assertions are exact:
//   c1 ▸ s1(A primary?, B primary) , s2 , General(C)
//   c2 ▸ General(D)
beforeEach(() => {
  useStore.setState({
    schemaVersion: SCHEMA_VERSION,
    trash: { sites: [], processing: [] },
    categories: [
      { id: 'c1', name: 'Cat One', color: '#a78bfa', order: 0 },
      { id: 'c2', name: 'Cat Two', color: '#f472b6', order: 1 },
    ],
    subcategories: [
      { id: 's1', name: 'Sub One', categoryId: 'c1', order: 0 },
      { id: 's2', name: 'Sub Two', categoryId: 'c1', order: 1 },
    ],
    sites: [
      site({ id: 'a', categoryId: 'c1', subcategoryId: 's1', order: 0 }),
      site({ id: 'b', categoryId: 'c1', subcategoryId: 's1', primary: true, order: 1 }),
      site({ id: 'c', categoryId: 'c1', subcategoryId: null, order: 0 }),
      site({ id: 'd', categoryId: 'c2', subcategoryId: null, order: 0 }),
    ],
    quickLinks: [
      { id: 'q1', name: 'One', url: 'https://one.com', order: 0 },
      { id: 'q2', name: 'Two', url: 'https://two.com', order: 1 },
    ],
    settings: { ...DEFAULT_SETTINGS },
    pinnedCategoryId: null,
    todos: [],
    processing: [],
    feeds: structuredClone(DEFAULT_FEEDS),
  });
});

const byId = (id: string) => st().sites.find((x) => x.id === id)!;

describe('moveSite', () => {
  test('relocates a site and appends it at the tail of the destination group', () => {
    st().moveSite('a', 'c2', null); // into c2 General, which already has D(order 0)
    const a = byId('a');
    expect(a.categoryId).toBe('c2');
    expect(a.subcategoryId).toBeNull();
    expect(a.order).toBe(1); // tail after D
    // other sites untouched
    expect(byId('d').order).toBe(0);
  });

  test('can move a General site into a subcategory', () => {
    st().moveSite('c', 'c1', 's1'); // s1 has A(0), B(1) → C lands at 2
    const c = byId('c');
    expect(c.subcategoryId).toBe('s1');
    expect(c.order).toBe(2);
  });
});

describe('reorder', () => {
  test('re-indexes only the ids passed, preserving their given order', () => {
    st().reorder('site', ['b', 'a']); // flip within s1
    expect(byId('b').order).toBe(0);
    expect(byId('a').order).toBe(1);
    // sites not named keep their order
    expect(byId('c').order).toBe(0);
    expect(byId('d').order).toBe(0);
  });

  test('reorders categories', () => {
    st().reorder('category', ['c2', 'c1']);
    expect(st().categories.find((c) => c.id === 'c2')!.order).toBe(0);
    expect(st().categories.find((c) => c.id === 'c1')!.order).toBe(1);
  });

  test('reorders quick links', () => {
    st().reorder('quickLink', ['q2', 'q1']);
    expect(st().quickLinks.find((q) => q.id === 'q2')!.order).toBe(0);
    expect(st().quickLinks.find((q) => q.id === 'q1')!.order).toBe(1);
  });
});

describe('delete cascades', () => {
  test('deleting a category removes its subcategories and sites', () => {
    st().deleteCategory('c1');
    expect(st().categories.map((c) => c.id)).toEqual(['c2']);
    expect(st().subcategories).toHaveLength(0); // s1, s2 gone
    expect(st().sites.map((s) => s.id)).toEqual(['d']); // a, b, c gone
  });

  test('deleting a subcategory sends its sites to the recycle bin', () => {
    st().deleteSubcategory('s1');
    expect(st().subcategories.map((s) => s.id)).toEqual(['s2']);
    expect(st().sites.map((s) => s.id).sort()).toEqual(['c', 'd']);
    expect(st().trash.sites.map((t) => t.id).sort()).toEqual(['a', 'b']);
    // restoring now lands in the category's General group
    st().restoreSite('b');
    expect(byId('b')).toMatchObject({ categoryId: 'c1', subcategoryId: null, primary: true });
  });

  test('undoing a subcategory delete brings it and its sites back', () => {
    const sub = st().subcategories.find((s) => s.id === 's1')!;
    st().deleteSubcategory('s1');
    st().reinsertSubcategory(sub);
    st().restoreSite('a', 'c1', 's1');
    st().restoreSite('b', 'c1', 's1');
    expect(st().subcategories.map((s) => s.id).sort()).toEqual(['s1', 's2']);
    expect([byId('a').subcategoryId, byId('b').subcategoryId]).toEqual(['s1', 's1']);
    expect(st().trash.sites.some((t) => t.id === 'a' || t.id === 'b')).toBe(false);
  });
});

describe('togglePrimary', () => {
  test('flips the primary flag both ways', () => {
    expect(byId('a').primary).toBe(false);
    st().togglePrimary('a');
    expect(byId('a').primary).toBe(true);
    st().togglePrimary('a');
    expect(byId('a').primary).toBe(false);
  });
});

describe('recordVisit', () => {
  test('increments visits and stamps lastVisited', () => {
    const before = Date.now();
    st().recordVisit('a');
    const a = byId('a');
    expect(a.visits).toBe(1);
    expect(a.lastVisited).not.toBeNull();
    expect(a.lastVisited!).toBeGreaterThanOrEqual(before);
  });
});

describe('migrate', () => {
  test('normalizes an empty blob to a valid current-schema state', () => {
    const out = migrate({}, 0);
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.categories).toEqual([]);
    expect(out.subcategories).toEqual([]);
    expect(out.sites).toEqual([]);
    expect(out.quickLinks).toEqual([]);
    expect(out.settings).toEqual(DEFAULT_SETTINGS);
  });

  test('preserves provided collections and backfills missing settings', () => {
    const out = migrate(
      {
        categories: [{ id: 'x', name: 'X', color: '#fff', order: 0 }],
        settings: { clock24h: true },
      },
      0,
    );
    expect(out.categories).toHaveLength(1);
    expect(out.settings.clock24h).toBe(true); // provided
    expect(out.settings.accentColor).toBe(DEFAULT_SETTINGS.accentColor); // defaulted
    expect(out.settings.overlayOpacity).toBe(DEFAULT_SETTINGS.overlayOpacity);
  });

  test('coerces garbage input into a safe empty state', () => {
    expect(normalizePersisted(null).categories).toEqual([]);
    expect(normalizePersisted('nope').sites).toEqual([]);
    // non-array collection fields are discarded, not trusted
    expect(normalizePersisted({ sites: 'oops' }).sites).toEqual([]);
  });
});

describe('export / import roundtrip', () => {
  test('exportState → importState restores the same data', () => {
    const json = st().exportState();
    // wreck the live state
    st().deleteCategory('c1');
    st().deleteCategory('c2');
    expect(st().sites).toHaveLength(0);

    const result = st().importState(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toEqual({
        categories: 2,
        subcategories: 2,
        sites: 4,
        quickLinks: 2,
        todos: 0,
        processing: 0,
      });
    }
    expect(st().sites.map((s) => s.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(st().categories).toHaveLength(2);
  });

  test('importState rejects non-JSON and malformed payloads', () => {
    expect(st().importState('{not json')).toEqual({
      ok: false,
      error: 'File is not valid JSON.',
    });
    const bad = st().importState(JSON.stringify({ categories: [] })); // no sites array
    expect(bad.ok).toBe(false);
  });
});

describe('resetToSeed', () => {
  test('replaces state with the seed deck', () => {
    st().resetToSeed();
    // seed has 10+ categories (13 total) and 200+ sites (336 total)
    expect(st().categories.length).toBeGreaterThanOrEqual(10);
    expect(st().sites.length).toBeGreaterThanOrEqual(200);
  });
});


describe('schema v2 migration', () => {
  const v1Blob = {
    schemaVersion: 1,
    categories: [{ id: 'x', name: 'X', color: '#fff', order: 0 }],
    subcategories: [],
    sites: [],
    quickLinks: [],
    settings: { accentColor: '#123456', clock24h: true, greetingName: 'Ada' },
  };

  test('v1 data survives untouched and every v2 field gets its default', () => {
    const out = migrate(v1Blob, 1);
    expect(out.schemaVersion).toBe(2);
    expect(out.categories).toEqual(v1Blob.categories);
    expect(out.settings.accentColor).toBe('#123456');
    expect(out.settings.greetingName).toBe('Ada');
    expect(out.settings.clockStyle).toBe('dseg7');
    expect(out.settings.autoQuickLinkCount).toBe(6);
    expect(out.pinnedCategoryId).toBeNull();
    expect(out.todos).toEqual([]);
    expect(out.processing).toEqual([]);
    expect(out.feeds).toEqual(DEFAULT_FEEDS);
  });

  test('invalid v2 settings are coerced back into range', () => {
    const out = migrate(
      { ...v1Blob, settings: { clockStyle: 'sundial', autoQuickLinkCount: 99 } },
      2,
    );
    expect(out.settings.clockStyle).toBe('dseg7');
    expect(out.settings.autoQuickLinkCount).toBe(15);
  });

  test('drops a pin that points at a missing category', () => {
    expect(migrate({ ...v1Blob, pinnedCategoryId: 'ghost' }, 2).pinnedCategoryId).toBeNull();
    expect(migrate({ ...v1Blob, pinnedCategoryId: 'x' }, 2).pinnedCategoryId).toBe('x');
  });

  test('a time without a date is discarded on load', () => {
    const out = migrate(
      { ...v1Blob, todos: [{ id: 't', text: 'T', dueDate: null, dueTime: '10:00' }, { bad: 1 }] },
      2,
    );
    expect(out.todos).toHaveLength(1);
    expect(out.todos[0].dueTime).toBeNull();
    expect(out.todos[0].archivedAt).toBeNull();
  });
});

describe('single-card pinning', () => {
  test('pinning a second card replaces the first; order is untouched', () => {
    st().pinCategory('c1');
    st().pinCategory('c2');
    expect(st().pinnedCategoryId).toBe('c2');
    expect(st().categories.map((c) => c.order)).toEqual([0, 1]);
    st().pinCategory(null);
    expect(st().pinnedCategoryId).toBeNull();
  });

  test('ignores unknown ids and clears the pin when its category is deleted', () => {
    st().pinCategory('nope');
    expect(st().pinnedCategoryId).toBeNull();
    st().pinCategory('c1');
    st().deleteCategory('c1');
    expect(st().pinnedCategoryId).toBeNull();
  });
});

describe('to-dos', () => {
  test('add → complete archives → restore returns it to the tail', () => {
    const a = st().addTodo({ text: 'a' });
    const b = st().addTodo({ text: 'b', dueDate: '2026-10-20', dueTime: '18:00' });
    expect(b.dueTime).toBe('18:00');
    st().completeTodo(a.id);
    expect(st().todos.find((t) => t.id === a.id)!.archivedAt).not.toBeNull();
    st().restoreTodo(a.id);
    const restored = st().todos.find((t) => t.id === a.id)!;
    expect(restored.archivedAt).toBeNull();
    expect(restored.order).toBeGreaterThan(b.order);
  });

  test('clearing the date also clears the time', () => {
    const t = st().addTodo({ text: 't', dueDate: '2026-10-20', dueTime: '09:00' });
    st().updateTodo(t.id, { dueDate: null });
    expect(st().todos[0].dueTime).toBeNull();
    expect(st().addTodo({ text: 'u', dueTime: '09:00' }).dueTime).toBeNull();
  });

  test('purge removes only archived items', () => {
    const a = st().addTodo({ text: 'a' });
    st().addTodo({ text: 'b' });
    st().completeTodo(a.id);
    st().purgeArchivedTodos();
    expect(st().todos.map((t) => t.text)).toEqual(['b']);
  });
});

describe('v2 export / import', () => {
  test('export never contains the GitHub token', () => {
    st().updateSettings({ githubToken: 'ghp_secret' });
    expect(st().exportState()).not.toContain('ghp_secret');
  });

  test('importing a v1 backup keeps current to-dos and the local token', () => {
    st().addTodo({ text: 'keep me' });
    st().updateSettings({ githubToken: 'ghp_local' });
    const v1 = JSON.stringify({
      schemaVersion: 1,
      categories: [{ id: 'x', name: 'X', color: '#fff', order: 0 }],
      sites: [],
      settings: {},
    });
    expect(st().importState(v1).ok).toBe(true);
    expect(st().todos.map((t) => t.text)).toEqual(['keep me']);
    expect(st().settings.githubToken).toBe('ghp_local');
  });

  test('reseedLibrary replaces bookmarks but keeps to-dos and settings', () => {
    st().addTodo({ text: 'survivor' });
    st().updateSettings({ greetingName: 'Ada' });
    st().reseedLibrary();
    expect(st().categories.length).toBeGreaterThanOrEqual(10);
    expect(st().todos.map((t) => t.text)).toEqual(['survivor']);
    expect(st().settings.greetingName).toBe('Ada');
  });
});

test('clearRecentHistory forgets lastVisited but keeps visit counts', () => {
  st().recordVisit('a');
  st().clearRecentHistory();
  expect(byId('a').lastVisited).toBeNull();
  expect(byId('a').visits).toBe(1);
});

describe('feeds config', () => {
  test('topic and source CRUD, and reset to defaults', () => {
    const t = st().addTopic({ label: '#Rust', query: 'rust,cargo' });
    expect(t.label).toBe('Rust');
    st().updateTopic(t.id, { label: '#Systems' });
    expect(st().feeds.topics.at(-1)!.label).toBe('Systems');

    const src = st().addFeedSource({ name: 'Blog', kind: 'rss', url: 'https://b.dev/feed', category: 'news' });
    expect(src.enabled).toBe(true);
    st().updateFeedSource(src.id, { enabled: false });
    expect(st().feeds.sources.find((s) => s.id === src.id)!.enabled).toBe(false);
    st().deleteFeedSource(src.id);
    st().deleteTopic(t.id);
    expect(st().feeds.sources.some((s) => s.id === src.id)).toBe(false);

    st().resetFeeds();
    expect(st().feeds).toEqual(DEFAULT_FEEDS);
  });
});

describe('placeSite (Site Map / Bookmarks reorder)', () => {
  it('moves a site before another in the same section, and into another section', () => {
    const s = useStore.getState();
    const cat = s.addCategory({ name: 'Order test', color: '#ff0000' });
    const a = s.addSite({ name: 'A', url: 'https://a.dev', categoryId: cat.id, subcategoryId: null });
    const b = s.addSite({ name: 'B', url: 'https://b.dev', categoryId: cat.id, subcategoryId: null });
    const c = s.addSite({ name: 'C', url: 'https://c.dev', categoryId: cat.id, subcategoryId: null });
    const names = () =>
      useStore
        .getState()
        .sites.filter((x) => x.categoryId === cat.id && x.subcategoryId === null)
        .sort((x, y) => x.order - y.order)
        .map((x) => x.name)
        .join('');
    useStore.getState().placeSite(c.id, cat.id, null, a.id);
    expect(names()).toBe('CAB');
    useStore.getState().placeSite(c.id, cat.id, null, null);
    expect(names()).toBe('ABC');
    const sub = useStore.getState().addSubcategory({ name: 'Sub', categoryId: cat.id });
    useStore.getState().placeSite(b.id, cat.id, sub.id, null);
    expect(names()).toBe('AC');
    expect(useStore.getState().sites.find((x) => x.id === b.id)?.subcategoryId).toBe(sub.id);
  });
});

describe('restoreSite — back to where it came from', () => {
  const where = (id: string) => {
    const s = st().sites.find((x) => x.id === id);
    return s && [s.categoryId, s.subcategoryId];
  };
  test('its subcategory still exists → back into it', () => {
    st().deleteSite('a');
    st().restoreSite('a');
    expect(where('a')).toEqual(['c1', 's1']);
    expect(st().trash.sites.some((t) => t.id === 'a')).toBe(false);
  });
  test('subcategory deleted, category kept → the category\'s General group', () => {
    st().deleteSite('a');
    st().deleteSubcategory('s1');
    st().restoreSite('a');
    expect(where('a')).toEqual(['c1', null]);
  });
  test('category deleted → Uncategorized (no category, no subcategory)', () => {
    st().deleteCategory('c1');
    st().restoreSite('a');
    expect(where('a')).toEqual(['', null]);
  });
  test('an explicit target still wins', () => {
    st().deleteSite('a');
    st().restoreSite('a', 'c2', null);
    expect(where('a')).toEqual(['c2', null]);
  });
});
