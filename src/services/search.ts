// Search row (Zone 3) and links strip (Zone 4) logic — plan Phase 2, §7 Q7/Q8/Q12.

import { netFetch } from '../lib/netFetch';
import type { QuickLink, Site } from '../types';
import { getHostname, normalizeUrl } from '../utils';
import { isExtension } from '../lib/env';

// ---- Query classification ---------------------------------------------------

// "Enter on a URL opens it; anything else goes to a Google search."
export function looksLikeUrl(raw: string): boolean {
  const q = raw.trim();
  if (!q || /\s/.test(q)) return false;
  if (/^https?:\/\//i.test(q)) return true;
  if (/^localhost(:\d+)?(\/|$)/i.test(q)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(q)) return true;
  // host.tld with a 2+ letter TLD, optional port and path
  const m = q.match(/^[\w-]+(?:\.[\w-]+)*\.([a-z]{2,})(?::\d+)?(?:\/\S*)?$/i);
  // "node.js", "index.ts", "readme.md" are searches, not hosts.
  return !!m && !FILE_EXTENSIONS.has(m[1].toLowerCase());
}

const FILE_EXTENSIONS = new Set(['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'md', 'css', 'html', 'json', 'yml', 'yaml', 'txt', 'exe', 'sh', 'go', 'rs', 'java', 'cpp']);

export const googleSearchUrl = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(q.trim())}`;

export function destinationFor(raw: string): string {
  const q = raw.trim();
  if (!looksLikeUrl(q)) return googleSearchUrl(q);
  return /^localhost|^\d/.test(q) ? `http://${q}` : normalizeUrl(q);
}

// ---- Links strip (E + F) ----------------------------------------------------

export const FIXED_QUICK_LINKS = 4;

export interface StripLink {
  id: string;
  name: string;
  url: string;
  siteId: string | null; // set when the link is a library site (visits are recorded)
}

const DAY = 24 * 60 * 60 * 1000;

// Frequency with a recency boost: a visit today is worth ~10 extra visits,
// decaying over two weeks.
export function linkScore(site: Pick<Site, 'visits' | 'lastVisited'>, now: number): number {
  const recency = site.lastVisited ? Math.max(0, 14 - (now - site.lastVisited) / DAY) / 14 : 0;
  return site.visits + recency * 10;
}

export interface StripModel {
  fixed: StripLink[]; // first 4 configured quick links — never scroll
  scrolling: StripLink[]; // remaining quick links, then auto-picked sites
  recent: StripLink[]; // F: most recently opened sites
}

// E: the first 4 quick links are fixed; configured links beyond 4 come next,
// then `autoCount` sites ranked by linkScore, skipping anything already shown
// (matched by hostname). A fresh deck has no visits yet, so it falls back to
// the categories' primary sites in deck order to keep the strip useful.
export function buildStrip(
  quickLinks: readonly QuickLink[],
  sites: readonly Site[],
  autoCount: number,
  recentCount: number,
  now: number,
): StripModel {
  const ordered = [...quickLinks].sort((a, b) => a.order - b.order);
  const asLink = (q: QuickLink): StripLink => ({ id: q.id, name: q.name, url: q.url, siteId: null });
  const fixed = ordered.slice(0, FIXED_QUICK_LINKS).map(asLink);
  const extra = ordered.slice(FIXED_QUICK_LINKS).map(asLink);

  const seen = new Set([...fixed, ...extra].map((l) => getHostname(l.url)));
  const siteLink = (s: Site): StripLink => ({ id: `site-${s.id}`, name: s.name, url: s.url, siteId: s.id });

  const visited = sites
    .filter((s) => s.visits > 0)
    .sort((a, b) => linkScore(b, now) - linkScore(a, now) || a.name.localeCompare(b.name));
  const fallback = sites.filter((s) => s.primary && s.visits === 0);

  const auto: StripLink[] = [];
  for (const s of [...visited, ...fallback]) {
    if (auto.length >= autoCount) break;
    const host = getHostname(s.url);
    if (seen.has(host)) continue;
    seen.add(host);
    auto.push(siteLink(s));
  }

  const recent = sites
    .filter((s) => s.lastVisited !== null)
    .sort((a, b) => b.lastVisited! - a.lastVisited!)
    .slice(0, recentCount)
    .map(siteLink);

  return { fixed, scrolling: [...extra, ...auto], recent };
}

// "3m", "2h", "5d" — compact age for Recent chips.
export function relativeAge(then: number, now: number): string {
  const mins = Math.max(0, Math.floor((now - then) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ---- Web suggestions (Tier 2) ----------------------------------------------

const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search?client=firefox&q=';

export function parseSuggestResponse(json: unknown, limit: number): string[] {
  if (!Array.isArray(json) || !Array.isArray(json[1])) return [];
  return (json[1] as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, limit);
}

// Google's suggest endpoint sends no CORS headers. The extension can fetch it
// (host permission); a plain web page falls back to JSONP via a script tag.
export async function fetchSuggestions(query: string, limit = 5, signal?: AbortSignal): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const url = SUGGEST_URL + encodeURIComponent(q);
  if (isExtension()) {
    const res = await netFetch(url, { signal });
    if (!res.ok) return [];
    return parseSuggestResponse(await res.json(), limit);
  }
  return parseSuggestResponse(await jsonp(url, signal), limit);
}

let jsonpSeq = 0;

function jsonp(url: string, signal?: AbortSignal, timeoutMs = 4000): Promise<unknown> {
  return new Promise((resolve) => {
    const name = `__devdeckSuggest${++jsonpSeq}`;
    const script = document.createElement('script');
    const w = window as unknown as Record<string, unknown>;
    const finish = (value: unknown) => {
      clearTimeout(timer);
      delete w[name];
      script.remove();
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), timeoutMs);
    w[name] = (data: unknown) => finish(data);
    script.src = `${url}&callback=${name}`;
    script.onerror = () => finish(null);
    signal?.addEventListener('abort', onAbort);
    document.head.appendChild(script);
  });
}
