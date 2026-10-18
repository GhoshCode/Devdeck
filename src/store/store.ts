import { create } from 'zustand';
import { REPEAT_LABEL, nextRepeatDate } from '../lib/todos';
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
  };
};

const thisMonth = (): string => new Date().toISOString().slice(0, 7);

export const defaultSchedule = (): Schedule => ({
  enabled: false,
  frequency: 'daily',
  daysOfWeek: [1, 2, 3, 4, 5],
  timeOfDay: '09:00',
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
    section: typeof p.section === 'string' && p.section ? p.section : 'Focus',
    order: typeof p.order === 'number' ? p.order : i,
    schedule: { ...defaultSchedule(), ...(asRecord(p.schedule) as Partial<Schedule>) },
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
  deleteSite: (id: string) => void;
  // Quick link CRUD
  addQuickLink: (input: NewQuickLink) => QuickLink;
  updateQuickLink: (id: string, patch: Partial<Omit<QuickLink, 'id'>>) => void;
  deleteQuickLink: (id: string) => void;
  // Movement / ordering / flags
  moveSite: (siteId: string, categoryId: string, subcategoryId: string | null) => void;
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
    patch: Partial<Pick<Todo, 'text' | 'dueDate' | 'dueTime' | 'priority' | 'tags' | 'notes' | 'subtasks'>>,
  ) => void;
  completeTodo: (id: string) => void; // bullet click → archived
  restoreTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  purgeArchivedTodos: () => void;
  // Currently Processing (D)
  addProcessingItem: (input: NewProcessingItem) => ProcessingItem;
  updateProcessingItem: (id: string, patch: Partial<Omit<ProcessingItem, 'id'>>) => void;
  deleteProcessingItem: (id: string) => void;
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
}

export type Store = PersistedState & StoreActions;

// Pull just the persisted slice out of the live store (used by export/persist).
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
      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          subcategories: s.subcategories.filter((sc) => sc.categoryId !== id),
          sites: s.sites.filter((site) => site.categoryId !== id),
          pinnedCategoryId: s.pinnedCategoryId === id ? null : s.pinnedCategoryId,
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
      deleteSite: (id) => set((s) => ({ sites: s.sites.filter((site) => site.id !== id) })),

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
      addTodo: ({ text, dueDate = null, dueTime = null, priority = 0, tags = [], repeat = null }) => {
        const todo: Todo = {
          id: newId(),
          text,
          dueDate: dueDate || null,
          dueTime: dueDate && dueTime ? dueTime : null,
          createdAt: Date.now(),
          order: nextOrder(get().todos),
          archivedAt: null,
          priority,
          tags,
          notes: '',
          subtasks: [],
          repeat: dueDate ? repeat : null,
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
      purgeArchivedTodos: () =>
        set((s) => ({ todos: s.todos.filter((t) => t.archivedAt === null) })),

      // ---- Currently Processing -----------------------------------------
      addProcessingItem: ({ name, url, siteId = null, section = 'Focus', schedule }) => {
        const item: ProcessingItem = {
          id: newId(),
          name,
          url,
          siteId,
          section,
          order: nextOrder(get().processing),
          schedule: { ...defaultSchedule(), ...schedule },
        };
        set((s) => ({ processing: [...s.processing, item] }));
        return item;
      },
      updateProcessingItem: (id, patch) =>
        set((s) => ({
          processing: s.processing.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      deleteProcessingItem: (id) =>
        set((s) => ({ processing: s.processing.filter((p) => p.id !== id) })),

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
