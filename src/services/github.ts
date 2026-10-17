// GIT COMMITS widget data (spec §3.5). The public REST API has no contribution
// calendar, so:
//   • no token  → github-contributions-api.jogruber.de (public, CORS-open,
//                 scrapes the profile calendar; public contributions only)
//   • PAT given → GitHub GraphQL contributionsCollection (includes private
//                 contributions when the user has that profile setting on)

import { readCache, writeCache } from '../lib/cache';
import { localDateKey } from '../lib/time';

export type Level = 0 | 1 | 2 | 3 | 4;

export interface ContributionDay {
  date: string; // 'YYYY-MM-DD'
  count: number;
  level: Level;
}

// Recent public activity for the HUD footer. Every field is optional: the
// widget shows what GitHub returned and never invents the rest.
export interface GitActivity {
  publicRepos: number | null;
  branch: string | null; // of the latest push
  repo: string | null; // "owner/name" of the latest push
  commitSha: string | null; // short SHA of that push's head
  commitMessage: string | null; // first line
  commitAt: number | null; // epoch ms of the push
  mergedPr: { number: number; repo: string; at: number } | null;
}

export interface GitStats {
  username: string;
  days: ContributionDay[]; // ascending, ~1 year
  totalYear: number; // current calendar year
  currentStreak: number;
  longestStreak: number;
  activity?: GitActivity;
  fetchedAt: number;
}

export const GIT_TTL_MS = 30 * 60 * 1000; // refreshed (and cached) every 30 min
const CACHE_NAME = 'github';

type Fetch = typeof fetch;

const toLevel = (n: unknown): Level => (n === 1 || n === 2 || n === 3 || n === 4 ? n : 0);

async function fetchPublic(username: string, fetcher: Fetch): Promise<ContributionDay[]> {
  const res = await fetcher(
    `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=last`,
  );
  if (res.status === 404) throw new Error(`GitHub user "${username}" not found`);
  if (!res.ok) throw new Error(`Contributions request failed (${res.status})`);
  const json = (await res.json()) as { contributions?: Array<{ date: string; count: number; level: number }> };
  if (!Array.isArray(json.contributions)) throw new Error('Unexpected contributions response');
  return json.contributions.map((d) => ({ date: d.date, count: d.count, level: toLevel(d.level) }));
}

const GRAPHQL_LEVEL: Record<string, Level> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

async function fetchWithToken(username: string, token: string, fetcher: Fetch): Promise<ContributionDay[]> {
  const query = `query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar {
    weeks { contributionDays { date contributionCount contributionLevel } } } } } }`;
  const res = await fetcher('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: username } }),
  });
  if (res.status === 401) throw new Error('GitHub token was rejected');
  if (!res.ok) throw new Error(`GitHub GraphQL request failed (${res.status})`);
  const json = (await res.json()) as {
    errors?: Array<{ message: string }>;
    data?: {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            weeks: Array<{ contributionDays: Array<{ date: string; contributionCount: number; contributionLevel: string }> }>;
          };
        };
      } | null;
    };
  };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  const user = json.data?.user;
  if (!user) throw new Error(`GitHub user "${username}" not found`);
  return user.contributionsCollection.contributionCalendar.weeks.flatMap((w) =>
    w.contributionDays.map((d) => ({
      date: d.date,
      count: d.contributionCount,
      level: GRAPHQL_LEVEL[d.contributionLevel] ?? 0,
    })),
  );
}

const shiftDay = (key: string, delta: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + delta));
};
const nextDayKey = (key: string) => shiftDay(key, 1);
const prevDayKey = (key: string) => shiftDay(key, -1);

// Streaks follow GitHub's convention: an empty *today* doesn't break the
// current streak (the day isn't over yet), but an empty yesterday does.
export function computeStats(
  username: string,
  input: readonly ContributionDay[],
  now = new Date(),
): GitStats {
  const todayKey = localDateKey(now);
  // Drop future days the calendar may pad the last week with.
  const days = [...input].filter((d) => d.date <= todayKey).sort((a, b) => a.date.localeCompare(b.date));
  const year = String(now.getFullYear());

  // Runs need consecutive *dates*, not just consecutive entries — a gap in the
  // data must not join two streaks.
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    const contiguous = prev !== null && nextDayKey(prev) === d.date;
    run = d.count > 0 ? (contiguous ? run + 1 : 1) : 0;
    longest = Math.max(longest, run);
    prev = d.date;
  }

  let current = 0;
  let expected = todayKey;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.date !== expected) {
      // Today may simply be missing from the data; anything older is a gap.
      if (expected === todayKey && d.date === prevDayKey(todayKey)) expected = d.date;
      else break;
    }
    if (d.count > 0) current++;
    else if (d.date !== todayKey) break;
    expected = prevDayKey(d.date);
  }

  return {
    username,
    days,
    totalYear: days.filter((d) => d.date.startsWith(year)).reduce((sum, d) => sum + d.count, 0),
    currentStreak: current,
    longestStreak: longest,
    fetchedAt: now.getTime(),
  };
}

