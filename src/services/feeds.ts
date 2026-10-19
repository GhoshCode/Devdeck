// I (news + jobs) and J (topics) data — plan Phase 5, §7 Q13. One adapter per
// source kind, normalised into FeedItem. All built-in sources are CORS-open,
// so the feed works on the web as well as in the extension; custom RSS feeds
// work wherever their server allows it (in the extension, via an optional
// host permission granted when the source is added).

import { netFetch } from '../lib/netFetch';
import type { FeedCategory, FeedSource, Topic } from '../types';
import { readCache, writeCache } from '../lib/cache';

export interface FeedItem {
  id: string; // source id + item id, unique across sources
  title: string;
  url: string;
  source: string; // display name of the source
  category: FeedCategory;
  tags: string[];
  publishedAt: number; // epoch ms
  meta?: string; // company for jobs, points for HN
}

export const FEED_TTL_MS = 30 * 60 * 1000;
const CACHE_NAME = 'feeds';

type Fetch = typeof fetch;

const ms = (v: string | number | undefined | null): number => {
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v; // seconds → ms
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : 0;
};

async function getJson(url: string, fetcher: Fetch): Promise<unknown> {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  return res.json();
}

const asArray = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [];
const str = (v: unknown) => (typeof v === 'string' ? v : '');

// "Acme (YC W24) Is Hiring a Staff Engineer" → company "Acme (YC W24)".
const hnJobCompany = (title: string) => title.split(/\s+(?:is hiring|hiring)\b/i)[0]?.trim() || undefined;

export async function fetchSource(src: FeedSource, fetcher: Fetch = netFetch): Promise<FeedItem[]> {
  const base = { source: src.name, category: src.category };
  switch (src.kind) {
    case 'hn':
    case 'hnjobs': {
      const json = (await getJson(src.url, fetcher)) as { hits?: unknown };
      return asArray(json.hits).map((h) => {
        const title = str(h.title);
        const id = str(h.objectID);
        return {
          ...base,
          id: `${src.id}:${id}`,
          title,
          url: str(h.url) || `https://news.ycombinator.com/item?id=${id}`,
          tags: [],
          publishedAt: ms(h.created_at_i as number),
          meta: src.kind === 'hn' ? `${h.points ?? 0} pts` : hnJobCompany(title),
        };
      });
    }
    case 'devto': {
      return asArray(await getJson(src.url, fetcher)).map((a) => ({
        ...base,
        id: `${src.id}:${a.id}`,
        title: str(a.title),
        url: str(a.url),
        tags: Array.isArray(a.tag_list) ? (a.tag_list as string[]) : [],
        publishedAt: ms(str(a.published_at)),
      }));
    }
    case 'remotive': {
      const json = (await getJson(src.url, fetcher)) as { jobs?: unknown };
      return asArray(json.jobs).map((j) => ({
        ...base,
        id: `${src.id}:${j.id}`,
        title: str(j.title),
        url: str(j.url),
        tags: Array.isArray(j.tags) ? (j.tags as string[]) : [],
        publishedAt: ms(str(j.publication_date)),
        meta: str(j.company_name).trim() || undefined,
      }));
    }
    case 'remoteok': {
      // The first element is a legal notice, not a job.
      return asArray(await getJson(src.url, fetcher))
        .filter((j) => j.position)
        .map((j) => ({
          ...base,
          id: `${src.id}:${j.id}`,
          title: str(j.position),
          url: str(j.url),
          tags: Array.isArray(j.tags) ? (j.tags as string[]) : [],
          publishedAt: ms(j.epoch as number),
          meta: str(j.company) || undefined,
        }));
    }
    case 'rss': {
      const res = await fetcher(src.url);
      if (!res.ok) throw new Error(`${new URL(src.url).hostname} responded ${res.status}`);
      return parseFeedXml(await res.text(), src);
    }
  }
}

// RSS 2.0 <item> and Atom <entry>.
export function parseFeedXml(xml: string, src: FeedSource): FeedItem[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(`${src.name}: not a valid RSS/Atom feed`);
  const nodes = [...doc.querySelectorAll('item, entry')];
  return nodes.map((n, i) => {
    const text = (sel: string) => n.querySelector(sel)?.textContent?.trim() ?? '';
    const link = n.querySelector('link');
    const url = link?.getAttribute('href') || link?.textContent?.trim() || '';
    return {
      id: `${src.id}:${text('guid') || text('id') || url || i}`,
      title: text('title'),
      url,
      source: src.name,
      category: src.category,
      tags: [...n.querySelectorAll('category')].map((c) => c.getAttribute('term') || c.textContent || '').filter(Boolean),
      publishedAt: ms(text('pubDate') || text('published') || text('updated')),
    };
  });
}

// A topic matches when any of its comma-separated keywords appears as a whole
// word (or phrase) in the title or tags — so "ai" matches "AI agents" but not
// "email".
export function matchesTopic(item: Pick<FeedItem, 'title' | 'tags'>, topic: Topic | readonly Topic[] | null): boolean {
  if (!topic) return true;
  // Several topics selected: an item matching any one of them is shown.
  if (Array.isArray(topic)) return topic.length === 0 || topic.some((t) => matchesTopic(item, t));
  if (!('query' in topic)) return true;
  const hay = `${item.title} ${item.tags.join(' ')}`.toLowerCase();
  return topic.query
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .some((k) => new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(hay));
}

// Newest first, de-duplicated by URL, capped per panel.
export function selectPanel(items: readonly FeedItem[], category: FeedCategory, topic: Topic | readonly Topic[] | null, limit: number): FeedItem[] {
  const seen = new Set<string>();
  return items
    .filter((i) => i.category === category && i.title && i.url && matchesTopic(i, topic))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)))
    .slice(0, limit);
}

// Promise.allSettled with at most `limit` tasks running at once.
async function settleLimited<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
  onSettle?: (done: number, total: number) => void,
): Promise<PromiseSettledResult<T>[]> {
  const out: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      try {
        out[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (reason) {
        out[i] = { status: 'rejected', reason };
      }
      onSettle?.(++done, tasks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return out;
}

export interface FeedResult {
  items: FeedItem[];
  errors: string[]; // per-source failures; other sources still show
  fetchedAt: number;
}

const cacheKey = (sources: readonly FeedSource[]) =>
  sources
    .filter((s) => s.enabled)
    .map((s) => `${s.id}=${s.url}`)
    .join('|');

export function cachedFeeds(sources: readonly FeedSource[]): FeedResult | null {
  return readCache<FeedResult>(CACHE_NAME, cacheKey(sources), FEED_TTL_MS);
}

export async function loadFeeds(
  sources: readonly FeedSource[],
  opts: { force?: boolean; fetcher?: Fetch; onProgress?: (done: number, total: number) => void } = {},
): Promise<FeedResult> {
  if (!opts.force) {
    const hit = cachedFeeds(sources);
    if (hit) return hit;
  }
  const enabled = sources.filter((s) => s.enabled);
  opts.onProgress?.(0, enabled.length);
  const settled = await settleLimited(enabled.map((s) => () => fetchSource(s, opts.fetcher)), 8, opts.onProgress);
  const result: FeedResult = {
    items: settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    errors: settled.flatMap((r, i) =>
      r.status === 'rejected' ? [`${enabled[i].name}: ${r.reason instanceof Error ? r.reason.message : 'failed'}`] : [],
    ),
    fetchedAt: Date.now(),
  };
  // Don't cache a total failure — retry on the next load instead.
  if (result.items.length) writeCache(CACHE_NAME, cacheKey(sources), result);
  return result;
}
