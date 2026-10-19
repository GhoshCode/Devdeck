import { FIRST_SECTION } from '../types';
import { create } from 'zustand';
import { buildDemoData, isDemo } from '../lib/demoData';
import { REPEAT_LABEL, nextRepeatDate } from '../lib/todos';
import { normalizeTimer, type TimerUnit } from '../lib/timer';
import { persist } from 'zustand/middleware';
import type {
  Category,
  FeedSource,
  FeedsConfig,
  ImportResult,
  PersistedState,
  ProcessingItem,
  QuickLink,
  ReorderKind,
  Schedule,
  Settings,
  Site,
  Subcategory,
  Priority,
  Repeat,
  TrashedSite,
  TrashedProcessing,
  Todo,
  Topic,
} from '../types';
import { SCHEMA_VERSION } from '../types';
import {
  DEFAULT_FEEDS,
  DEFAULT_SETTINGS,
  getSeedState,
  getBenchmark200State,
} from './seed';

export { SCHEMA_VERSION };

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

const toArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

import { CLOCK_STYLES } from '../lib/clockStyles';

const clamp = (n: unknown, min: number, max: number, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

// Settings arrive from localStorage or an imported file, so every v2 field is
// re-validated rather than trusted; unknown values fall back to defaults.
function normalizeSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(asRecord(raw) as Partial<Settings>) };
  return {
    ...s,
    // Retired faces (glass-pro, glass-classic, organic…) fall back to the default.
    clockStyle: CLOCK_STYLES.includes(s.clockStyle) ? s.clockStyle : DEFAULT_SETTINGS.clockStyle,
    autoQuickLinkCount: clamp(s.autoQuickLinkCount, 2, 12, DEFAULT_SETTINGS.autoQuickLinkCount),
    recentLinkCount: clamp(s.recentLinkCount, 0, 24, DEFAULT_SETTINGS.recentLinkCount),
    githubUsername: typeof s.githubUsername === 'string' ? s.githubUsername.trim() : '',
    githubToken: typeof s.githubToken === 'string' ? s.githubToken : '',
    manualCity: typeof s.manualCity === 'string' ? s.manualCity : '',
  };
}

const normalizeTodo = (raw: unknown, i: number): Todo | null => {
  const t = asRecord(raw);
  if (typeof t.id !== 'string' || typeof t.text !== 'string') return null;
  const dueDate = typeof t.dueDate === 'string' && t.dueDate ? t.dueDate : null;
  return {
    id: t.id,
    text: t.text,
    dueDate,
    // A time without a date has no meaning in the single-attachment model.
    dueTime: dueDate && typeof t.dueTime === 'string' && t.dueTime ? t.dueTime : null,
    createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
    order: typeof t.order === 'number' ? t.order : i,
    archivedAt: typeof t.archivedAt === 'number' ? t.archivedAt : null,
    priority: t.priority === 1 || t.priority === 2 || t.priority === 3 ? t.priority : 0,
    tags: toArray<unknown>(t.tags).filter((x): x is string => typeof x === 'string'),
    notes: typeof t.notes === 'string' ? t.notes : '',
    subtasks: toArray<unknown>(t.subtasks)
      .map(asRecord)
      .filter((x) => typeof x.id === 'string' && typeof x.text === 'string')
      .map((x) => ({ id: x.id as string, text: x.text as string, done: x.done === true })),
    repeat: dueDate && typeof t.repeat === 'string' && t.repeat in REPEAT_LABEL ? (t.repeat as Repeat) : null,
    timer: normalizeTimer(t.timer, typeof t.createdAt === 'number' ? t.createdAt : Date.now()),
  };
};

const thisMonth = (): string => new Date().toISOString().slice(0, 7);

export const defaultSchedule = (): Schedule => ({
  enabled: false,
  frequency: 'daily',
  daysOfWeek: [1, 2, 3, 4, 5],
  timeOfDay: '09:00',
  interval: 1,
  dayOfMonth: new Date().getDate(),
  from: thisMonth(),
  to: thisMonth(),
});

