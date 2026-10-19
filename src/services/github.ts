// GIT COMMITS widget data (spec §3.5). The public REST API has no contribution
// calendar, so:
//   • no token  → github-contributions-api.jogruber.de (public, CORS-open,
//                 scrapes the profile calendar; public contributions only)
//   • PAT given → GitHub GraphQL contributionsCollection (includes private
//                 contributions when the user has that profile setting on)

import { netFetch } from '../lib/netFetch';
import { readCache, writeCache } from '../lib/cache';
import { localDateKey } from '../lib/time';

export type Level = 0 | 1 | 2 | 3 | 4;

export interface ContributionDay {
  date: string; // 'YYYY-MM-DD'
  count: number;
  level: Level;
}

export interface GitStats {
  username: string;
  days: ContributionDay[]; // ascending, ~1 year
  totalYear: number; // current calendar year
  currentStreak: number;
  longestStreak: number;
  fetchedAt: number;
}

export const GIT_TTL_MS = 3 * 60 * 60 * 1000; // refreshed (and cached) every 3 hours; ↻ refreshes at once
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
  const fetcher = opts.fetcher ?? netFetch;
  const days = await (token ? fetchWithToken(user, token, fetcher) : fetchPublic(user, fetcher));
  const stats = computeStats(user, days);
  writeCache(CACHE_NAME, cacheKey(user, token), stats);
  return stats;
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

// ---- Repositories (Git widget repo picker) ------------------------------------

export interface RepoSummary {
  name: string;
  fullName: string; // owner/name
  defaultBranch: string;
  pushedAt: number; // epoch ms
  url: string;
  fork: boolean;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number; // issues + pull requests
  description: string | null;
}

export interface GitProfile {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  publicRepos: number;
}

// Avatar and repo count for the Git widget header.
export async function loadProfile(
  username: string,
  token: string,
  opts: { force?: boolean; fetcher?: Fetch } = {},
): Promise<GitProfile> {
  const key = `profile|${cacheKey(username, token)}`;
  if (!opts.force) {
    const hit = readCache<GitProfile>(CACHE_NAME, key, GIT_TTL_MS);
    if (hit) return hit;
  }
  const u = await ghJson<{
    login: string;
    name: string | null;
    avatar_url: string;
    html_url: string;
    public_repos: number;
  }>(`https://api.github.com/users/${encodeURIComponent(username)}`, token, opts.fetcher ?? netFetch);
  const profile: GitProfile = {
    login: u.login,
    name: u.name,
    avatarUrl: u.avatar_url,
    url: u.html_url,
    publicRepos: u.public_repos,
  };
  writeCache(CACHE_NAME, key, profile);
  return profile;
}

export interface RepoCommit {
  sha: string; // short
  message: string; // first line
  author: string | null;
  at: number; // epoch ms
  url: string;
}

export interface RepoActivity {
  fullName: string;
  branch: string; // where the latest push landed (default branch if unknown)
  commits: RepoCommit[]; // newest first, up to 3
  fetchedAt: number;
}

const ghHeaders = (token: string): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function ghJson<T>(url: string, token: string, fetcher: Fetch): Promise<T> {
  const res = await fetcher(url, { headers: ghHeaders(token) });
  if (res.status === 403 || res.status === 429) throw new Error('GitHub rate limit reached — try again later');
  if (res.status === 404) throw new Error('Not found on GitHub');
  if (!res.ok) throw new Error(`GitHub request failed (${res.status})`);
  return (await res.json()) as T;
}

// The user's own public repositories, most recently pushed first.
export async function loadRepos(
  username: string,
  token: string,
  opts: { force?: boolean; fetcher?: Fetch } = {},
): Promise<RepoSummary[]> {
  const key = `repos2|${cacheKey(username, token)}`; // v2: with language, stars, forks
  if (!opts.force) {
    const hit = readCache<RepoSummary[]>(CACHE_NAME, key, GIT_TTL_MS);
    if (hit) return hit;
  }
  const raw = await ghJson<
    Array<{
      name: string;
      full_name: string;
      default_branch: string;
      pushed_at: string | null;
      html_url: string;
      fork: boolean;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
      description: string | null;
    }>
  >(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&per_page=100`,
    token,
    opts.fetcher ?? netFetch,
  );
  const repos = raw
    .map((r) => ({
      name: r.name,
      fullName: r.full_name,
      defaultBranch: r.default_branch,
      pushedAt: r.pushed_at ? Date.parse(r.pushed_at) : 0,
      url: r.html_url,
      fork: r.fork,
      language: r.language ?? null,
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      openIssues: r.open_issues_count ?? 0,
      description: r.description ?? null,
    }))
    .sort((a, b) => b.pushedAt - a.pushedAt);
  writeCache(CACHE_NAME, key, repos);
  return repos;
}

// The branch with the latest push in a repository (from its public events;
// the default branch when there are none) and that branch's newest commits.
export async function loadRepoActivity(
  repo: Pick<RepoSummary, 'fullName' | 'defaultBranch'>,
  token: string,
  opts: { force?: boolean; fetcher?: Fetch } = {},
): Promise<RepoActivity> {
  const key = `activity2|${repo.fullName.toLowerCase()}|${token ? 'pat' : 'public'}`;
  if (!opts.force) {
    const hit = readCache<RepoActivity>(CACHE_NAME, key, GIT_TTL_MS);
    if (hit) return hit;
  }
  const fetcher = opts.fetcher ?? netFetch;
  const base = `https://api.github.com/repos/${repo.fullName}`;
  const [rawEvents, branchList] = await Promise.all([
    ghJson<Array<{ type: string; created_at: string; payload: { ref?: string } }>>(
      `${base}/events?per_page=30`,
      token,
      fetcher,
    ).catch(() => []),
    ghJson<Array<{ name: string }>>(`${base}/branches?per_page=100`, token, fetcher).catch(() => null),
  ]);
  // Newest push first; a branch deleted since (e.g. merged and removed) is skipped.
  const existing = Array.isArray(branchList) ? new Set(branchList.map((b) => b.name)) : null;
  const events = Array.isArray(rawEvents) ? rawEvents : [];
  const branch =
    [...events]
      .filter((e) => e.type === 'PushEvent' && e.payload.ref?.startsWith('refs/heads/'))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((e) => e.payload.ref!.replace('refs/heads/', ''))
      .find((name) => !existing || existing.has(name)) ?? repo.defaultBranch;
  const commits = await ghJson<
    Array<{ sha: string; html_url: string; commit: { message: string; author: { name?: string; date?: string } | null } }>
  >(`${base}/commits?sha=${encodeURIComponent(branch)}&per_page=3`, token, fetcher).catch(() => []); // empty repo
  const activity: RepoActivity = {
    fullName: repo.fullName,
    branch,
    commits: commits.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author?.name ?? null,
      at: c.commit.author?.date ? Date.parse(c.commit.author.date) : 0,
      url: c.html_url,
    })),
    fetchedAt: Date.now(),
  };
  writeCache(CACHE_NAME, key, activity);
  return activity;
}
