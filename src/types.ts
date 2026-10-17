// DevDeck domain model — SPEC §2. One level of nesting only:
// Category → Subcategory → Site. All ordering is explicit via `order`.

export interface Category {
  id: string;
  name: string;
  color: string; // accent hex used for the card label, pills, map nodes
  order: number;
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
  order: number;
}

export interface Site {
  id: string;
  name: string;
  url: string; // normalized, always with protocol
  categoryId: string;
  subcategoryId: string | null; // null = the category's implicit "General" group
  primary: boolean; // true = shown in the category's primary row
  order: number;
  visits: number; // incremented on open
  lastVisited: number | null; // epoch ms
}

export interface QuickLink {
  id: string;
  name: string;
  url: string;
  order: number;
}

export type ThemeMode = 'dark' | 'light';

// TIME widget face — IMPLEMENTATION_PLAN §7 Q9 / spec §3.1.
export type { ClockStyle } from './lib/clockStyles';
import type { ClockStyle } from './lib/clockStyles';

export interface Settings {
  accentColor: string;
  themeMode?: ThemeMode; // 'dark' | 'light'
  presetTheme?: string | null; // e.g. 'default-dark', 'default-light', 'cyberpunk', etc.
  backgroundImage: string | null; // data URL, remote URL, or css gradient
  overlayOpacity: number; // 0–1
  backgroundBlur: number; // px
  clock24h: boolean;
  greetingName: string; // used in greetings, may be empty
  // ---- v2 ----
  clockStyle: ClockStyle;
  showSeconds: boolean;
  githubUsername: string; // empty = Git widget shows its setup prompt
  githubToken: string; // optional PAT; never exported
  autoQuickLinkCount: number; // 2–12 auto-picked links after the fixed 4
  recentLinkCount: number; // chips in the Recent (F) strip
  weatherEnabled: boolean;
  useGeolocation: boolean;
  manualCity: string; // used when geolocation is off or denied
  geminiMode?: boolean; // AI mode: the search bar sends plain text to the chosen AI instead of Google
  aiProvider?: 'gemini' | 'chatgpt' | 'claude' | 'perplexity' | 'custom'; // default gemini
  aiCustomUrl?: string; // custom AI: URL template with {q}
  showQuote?: boolean; // the greeting shows a daily motivational quote (default on)
  leftSplit?: number; // 0–1: share of the left column given to Focus (rest: Queue / To-do)
  feedSplit?: number; // 0–1: share of the right column given to Tech news (rest: Dev jobs)
  clockZones?: string[]; // Multi-Timezone face: IANA zones shown beside local time
  gitRepo?: string | null; // Git widget: selected repo (owner/name); null = the most recently pushed
  followSystem?: boolean; // Appearance "Auto": theme mode follows the OS
  modeLooks?: Partial<Record<ThemeMode, ModeLook>>; // each mode remembers its own look
  reduceTransparency?: boolean; // opaque panels instead of glass
  panelSolidity?: number; // 0–100: 0 = default glass, 100 = solid panels
  panelBlur?: number; // px of backdrop blur behind panels; undefined = theme default
  gradientStudio?: GradientStudio; // last design in Appearance → Gradient Studio
  weatherSource?: string; // "auto" (default), a built-in provider id, or a custom source id
  customWeatherSources?: CustomWeatherSource[];
}

// A to-do carries at most one due moment: a date, optionally with a time.
// Completing a to-do archives it (bullet click) — there is no "done but visible".
export interface Todo {
  id: string;
  text: string;
  dueDate: string | null; // 'YYYY-MM-DD'
  dueTime: string | null; // 'HH:mm' — only meaningful with dueDate
  createdAt: number; // epoch ms
  order: number;
  archivedAt: number | null; // epoch ms; non-null = completed + archived
  priority?: Priority; // 0 none · 1 urgent · 2 high · 3 normal
  tags?: string[]; // lower-case, without the #
  notes?: string;
  subtasks?: Subtask[];
}

export type Priority = 0 | 1 | 2 | 3;

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export type ScheduleFrequency = 'minute' | 'hourly' | 'daily';

// Cron-style reminder window for a Currently Processing item (Phase 4).
export interface Schedule {
  enabled: boolean;
  frequency: ScheduleFrequency;
  daysOfWeek: number[]; // 0 = Sun … 6 = Sat
  timeOfDay: string | null; // 'HH:mm' for daily reminders
  from: string; // 'YYYY-MM'
  to: string; // 'YYYY-MM'
}

export interface ProcessingItem {
  id: string;
  name: string;
  url: string;
  siteId: string | null; // set when picked from the library
  section: string; // free-form group label inside panel D
  order: number;
  schedule: Schedule;
}

export interface Topic {
  id: string;
  label: string; // shown as '#label'
  query: string; // comma-separated keywords matched against feed titles/tags
}

// hn = HN front page, hnjobs = HN "who's hiring" posts, rss = any RSS/Atom URL.
export type FeedKind = 'hn' | 'hnjobs' | 'devto' | 'remotive' | 'remoteok' | 'rss';
export type FeedCategory = 'news' | 'jobs';

export interface FeedSource {
  id: string;
  name: string;
  kind: FeedKind;
  url: string; // endpoint; for built-ins it documents what is fetched
  category: FeedCategory;
  enabled: boolean;
}

export interface FeedsConfig {
  topics: Topic[];
  sources: FeedSource[];
}

export const SCHEMA_VERSION = 2;

export interface PersistedState {
  schemaVersion: number; // starts at 1; bump with every schema change
  categories: Category[];
  subcategories: Subcategory[];
  sites: Site[];
  quickLinks: QuickLink[];
  settings: Settings;
  // ---- v2 ----
  // Exactly one category may be pinned (§7 Q6). Holding a single id instead of
  // a per-category flag makes "more than one pinned" unrepresentable; the
  // card's `order` is untouched, so unpinning restores its position for free.
  pinnedCategoryId: string | null;
  todos: Todo[];
  processing: ProcessingItem[];
  feeds: FeedsConfig;
}

// Discriminates which collection a `reorder` call targets.
export type ReorderKind = 'category' | 'subcategory' | 'site' | 'quickLink' | 'todo' | 'processing';

// Result of importing a state blob — either the applied summary or an error.
export interface ImportSummary {
  categories: number;
  subcategories: number;
  sites: number;
  quickLinks: number;
  todos: number;
  processing: number;
}

export type ImportResult =
  | { ok: true; summary: ImportSummary }
  | { ok: false; error: string };

// What a theme mode looks like; remembered per mode so switching Light ↔ Dark
// (by hand or by "Auto") brings back the theme last used in that mode.
export interface ModeLook {
  presetTheme: string;
  accentColor: string;
  backgroundImage: string | null;
}

export interface GradientStop {
  color: string; // '#rrggbb'
  at: number; // 0–100 (%)
}

// A backdrop designed in Appearance → Gradient Studio.
export interface GradientStudio {
  type: 'linear' | 'radial' | 'conic';
  angle: number; // degrees — linear direction / conic start
  position: string; // radial & conic centre, e.g. '50% 50%'
  stops: GradientStop[]; // 2–4, sorted by `at`
}

// A weather source the user added in Settings → Profile. The API must answer
// in Open-Meteo's format (Open-Meteo mirrors, self-hosted instances, or any
// compatible service); {lat} and {lon} are filled in.
export interface CustomWeatherSource {
  id: string;
  name: string;
  apiUrl: string; // e.g. https://my-meteo.example/v1/forecast?latitude={lat}&longitude={lon}
  siteUrl: string; // opened when the weather is clicked; may use {lat}/{lon}
}
