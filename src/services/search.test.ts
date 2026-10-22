import { describe, expect, test } from 'vitest';
import type { QuickLink, Site } from '../types';
import { buildStrip, destinationFor, linkScore, looksLikeUrl, parseSuggestResponse, relativeAge } from './search';

const NOW = new Date(2026, 9, 15, 12).getTime();
const DAY = 86_400_000;

const site = (id: string, over: Partial<Site> = {}): Site => ({
  id,
  name: id.toUpperCase(),
  url: `https://${id}.com`,
  categoryId: 'c',
  subcategoryId: null,
  primary: false,
  order: 0,
  visits: 0,
  lastVisited: null,
  ...over,
});
const ql = (id: string, order: number, url = `https://${id}.com`): QuickLink => ({ id, name: id, url, order });

describe('looksLikeUrl / destinationFor', () => {
  test.each([
    ['https://x.dev/a', true],
    ['github.com/vercel', true],
    ['localhost:5173', true],
    ['192.168.1.1:8080/admin', true],
    ['react hooks', false],
    ['vite', false],
    ['node.js', false],
    ['readme.md', false],
    ['vite.dev', true],
  ])('%s → %s', (q, expected) => {
    expect(looksLikeUrl(q)).toBe(expected);
  });

  test('routes URLs directly and everything else to Google', () => {
    expect(destinationFor('github.com')).toBe('https://github.com');
    expect(destinationFor('localhost:3000')).toBe('http://localhost:3000');
    expect(destinationFor('react hooks')).toBe('https://www.google.com/search?q=react%20hooks');
  });
});

test('linkScore weighs recency', () => {
  expect(linkScore({ visits: 3, lastVisited: NOW }, NOW)).toBe(13);
  expect(linkScore({ visits: 3, lastVisited: NOW - 30 * DAY }, NOW)).toBe(3);
  expect(linkScore({ visits: 0, lastVisited: null }, NOW)).toBe(0);
});

describe('buildStrip', () => {
  const quick = [ql('q6', 5), ql('q5', 4), ql('q1', 0), ql('q2', 1), ql('q3', 2), ql('q4', 3)];

  test('first 5 quick links (by order) are fixed; the 6th leads the scrolling part', () => {
    const m = buildStrip(quick, [], 6, 8, NOW);
    expect(m.fixed.map((l) => l.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5']);
    expect(m.scrolling.map((l) => l.id)).toEqual(['q6']);
  });

  test('auto-picks by score, skips hosts already shown, respects the count', () => {
    const sites = [
      site('old', { visits: 5, lastVisited: NOW - 60 * DAY }),
      site('hot', { visits: 2, lastVisited: NOW }),
      site('q1', { visits: 99, lastVisited: NOW }), // same host as a quick link
      site('mid', { visits: 4, lastVisited: NOW - 7 * DAY }),
    ];
    const m = buildStrip(quick, sites, 2, 8, NOW);
    expect(m.scrolling.map((l) => l.name)).toEqual(['q6', 'HOT', 'MID']);
  });

  test('falls back to primary sites on a fresh deck', () => {
    const m = buildStrip([], [site('a', { primary: true }), site('b')], 6, 8, NOW);
    expect(m.fixed.map((l) => l.siteId)).toEqual(['a']); // empty fixed slots take it first
  });

  test('recent lists visited sites newest first, capped', () => {
    const sites = [
      site('a', { visits: 1, lastVisited: NOW - 3 }),
      site('b', { visits: 1, lastVisited: NOW - 1 }),
      site('c', { visits: 1, lastVisited: NOW - 2 }),
      site('d'),
    ];
    expect(buildStrip([], sites, 0, 2, NOW).recent.map((l) => l.siteId)).toEqual(['b', 'c']);
  });
});

test('relativeAge', () => {
  expect(relativeAge(NOW - 20_000, NOW)).toBe('now');
  expect(relativeAge(NOW - 5 * 60_000, NOW)).toBe('5m');
  expect(relativeAge(NOW - 3 * 3_600_000, NOW)).toBe('3h');
  expect(relativeAge(NOW - 2 * DAY, NOW)).toBe('2d');
});

test('parseSuggestResponse reads the second array and caps it', () => {
  expect(parseSuggestResponse(['vite', ['vite', 'vitest', 'vite react'], []], 2)).toEqual(['vite', 'vitest']);
  expect(parseSuggestResponse(null, 5)).toEqual([]);
  expect(parseSuggestResponse(['x', 'nope'], 5)).toEqual([]);
});

describe('buildStrip with fewer than five quick links', () => {
  test('the top auto-picked site fills the fifth fixed slot', () => {
    const quick = [ql('q1', 0), ql('q2', 1), ql('q3', 2), ql('q4', 3)];
    const sites = [site('hot', { visits: 2, lastVisited: NOW }), site('mid', { visits: 1, lastVisited: NOW - 7 * DAY })];
    const m = buildStrip(quick, sites, 6, 8, NOW);
    expect(m.fixed.map((l) => l.name)).toEqual(['q1', 'q2', 'q3', 'q4', 'HOT']);
    expect(m.scrolling.map((l) => l.name)).toEqual(['MID']);
  });
});