const normalizeProcessing = (raw: unknown, i: number): ProcessingItem | null => {
  const p = asRecord(raw);
  if (typeof p.id !== 'string' || typeof p.url !== 'string') return null;
  return {
    id: p.id,
    name: typeof p.name === 'string' ? p.name : p.url,
    url: p.url,
    siteId: typeof p.siteId === 'string' ? p.siteId : null,
    // The top section used to be called "Focus"; saved items move to the new name.
    section: typeof p.section === 'string' && p.section && p.section !== 'Focus' ? p.section : FIRST_SECTION,
    order: typeof p.order === 'number' ? p.order : i,
    schedule: { ...defaultSchedule(), ...(asRecord(p.schedule) as Partial<Schedule>) },
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : undefined,
    timer: normalizeTimer(p.timer, typeof p.createdAt === 'number' ? p.createdAt : Date.now()),
  };
};

function normalizeFeeds(raw: unknown): FeedsConfig {
  const f = asRecord(raw);
  return {
    topics: Array.isArray(f.topics) ? (f.topics as Topic[]) : structuredClone(DEFAULT_FEEDS.topics),
    sources: Array.isArray(f.sources)
      ? (f.sources as FeedsConfig['sources'])
      : structuredClone(DEFAULT_FEEDS.sources),
  };
}

const notNull = <T>(x: T | null): x is T => x !== null;

export function normalizePersisted(input: unknown): PersistedState {
  const obj = asRecord(input);
  const categories = toArray<Category>(obj.categories);
  const pinned = typeof obj.pinnedCategoryId === 'string' ? obj.pinnedCategoryId : null;
  return {
    schemaVersion: SCHEMA_VERSION,
    categories,
    subcategories: toArray<Subcategory>(obj.subcategories),
    sites: toArray<Site>(obj.sites),
    quickLinks: toArray<QuickLink>(obj.quickLinks),
    settings: normalizeSettings(obj.settings),
    // A pin pointing at a deleted category is dropped, never left dangling.
    pinnedCategoryId: pinned && categories.some((c) => c.id === pinned) ? pinned : null,
    todos: toArray<unknown>(obj.todos).map(normalizeTodo).filter(notNull),
    processing: toArray<unknown>(obj.processing).map(normalizeProcessing).filter(notNull),
    feeds: normalizeFeeds(obj.feeds),
    trash: {
      sites: toArray<TrashedSite>(asRecord(obj.trash).sites).filter((x) => x && typeof x.id === 'string' && typeof x.url === 'string'),
      processing: toArray<TrashedProcessing>(asRecord(obj.trash).processing).filter((x) => x && typeof x.id === 'string'),
    },
  };
}

// v1 → v2 is purely additive: normalizePersisted fills every new collection
// and setting with its default, so no v1 data is rewritten or dropped.
export function migrate(persisted: unknown, fromVersion: number): PersistedState {
  void fromVersion;
  return normalizePersisted(persisted);
}

const STORAGE_KEY = 'devdeck';

// Stable-ish unique id. crypto.randomUUID exists in every target (browser, and
// Node/jsdom under Vitest); the suffix fallback keeps tests hermetic if not.
const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const nextOrder = (items: ReadonlyArray<{ order: number }>): number =>
  items.reduce((max, i) => (i.order > max ? i.order : max), -1) + 1;

// ---- Action input shapes (ids/order/derived fields are generated) ----------

export type NewCategory = { name: string; color: string };
export type NewSubcategory = { name: string; categoryId: string };
export type NewSite = {
  name: string;
  url: string;
  categoryId: string;
  subcategoryId: string | null;
  primary?: boolean;
};
export type NewQuickLink = { name: string; url: string };
export type NewTodo = {
  text: string;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: Priority;
  tags?: string[];
  repeat?: Repeat | null;
  timer?: { amount: number; unit: TimerUnit } | null; // starts when the task is created
};
export type NewProcessingItem = {
  name: string;
  url: string;
  siteId?: string | null;
  section?: string;
  schedule?: Partial<Schedule>;
};
export type NewTopic = { label: string; query: string };
export type NewFeedSource = Omit<FeedSource, 'id' | 'enabled'> & { enabled?: boolean };

