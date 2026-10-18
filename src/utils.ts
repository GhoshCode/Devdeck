import type { Category, Site, Subcategory } from './types';

// --- URL & Domain Utilities --------------------------------------------------

/**
 * Normalizes user-input URL strings by ensuring an https:// protocol prefix and trimmed whitespace.
 */
export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Extracts a clean hostname from a URL, stripping 'www.'.
 */
export function getHostname(rawUrl: string): string {
  try {
    const normalized = normalizeUrl(rawUrl);
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
}

// Generic subdomains that say nothing about the site (news.ycombinator.com → Ycombinator).
const GENERIC_SUBDOMAINS = new Set(['www', 'm', 'news', 'app', 'docs', 'doc', 'blog', 'api', 'web', 'my', 'en', 'portal', 'dashboard', 'console', 'developer', 'developers']);

/**
 * Derives a readable site name from a URL domain (e.g. "https://github.com/..." -> "Github").
 */
export function deriveNameFromUrl(rawUrl: string): string {
  try {
    const labels = getHostname(rawUrl).split('.');
    const first = labels.length > 2 && GENERIC_SUBDOMAINS.has(labels[0]) ? 1 : 0;
    const part = labels[first] || '';
    if (!part) return '';
    return part.charAt(0).toUpperCase() + part.slice(1);
  } catch {
    return '';
  }
}

// --- Fuzzy Search Utilities --------------------------------------------------

export interface ScoredSite {
  site: Site;
  category: Category;
  subcategory: Subcategory | null;
  score: number;
}

/**
 * In-house fuzzy scorer without external dependencies.
 * Matches `pattern` against `target`. Returns score >= 0 if match, -1 if no match.
 * Higher score = better match.
 */
export function fuzzyMatch(pattern: string, target: string): number {
  const p = pattern.toLowerCase().trim();
  const t = target.toLowerCase();

  if (!p) return 0;
  if (t === p) return 1000;
  if (t.startsWith(p)) return 800 + (100 - Math.min(t.length, 90));

  const subIndex = t.indexOf(p);
  if (subIndex !== -1) {
    // Exact substring match bonus, penalized by distance from start
    return 600 - subIndex * 2;
  }

  // Subsequence matching with word-boundary and consecutive character bonuses
  let score = 0;
  let pIdx = 0;
  let prevMatchIdx = -2;

  for (let tIdx = 0; tIdx < t.length && pIdx < p.length; tIdx++) {
    if (t[tIdx] === p[pIdx]) {
      score += 10;
      // Consecutive characters bonus
      if (tIdx === prevMatchIdx + 1) {
        score += 25;
      }
      // Word boundary bonus (start of word or after delimiter)
      if (tIdx === 0 || /[\s\-_./]/.test(t[tIdx - 1])) {
        score += 35;
      }
      prevMatchIdx = tIdx;
      pIdx++;
    }
  }

  if (pIdx === p.length) {
    // All characters of pattern were found in sequence
    return score;
  }

  return -1;
}

export function searchSites(
  query: string,
  sites: Site[],
  categories: Category[],
  subcategories: Subcategory[],
): ScoredSite[] {
  const trimmed = query.trim();
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const subMap = new Map(subcategories.map((s) => [s.id, s]));

  const scored: ScoredSite[] = [];

  for (const site of sites) {
    const category = catMap.get(site.categoryId);
    if (!category) continue;
    const subcategory = site.subcategoryId ? subMap.get(site.subcategoryId) ?? null : null;

    const domain = getHostname(site.url);

    if (!trimmed) {
      // Empty query: rank by recent visits / popularity
      const recencyBonus = site.lastVisited
        ? Math.max(0, 100 - Math.floor((Date.now() - site.lastVisited) / (1000 * 60 * 60 * 24)))
        : 0;
      const score = (site.visits || 0) * 10 + recencyBonus;
      scored.push({ site, category, subcategory, score });
      continue;
    }

    const nameScore = fuzzyMatch(trimmed, site.name);
    const domainScore = fuzzyMatch(trimmed, domain);
    const catScore = fuzzyMatch(trimmed, category.name);
    const subScore = subcategory ? fuzzyMatch(trimmed, subcategory.name) : -1;

    const maxMatchScore = Math.max(
      nameScore * 1.5,
      domainScore * 1.2,
      catScore * 0.9,
      subScore * 0.9,
    );

    if (maxMatchScore > 0) {
      // Secondary sort bonus based on visits and lastVisited
      const visitsBonus = Math.min(site.visits * 2, 50);
      const recencyBonus = site.lastVisited && Date.now() - site.lastVisited < 86400000 ? 20 : 0;
      const totalScore = maxMatchScore + visitsBonus + recencyBonus;

      scored.push({
        site,
        category,
        subcategory,
        score: totalScore,
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}

// ---- Colour contrast ---------------------------------------------------------

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = ([r, g, b]: [number, number, number]): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export function contrastRatio(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 1;
  const [l1, l2] = [relativeLuminance(ra), relativeLuminance(rb)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Darkens `hex` in small steps toward black (keeping its hue) until it reaches
// `min` contrast against `bg` — WCAG AA for body text is 4.5:1.
export function ensureContrast(hex: string, bg = '#ffffff', min = 4.5): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let [r, g, b] = rgb;
  const toHex = () => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
  for (let i = 0; i < 40 && contrastRatio(toHex(), bg) < min; i++) {
    r *= 0.94;
    g *= 0.94;
    b *= 0.94;
  }
  return toHex();
}

/**
 * Category accent as text colour. On light surfaces it is darkened just enough
 * to meet WCAG AA on white cards; dark mode uses the colour as chosen.
 */
export function getCategoryDisplayColor(hex: string, isLight: boolean): string {
  if (!isLight || !hex) return hex;
  return ensureContrast(hex, '#ffffff', 4.6);
}
