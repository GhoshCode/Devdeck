import { beforeEach, describe, expect, test } from 'vitest';
import { buildWeeks, computeStats, loadGitStats, summarizeEvents, type ContributionDay } from './github';

const NOW = new Date(2026, 9, 15, 12); // Oct 15 2026

// Builds consecutive days ending on `end` from a list of counts.
function series(end: string, counts: number[]): ContributionDay[] {
  const [y, m, d] = end.split('-').map(Number);
  return counts.map((count, i) => {
    const date = new Date(y, m - 1, d - (counts.length - 1 - i));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { date: key, count, level: count ? 1 : 0 } as ContributionDay;
  });
}

describe('computeStats', () => {
  test('current streak tolerates an empty today', () => {
    const s = computeStats('u', series('2026-10-15', [0, 2, 1, 3, 0]), NOW);
    expect(s.currentStreak).toBe(3);
  });

  test('an empty yesterday breaks the current streak', () => {
    expect(computeStats('u', series('2026-10-15', [1, 1, 0, 1]), NOW).currentStreak).toBe(1);
    expect(computeStats('u', series('2026-10-15', [1, 1, 0, 0]), NOW).currentStreak).toBe(0);
  });

  test('longest streak and the calendar-year total', () => {
    const days = [
      ...series('2025-12-31', [4, 4]), // last year — not in totalYear
      ...series('2026-01-03', [1, 1, 1]),
      ...series('2026-10-15', [5]),
    ];
    const s = computeStats('u', days, NOW);
    expect(s.longestStreak).toBe(5); // Dec 30 → Jan 3 is one run
    expect(s.totalYear).toBe(8);
  });

  test('a gap in the data ends the current streak', () => {
    const days = [...series('2026-10-12', [1, 1, 1]), ...series('2026-10-15', [1])];
    expect(computeStats('u', days, NOW).currentStreak).toBe(1);
    // today missing from the data entirely still counts from yesterday
    expect(computeStats('u', series('2026-10-14', [1, 1]), NOW).currentStreak).toBe(2);
  });

  test('ignores padded future days', () => {
    const s = computeStats('u', series('2026-10-17', [1, 1, 9]), NOW);
    expect(s.days.map((d) => d.date)).toEqual(['2026-10-15']);
  });
});

describe('loadGitStats', () => {
  beforeEach(() => localStorage.clear());

  const fakeFetch = (status: number, body: unknown) => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fn = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return { ok: status < 400, status, json: async () => body };
    }) as unknown as typeof fetch;
    return { fn, calls };
  };

  test('public path hits the contributions API and caches the result', async () => {
    const { fn, calls } = fakeFetch(200, { contributions: [{ date: '2026-10-14', count: 2, level: 2 }] });
    const s = await loadGitStats('octo', '', { fetcher: fn });
    const contributionCalls = () => calls.filter((c) => c.url.includes('github-contributions-api'));
    expect(contributionCalls().map((c) => c.url)).toEqual(['https://github-contributions-api.jogruber.de/v4/octo?y=last']);
    expect(s.days).toHaveLength(1);
    const before = calls.length;
    await loadGitStats('octo', '', { fetcher: fn });
    expect(calls).toHaveLength(before); // second call served entirely from cache
  });

  test('token path uses GraphQL with a bearer header and maps levels', async () => {
    const { fn, calls } = fakeFetch(200, {
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              weeks: [{ contributionDays: [{ date: '2026-10-14', contributionCount: 7, contributionLevel: 'THIRD_QUARTILE' }] }],
            },
          },
        },
      },
    });
    const s = await loadGitStats('octo', 'ghp_x', { fetcher: fn });
    expect(calls[0].url).toBe('https://api.github.com/graphql');
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer ghp_x');
    expect(s.days[0]).toEqual({ date: '2026-10-14', count: 7, level: 3 });
  });

  test('surfaces missing users and empty usernames', async () => {
    await expect(loadGitStats('ghost', '', { fetcher: fakeFetch(404, {}).fn })).rejects.toThrow('not found');
    await expect(loadGitStats('  ', '')).rejects.toThrow('Settings');
  });
});

test('buildWeeks lays out Sunday-first columns ending this week', () => {
  const weeks = buildWeeks([{ date: '2026-10-14', count: 3, level: 2 }], 2, NOW); // NOW is a Thursday
  expect(weeks).toHaveLength(2);
  expect(weeks[0][0]!.date).toBe('2026-10-04'); // Sunday of the previous week
  expect(weeks[1][3]).toEqual({ date: '2026-10-14', count: 3, level: 2 }); // Wednesday
  expect(weeks[1][4]!.date).toBe('2026-10-15'); // today, no data → level 0
  expect(weeks[1][5]).toBeNull(); // Friday is in the future
});

describe('summarizeEvents', () => {
  const ev = (type: string, created_at: string, payload: Record<string, unknown>, repo = 'me/app') => ({
    type,
    created_at,
    repo: { name: repo },
    payload,
  });

  test('picks the newest push and merged PR even when events are out of order', () => {
    const s = summarizeEvents([
      ev('PushEvent', '2026-10-15T09:00:00Z', { ref: 'refs/heads/old', head: 'aaaaaaaa11' }),
      ev('PullRequestEvent', '2026-10-16T15:07:03Z', { action: 'merged', number: 3 }),
      ev('PushEvent', '2026-10-16T10:00:00Z', { ref: 'refs/heads/v8.0', head: 'bbbbbbbb22' }, 'me/deck'),
      ev('PullRequestEvent', '2026-10-16T15:06:52Z', { action: 'opened', number: 3 }),
    ]);
    expect(s).toEqual({
      branch: 'v8.0',
      repo: 'me/deck',
      commitSha: 'bbbbbbb',
      commitAt: Date.parse('2026-10-16T10:00:00Z'),
      mergedPr: { number: 3, repo: 'me/app', at: Date.parse('2026-10-16T15:07:03Z') },
    });
  });

  test('accepts the classic closed+merged shape and handles no activity', () => {
    const s = summarizeEvents([
      ev('PullRequestEvent', '2026-10-01T00:00:00Z', {
        action: 'closed',
        number: 9,
        pull_request: { merged: true, merged_at: '2026-10-01T00:00:05Z' },
      }),
    ]);
    expect(s.mergedPr).toEqual({ number: 9, repo: 'me/app', at: Date.parse('2026-10-01T00:00:05Z') });
    expect(summarizeEvents([])).toEqual({ branch: null, repo: null, commitSha: null, commitAt: null, mergedPr: null });
  });
});