export interface StoreActions {
  // Category CRUD
  addCategory: (input: NewCategory) => Category;
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void;
  deleteCategory: (id: string) => void;
  // Subcategory CRUD
  addSubcategory: (input: NewSubcategory) => Subcategory;
  updateSubcategory: (id: string, patch: Partial<Omit<Subcategory, 'id'>>) => void;
  deleteSubcategory: (id: string) => void;
  // Site CRUD
  addSite: (input: NewSite) => Site;
  updateSite: (id: string, patch: Partial<Omit<Site, 'id'>>) => void;
  deleteSite: (id: string) => void; // → trash
  restoreSite: (id: string, categoryId?: string, subcategoryId?: string | null) => void;
  purgeTrash: (what: { sites?: boolean; processing?: boolean }) => void;
  // Quick link CRUD
  addQuickLink: (input: NewQuickLink) => QuickLink;
  updateQuickLink: (id: string, patch: Partial<Omit<QuickLink, 'id'>>) => void;
  deleteQuickLink: (id: string) => void;
  // Movement / ordering / flags
  moveSite: (siteId: string, categoryId: string, subcategoryId: string | null) => void;
  // Site Map / Bookmarks: put a site into a section, just before another site (or last).
  placeSite: (siteId: string, categoryId: string, subcategoryId: string | null, beforeSiteId: string | null) => void;
  reorder: (kind: ReorderKind, ids: string[]) => void;
  togglePrimary: (siteId: string) => void;
  recordVisit: (siteId: string) => void;
  // Forgets every lastVisited (empties the Recent strip); visit counts stay.
  clearRecentHistory: () => void;
  // Settings
  updateSettings: (patch: Partial<Settings>) => void;
  // Single-card pin (§7 Q6): pinning replaces any previous pin; null unpins.
  pinCategory: (id: string | null) => void;
  // To-dos
  addTodo: (input: NewTodo) => Todo;
  updateTodo: (
    id: string,
    patch: Partial<Pick<Todo, 'text' | 'dueDate' | 'dueTime' | 'priority' | 'tags' | 'notes' | 'subtasks' | 'timer'>>,
  ) => void;
  completeTodo: (id: string) => void; // bullet click → archived
  restoreTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  reinsertTodo: (todo: Todo) => void; // undo a delete: back in its old place
  purgeArchivedTodos: () => void;
  // Currently Processing (D)
  addProcessingItem: (input: NewProcessingItem) => ProcessingItem;
  updateProcessingItem: (id: string, patch: Partial<Omit<ProcessingItem, 'id'>>) => void;
  deleteProcessingItem: (id: string) => void;
  reinsertProcessingItem: (item: ProcessingItem) => void; // undo a delete
  // Feed topics (J)
  addTopic: (input: NewTopic) => Topic;
  updateTopic: (id: string, patch: Partial<Omit<Topic, 'id'>>) => void;
  deleteTopic: (id: string) => void;
  // Feed sources (I)
  addFeedSource: (input: NewFeedSource) => FeedSource;
  updateFeedSource: (id: string, patch: Partial<Omit<FeedSource, 'id'>>) => void;
  deleteFeedSource: (id: string) => void;
  resetFeeds: () => void;
  // Data
  importState: (json: string) => ImportResult;
  exportState: () => string;
  resetToSeed: () => void;
  // Replaces only the bookmark library with the seed, keeping settings, to-dos,
  // processing items and feeds — used by the "fewer than 10 categories" upgrade.
  reseedLibrary: () => void;
  loadBenchmark200: () => void;
  // Settings → Data
  loadDemoData: () => void; // adds demo-* Focus/Queue sites, to-dos, topics and feed sources
  clearDemoData: () => void;
  clearData: (what: { deletedSites?: boolean; removedProcessing?: boolean; completedTodos?: boolean; demo?: boolean }) => void;
}