const cacheKey = (username: string, token: string) => `${username.toLowerCase()}|${token ? 'pat' : 'public'}`;

export function cachedGitStats(username: string, token: string): GitStats | null {
  return readCache<GitStats>(CACHE_NAME, cacheKey(username, token), GIT_TTL_MS);
}

export async function loadGitStats(
  username: string,
  token: string,
  opts: { force?: boolean; fetcher?: Fetch } = {},
): Promise<GitStats> {
  const user = username.trim();
  if (!user) throw new Error('Set your GitHub username in Settings → Profile');
  if (!opts.force) {
    const hit = cachedGitStats(user, token);
    if (hit) return hit;
  }
  const fetcher = opts.fetcher ?? fetch;
  const [days, activity] = await Promise.all([
    token ? fetchWithToken(user, token, fetcher) : fetchPublic(user, fetcher),
    // Activity is a bonus: a failure (e.g. rate limit) must not hide the heatmap.
    fetchActivity(user, token, fetcher).catch(() => undefined),
  ]);
  const stats = { ...computeStats(user, days), activity };
  writeCache(CACHE_NAME, cacheKey(user, token), stats);
  return stats;
}

interface GhEvent {
  type: string;
  created_at: string;
  repo: { name: string };
  payload: {
    ref?: string;
    head?: string;
    action?: string;
    number?: number;
    pull_request?: { merged?: boolean; merged_at?: string | null };
  };
}

// Picks the latest push and the latest merged PR from public events. GitHub's
// events API is not strictly date-ordered, so sort first.
export function summarizeEvents(events: readonly GhEvent[]): Omit<GitActivity, 'publicRepos' | 'commitMessage'> {
  const sorted = [...events].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const push = sorted.find((e) => e.type === 'PushEvent' && e.payload.head);
  const merged = sorted.find(
    (e) =>
      e.type === 'PullRequestEvent' &&
      (e.payload.action === 'merged' || (e.payload.action === 'closed' && e.payload.pull_request?.merged)),
  );
  return {
    branch: push?.payload.ref?.replace('refs/heads/', '') ?? null,
    repo: push?.repo.name ?? null,
    commitSha: push?.payload.head?.slice(0, 7) ?? null,
    commitAt: push ? Date.parse(push.created_at) : null,
    mergedPr:
      merged && merged.payload.number
        ? {
            number: merged.payload.number,
            repo: merged.repo.name,
            at: Date.parse(merged.payload.pull_request?.merged_at ?? merged.created_at),
          }
        : null,
  };
}

async function fetchActivity(user: string, token: string, fetcher: Fetch): Promise<GitActivity> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const get = async <T>(url: string): Promise<T | null> => {
    const res = await fetcher(url, { headers });
    return res.ok ? ((await res.json()) as T) : null;
  };
  const enc = encodeURIComponent(user);
  const [profile, events] = await Promise.all([
    get<{ public_repos?: number }>(`https://api.github.com/users/${enc}`),
    get<GhEvent[]>(`https://api.github.com/users/${enc}/events/public?per_page=50`),
  ]);
  // Rate-limited or blocked: report "unknown" rather than "no activity".
  if (!Array.isArray(events)) throw new Error('GitHub events unavailable');
  const summary = summarizeEvents(events);
  // Push events no longer carry commit messages, so look the head commit up.
  let commitMessage: string | null = null;
  if (summary.repo && summary.commitSha) {
    const full = events.find((e) => e.payload.head?.startsWith(summary.commitSha!))?.payload.head;
    const commit = full ? await get<{ commit?: { message?: string } }>(`https://api.github.com/repos/${summary.repo}/commits/${full}`) : null;
    commitMessage = commit?.commit?.message?.split('\n')[0] ?? null;
  }
  return { publicRepos: profile?.public_repos ?? null, commitMessage, ...summary };
}

// The last `count` Sunday-first weeks ending with the week containing `today`,
// oldest first. Days after today are null; days without data are level 0.
export function buildWeeks(
  days: readonly ContributionDay[],
  count: number,
  today: Date,
): Array<Array<ContributionDay | null>> {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const todayKey = localDateKey(today);
  const firstSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - (count - 1) * 7);
  return Array.from({ length: count }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const key = localDateKey(
        new Date(firstSunday.getFullYear(), firstSunday.getMonth(), firstSunday.getDate() + w * 7 + d),
      );
      if (key > todayKey) return null;
      return byDate.get(key) ?? { date: key, count: 0, level: 0 };
    }),
  );
}