export type Store = PersistedState & StoreActions;

// Pull just the persisted slice out of the live store (used by export/persist).
// The bin keeps the most recent 500 of each kind.
const capTrash = <T,>(list: T[]): T[] => list.slice(0, 500);
const toTrash = (s: Store, site: Site): TrashedSite => ({
  ...site,
  deletedAt: Date.now(),
  fromCategory: s.categories.find((c) => c.id === site.categoryId)?.name ?? '',
  fromSubcategory: s.subcategories.find((x) => x.id === site.subcategoryId)?.name ?? null,
});

const pickPersisted = (s: Store): PersistedState => ({
  schemaVersion: s.schemaVersion,
  categories: s.categories,
  subcategories: s.subcategories,
  sites: s.sites,
  quickLinks: s.quickLinks,
  settings: s.settings,
  pinnedCategoryId: s.pinnedCategoryId,
  todos: s.todos,
  processing: s.processing,
  feeds: s.feeds,
  trash: s.trash,
});

// The seed's bookmark library only — no settings and no v2 collections.
const seedLibrary = () => {
  const { categories, subcategories, sites, quickLinks } = getSeedState();
  return { categories, subcategories, sites, quickLinks, pinnedCategoryId: null };
};

// Re-index `order` (0..n-1) for the items named in `ids`, preserving that
// order; items not named are left untouched.
const applyOrder = <T extends { id: string; order: number }>(
  items: T[],
  ids: string[],
): T[] => {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return items.map((item) =>
    rank.has(item.id) ? { ...item, order: rank.get(item.id)! } : item,
  );
};

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...getSeedState(),

      // ---- Categories ----------------------------------------------------
      addCategory: ({ name, color }) => {
        const category: Category = {
          id: newId(),
          name,
          color,
          order: nextOrder(get().categories),
        };
        set((s) => ({ categories: [...s.categories, category] }));
        return category;
      },
      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      // Cascades: removing a category removes its subcategories and sites too.
      // A deleted category's sites go to the trash, so they can be restored.
      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          subcategories: s.subcategories.filter((sc) => sc.categoryId !== id),
          sites: s.sites.filter((site) => site.categoryId !== id),
          pinnedCategoryId: s.pinnedCategoryId === id ? null : s.pinnedCategoryId,
          trash: { ...s.trash, sites: capTrash([...s.sites.filter((site) => site.categoryId === id).map((site) => toTrash(s, site)), ...s.trash.sites]) },
        })),
      pinCategory: (id) =>
        set((s) => ({
          pinnedCategoryId: id && s.categories.some((c) => c.id === id) ? id : null,
        })),

      // ---- Subcategories -------------------------------------------------
      addSubcategory: ({ name, categoryId }) => {
        const sub: Subcategory = {
          id: newId(),
          name,
          categoryId,
          order: nextOrder(get().subcategories.filter((sc) => sc.categoryId === categoryId)),
        };
        set((s) => ({ subcategories: [...s.subcategories, sub] }));
        return sub;
      },
      updateSubcategory: (id, patch) =>
        set((s) => ({
          subcategories: s.subcategories.map((sc) =>
            sc.id === id ? { ...sc, ...patch } : sc,
          ),
        })),
      // Deleting a subcategory moves its sites to the category's General group
      // (subcategoryId = null), appended after any existing General sites.
      deleteSubcategory: (id) =>
        set((s) => {
          const target = s.subcategories.find((sc) => sc.id === id);
          if (!target) return {};
          let generalTail = nextOrder(
            s.sites.filter(
              (site) => site.categoryId === target.categoryId && site.subcategoryId === null,
            ),
          );
          const sites = s.sites.map((site) =>
            site.subcategoryId === id
              ? { ...site, subcategoryId: null, order: generalTail++ }
              : site,
          );
          return {
            subcategories: s.subcategories.filter((sc) => sc.id !== id),
            sites,
          };
        }),

      // ---- Sites ---------------------------------------------------------
      addSite: ({ name, url, categoryId, subcategoryId, primary = false }) => {
        const site: Site = {
          id: newId(),
          name,
          url,
          categoryId,
          subcategoryId,
          primary,
          order: nextOrder(
            get().sites.filter(
              (s) => s.categoryId === categoryId && s.subcategoryId === subcategoryId,
            ),
          ),
          visits: 0,
          lastVisited: null,
        };
        set((s) => ({ sites: [...s.sites, site] }));
        return site;
      },
      updateSite: (id, patch) =>
        set((s) => ({
          sites: s.sites.map((site) => (site.id === id ? { ...site, ...patch } : site)),
        })),
      deleteSite: (id) =>
        set((s) => {
          const site = s.sites.find((x) => x.id === id);
          if (!site) return {};
          return { sites: s.sites.filter((x) => x.id !== id), trash: { ...s.trash, sites: capTrash([toTrash(s, site), ...s.trash.sites]) } };
        }),
      // Back from the bin: into the given section, else where it came from,
      // else the first category's General group.
      restoreSite: (id, categoryId, subcategoryId = null) =>
        set((s) => {
          const t = s.trash.sites.find((x) => x.id === id);
          if (!t) return {};
          const { deletedAt: _d, fromCategory: _c, fromSubcategory: _sc, ...site } = t;
          // An explicit target wins ('' = Uncategorized). Otherwise the site goes
          // back where it came from: its subcategory, or the category's General
          // group if that subcategory is gone, or Uncategorized if the category
          // itself is gone.
          let cat: string;
          let sub: string | null;
          if (categoryId !== undefined && (categoryId === '' || s.categories.some((c) => c.id === categoryId))) {
            cat = categoryId;
            sub = cat && s.subcategories.some((x) => x.id === subcategoryId && x.categoryId === cat) ? subcategoryId : null;
          } else if (s.categories.some((c) => c.id === site.categoryId)) {
            cat = site.categoryId;
            sub = s.subcategories.some((x) => x.id === site.subcategoryId && x.categoryId === cat) ? site.subcategoryId : null;
          } else {
            cat = '';
            sub = null;
          }
          const order = nextOrder(s.sites.filter((x) => x.categoryId === cat && x.subcategoryId === sub));
          return {
            sites: [...s.sites, { ...site, categoryId: cat, subcategoryId: sub, order }],
            trash: { ...s.trash, sites: s.trash.sites.filter((x) => x.id !== id) },
          };
        }),
      purgeTrash: (what) =>
        set((s) => ({
          trash: {
            sites: what.sites ? [] : s.trash.sites,
            processing: what.processing ? [] : s.trash.processing,
          },
        })),

      // ---- Quick links ---------------------------------------------------
      addQuickLink: ({ name, url }) => {
        const link: QuickLink = {
          id: newId(),
          name,
          url,
          order: nextOrder(get().quickLinks),
        };
        set((s) => ({ quickLinks: [...s.quickLinks, link] }));
        return link;
      },
      updateQuickLink: (id, patch) =>
        set((s) => ({
          quickLinks: s.quickLinks.map((q) => (q.id === id ? { ...q, ...patch } : q)),
        })),
      deleteQuickLink: (id) =>
        set((s) => ({ quickLinks: s.quickLinks.filter((q) => q.id !== id) })),

      // ---- Movement / ordering / flags -----------------------------------
      // Move a site to a new category/subcategory, appended at the tail of the
      // destination group so it lands predictably.
      moveSite: (siteId, categoryId, subcategoryId) =>
        set((s) => {
          const order = nextOrder(
            s.sites.filter(
              (site) => site.categoryId === categoryId && site.subcategoryId === subcategoryId,
            ),
          );
          return {
            sites: s.sites.map((site) =>
              site.id === siteId ? { ...site, categoryId, subcategoryId, order } : site,
            ),
          };
        }),
      placeSite: (siteId, categoryId, subcategoryId, beforeSiteId) =>
        set((s) => {
          const site = s.sites.find((x) => x.id === siteId);
          if (!site || beforeSiteId === siteId) return s;
          const section = s.sites
            .filter((x) => x.categoryId === categoryId && x.subcategoryId === subcategoryId && x.id !== siteId)
            .sort((a, b) => a.order - b.order);
          const at = beforeSiteId ? section.findIndex((x) => x.id === beforeSiteId) : -1;
          const ids = section.map((x) => x.id);
          ids.splice(at < 0 ? ids.length : at, 0, siteId);
          const rank = new Map(ids.map((id, i) => [id, i]));
          return {
            sites: s.sites.map((x) =>
              x.id === siteId
                ? { ...x, categoryId, subcategoryId, order: rank.get(x.id)! }
                : rank.has(x.id)
                  ? { ...x, order: rank.get(x.id)! }
                  : x,
            ),
          };
        }),
      reorder: (kind, ids) =>
        set((s) => {
          switch (kind) {
            case 'category':
              return { categories: applyOrder(s.categories, ids) };
            case 'subcategory':
              return { subcategories: applyOrder(s.subcategories, ids) };
            case 'site':
              return { sites: applyOrder(s.sites, ids) };
            case 'quickLink':
              return { quickLinks: applyOrder(s.quickLinks, ids) };
            case 'todo':
              return { todos: applyOrder(s.todos, ids) };
            case 'processing':
              return { processing: applyOrder(s.processing, ids) };
            default:
              return {};
          }
        }),
      togglePrimary: (siteId) =>
        set((s) => ({
          sites: s.sites.map((site) =>
            site.id === siteId ? { ...site, primary: !site.primary } : site,
          ),
        })),
      recordVisit: (siteId) =>
        set((s) => ({
          sites: s.sites.map((site) =>
            site.id === siteId
              ? { ...site, visits: site.visits + 1, lastVisited: Date.now() }
              : site,
          ),
        })),
      clearRecentHistory: () =>
        set((s) => ({ sites: s.sites.map((site) => ({ ...site, lastVisited: null })) })),

      // ---- Settings ------------------------------------------------------
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      // ---- To-dos --------------------------------------------------------
      addTodo: ({ text, dueDate = null, dueTime = null, priority = 0, tags = [], repeat = null, timer = null }) => {
        const createdAt = Date.now();
        const todo: Todo = {
          id: newId(),
          text,
          dueDate: dueDate || null,
          dueTime: dueDate && dueTime ? dueTime : null,
          createdAt,
          order: nextOrder(get().todos),
          archivedAt: null,
          priority,
          tags,
          notes: '',
          subtasks: [],
          repeat: dueDate ? repeat : null,
          timer: timer ? { ...timer, start: createdAt } : null,
        };
        set((s) => ({ todos: [...s.todos, todo] }));
        return todo;
      },
      updateTodo: (id, patch) =>
        set((s) => ({
          todos: s.todos.map((t) => {
            if (t.id !== id) return t;
            const next = { ...t, ...patch };
            if (!next.dueDate) next.dueTime = null;
            return next;
          }),
        })),
      // A repeating task moves on to its next date (subtasks reset) instead
      // of being archived.
      completeTodo: (id) =>
        set((s) => ({
          todos: s.todos.map((t) => {
            if (t.id !== id) return t;
            const next = t.repeat ? nextRepeatDate(t, t.repeat, Date.now()) : null;
            if (next) return { ...t, dueDate: next, subtasks: (t.subtasks ?? []).map((x) => ({ ...x, done: false })) };
            return { ...t, archivedAt: Date.now() };
          }),
        })),
      // Restored items rejoin at the tail of the active list.
      restoreTodo: (id) =>
        set((s) => {
          const order = nextOrder(s.todos.filter((t) => t.archivedAt === null));
          return {
            todos: s.todos.map((t) => (t.id === id ? { ...t, archivedAt: null, order } : t)),
          };
        }),
      deleteTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),
      // Lists sort by `order`, so putting the same object back restores its place.
      reinsertTodo: (todo) => set((s) => (s.todos.some((t) => t.id === todo.id) ? s : { todos: [...s.todos, todo] })),
      purgeArchivedTodos: () =>
        set((s) => ({ todos: s.todos.filter((t) => t.archivedAt === null) })),

      // ---- Currently Processing -----------------------------------------
      addProcessingItem: ({ name, url, siteId = null, section = FIRST_SECTION, schedule }) => {
        const item: ProcessingItem = {
          id: newId(),
          name,
          url,
          siteId,
          section,
          order: nextOrder(get().processing),
          schedule: { ...defaultSchedule(), ...schedule },
          createdAt: Date.now(),
          timer: null,
        };
        set((s) => ({ processing: [...s.processing, item] }));
        return item;
      },
      updateProcessingItem: (id, patch) =>
        set((s) => ({
          processing: s.processing.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      deleteProcessingItem: (id) =>
        set((s) => {
          const item = s.processing.find((p) => p.id === id);
          if (!item) return {};
          return {
            processing: s.processing.filter((p) => p.id !== id),
            trash: { ...s.trash, processing: capTrash([{ ...item, deletedAt: Date.now() }, ...s.trash.processing]) },
          };
        }),
      reinsertProcessingItem: (item) =>
        set((s) =>
          s.processing.some((p) => p.id === item.id)
            ? s
            : { processing: [...s.processing, item], trash: { ...s.trash, processing: s.trash.processing.filter((p) => p.id !== item.id) } },
        ),

      // ---- Feed topics ---------------------------------------------------
      addTopic: ({ label, query }) => {
        const topic: Topic = { id: newId(), label: label.replace(/^#/, ''), query };
        set((s) => ({ feeds: { ...s.feeds, topics: [...s.feeds.topics, topic] } }));
        return topic;
      },
      updateTopic: (id, patch) =>
        set((s) => ({
          feeds: {
            ...s.feeds,
            topics: s.feeds.topics.map((t) =>
              t.id === id ? { ...t, ...patch, label: (patch.label ?? t.label).replace(/^#/, '') } : t,
            ),
          },
        })),
      deleteTopic: (id) =>
        set((s) => ({
          feeds: { ...s.feeds, topics: s.feeds.topics.filter((t) => t.id !== id) },
        })),

      // ---- Feed sources --------------------------------------------------
      addFeedSource: (input) => {
        const source: FeedSource = { id: newId(), enabled: true, ...input };
        set((s) => ({ feeds: { ...s.feeds, sources: [...s.feeds.sources, source] } }));
        return source;
      },
      updateFeedSource: (id, patch) =>
        set((s) => ({
          feeds: { ...s.feeds, sources: s.feeds.sources.map((src) => (src.id === id ? { ...src, ...patch } : src)) },
        })),
      deleteFeedSource: (id) =>
        set((s) => ({
          feeds: { ...s.feeds, sources: s.feeds.sources.filter((src) => src.id !== id) },
        })),
      resetFeeds: () => set(() => ({ feeds: structuredClone(DEFAULT_FEEDS) })),

      // ---- Data ----------------------------------------------------------
      importState: (json) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch {
          return { ok: false, error: 'File is not valid JSON.' };
        }
        if (!parsed || typeof parsed !== 'object') {
          return { ok: false, error: 'File does not contain a DevDeck backup.' };
        }
        const record = parsed as Record<string, unknown>;
        if (!Array.isArray(record.categories) || !Array.isArray(record.sites)) {
          return { ok: false, error: 'Backup is missing its categories or sites.' };
        }
        const fromVersion =
          typeof record.schemaVersion === 'number' ? record.schemaVersion : 0;
        const next = migrate(record, fromVersion);
        const cur = get();
        // A v1 backup has no to-dos/processing/feeds; keep the current ones
        // rather than silently wiping them. The PAT is never in a backup, so
        // the locally stored one survives an import too.
        set(() => ({
          ...next,
          todos: Array.isArray(record.todos) ? next.todos : cur.todos,
          processing: Array.isArray(record.processing) ? next.processing : cur.processing,
          feeds: record.feeds ? next.feeds : cur.feeds,
          settings: {
            ...next.settings,
            githubToken: next.settings.githubToken || cur.settings.githubToken,
          },
        }));
        const applied = get();
        return {
          ok: true,
          summary: {
            categories: applied.categories.length,
            subcategories: applied.subcategories.length,
            sites: applied.sites.length,
            quickLinks: applied.quickLinks.length,
            todos: applied.todos.length,
            processing: applied.processing.length,
          },
        };
      },
      // Exports never carry the GitHub token (plan §3).
      exportState: () => {
        const data = pickPersisted(get());
        return JSON.stringify(
          { ...data, settings: { ...data.settings, githubToken: '' } },
          null,
          2,
        );
      },
      resetToSeed: () => set(() => ({ ...getSeedState() })),
      reseedLibrary: () => set(() => seedLibrary()),
      loadDemoData: () =>
        set((s) => {
          const demo = buildDemoData();
          const keep = <T extends { id: string }>(list: T[]) => list.filter((x) => !isDemo(x.id));
          return {
            processing: [...keep(s.processing), ...demo.processing],
            todos: [...keep(s.todos), ...demo.todos],
            feeds: { topics: [...keep(s.feeds.topics), ...demo.topics], sources: [...keep(s.feeds.sources), ...demo.sources] },
          };
        }),
      clearDemoData: () =>
        set((s) => {
          const keep = <T extends { id: string }>(list: T[]) => list.filter((x) => !isDemo(x.id));
          return { processing: keep(s.processing), todos: keep(s.todos), feeds: { topics: keep(s.feeds.topics), sources: keep(s.feeds.sources) } };
        }),
      // Permanent: the chosen kinds are gone for good (no bin, no undo).
      clearData: (what) =>
        set((s) => {
          const keep = <T extends { id: string }>(list: T[]) => (what.demo ? list.filter((x) => !isDemo(x.id)) : list);
          return {
            trash: { sites: what.deletedSites ? [] : s.trash.sites, processing: what.removedProcessing ? [] : s.trash.processing },
            todos: keep(what.completedTodos ? s.todos.filter((t) => t.archivedAt === null) : s.todos),
            processing: keep(s.processing),
            feeds: { topics: keep(s.feeds.topics), sources: keep(s.feeds.sources) },
          };
        }),
      loadBenchmark200: () =>
        set((s) => ({ ...getBenchmark200State(), settings: s.settings, todos: s.todos, processing: s.processing, feeds: s.feeds })),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      // Persist only the data slice — never the action functions.
      partialize: (s): PersistedState => pickPersisted(s),
      migrate: (persisted, version) => migrate(persisted, version),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') {
          return current;
        }
        const p = normalizePersisted(persisted);
        // Automatically upgrade any legacy persisted deck with fewer than 10 categories
        // so users immediately receive the full 10+ categories and 200+ (300+) sites deck.
        // Only the library is replaced — to-dos, processing and feeds survive.
        if (p.categories.length < 10) {
          return {
            ...current,
            ...p,
            ...seedLibrary(),
          };
        }
        const obj = persisted as Record<string, unknown>;
        return {
          ...current,

          ...p,
          categories:
            Array.isArray(obj.categories) && obj.categories.length > 0
              ? p.categories
              : current.categories,
          subcategories:
            Array.isArray(obj.subcategories) && obj.subcategories.length > 0
              ? p.subcategories
              : current.subcategories,
          sites:
            Array.isArray(obj.sites) && obj.sites.length > 0
              ? p.sites
              : current.sites,
          quickLinks:
            Array.isArray(obj.quickLinks) && obj.quickLinks.length > 0
              ? p.quickLinks
              : current.quickLinks,
          settings: { ...current.settings, ...p.settings },
        };
      },
    },
  ),
);
