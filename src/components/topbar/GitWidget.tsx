import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useStore } from '../../store';
import { LoadingBar } from '../ui/LoadingBar';
import { localDateKey } from '../../lib/time';
import {
  GIT_TTL_MS,
  buildWeeks,
  cachedGitStats,
  loadGitStats,
  loadProfile,
  loadRepoActivity,
  loadRepos,
  type ContributionDay,
  type GitProfile,
  type GitStats,
  type Level,
  type RepoActivity,
  type RepoSummary,
} from '../../services/github';

// GIT COMMITS (spec §3.5), top to bottom:
//   header  — avatar, @username, public repo count; on the right the repo you
//             pushed to last, shown as text — click it to
//             turn it into a searchable list of all your repos
//   tiles   — exactly the last six months up to today, month labels on top;
//             streak, best streak, total and active days beside them
//   branch  — the branch with that repo's latest push (still existing), and its
//             newest commits;
//             every commit links to GitHub
// Everything refreshes every 30 minutes (↻ forces it). With no username it
// shows an inline setup field.

const CELL = 12; // largest tile size (px) — leaves room for the stats beside the tiles
const MIN_CELL = 6;
const GAP = 2;
const MONTHS_BACK = 6;

// GitHub's greens; the --gh-* tokens switch to the light palette in light mode.
const LEVEL_BG: Record<Level, string> = {
  0: 'var(--gh-0)',
  1: 'var(--gh-1)',
  2: 'var(--gh-2)',
  3: 'var(--gh-3)',
  4: 'var(--gh-4)',
};

// GitHub linguist colours for the languages people use most.
const LANG_COLOR: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  'C#': '#178600',
  'C++': '#f34b7d',
  C: '#555555',
  Ruby: '#701516',
  PHP: '#4F5D95',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Dart: '#00B4AB',
  Vue: '#41b883',
};

type Load<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; data: T | null; error?: string };
const message = (err: unknown) => (err instanceof Error ? err.message : 'GitHub unavailable');

// Runs a loader into a Load<T> state slot.
function useLoad<T>() {
  const [state, setState] = useState<Load<T>>({ status: 'idle', data: null });
  const run = useCallback((p: Promise<T>) => {
    setState((s) => ({ ...s, status: 'loading' }));
    p.then((data) => setState({ status: 'ready', data })).catch((err) =>
      setState((s) => ({ ...s, status: 'error', error: message(err) })),
    );
  }, []);
  return [state, run, setState] as const;
}

export const GitWidget = memo(function GitWidget() {
  const username = useStore((s) => s.settings.githubUsername);
  const token = useStore((s) => s.settings.githubToken);
  const gitRepo = useStore((s) => s.settings.gitRepo ?? null);
  const updateSettings = useStore((s) => s.updateSettings);

  const [stats, runStats, setStats] = useLoad<GitStats>();
  const [profile, runProfile] = useLoad<GitProfile>();
  const [repos, runRepos] = useLoad<RepoSummary[]>();
  const [activity, runActivity] = useLoad<RepoActivity>();
  const [hovered, setHovered] = useState<ContributionDay | null>(null);

  // Show cached contributions immediately.
  useLayoutEffect(() => {
    const hit = username ? cachedGitStats(username, token) : null;
    if (hit) setStats({ status: 'ready', data: hit });
  }, [username, token, setStats]);

  const refresh = useCallback(
    (force: boolean) => {
      if (!username) return;
      runStats(loadGitStats(username, token, { force }));
      runProfile(loadProfile(username, token, { force }));
      runRepos(loadRepos(username, token, { force }));
    },
    [username, token, runStats, runProfile, runRepos],
  );

  useEffect(() => {
    refresh(false);
    const timer = setInterval(() => refresh(false), GIT_TTL_MS); // every 3 hours
    return () => clearInterval(timer);
  }, [refresh]);

  // The chosen repo, else the one with the most recent push.
  const repo = useMemo(() => {
    const list = repos.data ?? [];
    return list.find((r) => r.fullName === gitRepo) ?? list[0] ?? null;
  }, [repos.data, gitRepo]);

  const loadActivity = useCallback(
    (force: boolean) => {
      if (repo) runActivity(loadRepoActivity(repo, token, { force }));
    },
    [repo, token, runActivity],
  );
  useEffect(() => {
    loadActivity(false);
    const timer = setInterval(() => loadActivity(false), GIT_TTL_MS);
    return () => clearInterval(timer);
  }, [loadActivity]);

  if (!username) return <GitSetup />;

  const loading = [stats, profile, repos, activity].some((l) => l.status === 'loading');
  const shown = activity.data && repo && activity.data.fullName === repo.fullName ? activity.data : null;
  const now = Date.now();
  const updatedAt = stats.data?.fetchedAt;

  return (
    <div data-testid="git-widget" className="glass @container relative flex h-full min-w-0 flex-col gap-1 px-3 pt-2.5 pb-2">
      <LoadingBar active={loading} label="Loading GitHub activity" className="absolute inset-x-3 top-0" />
      {/* Profile */}
      <div className="flex min-w-0 items-center gap-2">
        <a href={profile.data?.url ?? `https://github.com/${username}`} className="shrink-0" title={`@${username} on GitHub`}>
          {profile.data ? (
            <img src={profile.data.avatarUrl} alt="" className="size-6 rounded-full ring-1 ring-white/15" loading="lazy" />
          ) : (
            <span className="flex size-6 items-center justify-center rounded-full bg-white/[0.06]">
              <GitHubMark />
            </span>
          )}
        </a>
        <div className="min-w-0 shrink-0 leading-tight">
          <a
            href={profile.data?.url ?? `https://github.com/${username}`}
            className="block truncate text-[13.5px] font-semibold text-white/95 hover:underline"
          >
            @{profile.data?.login ?? username}
          </a>
          {profile.data && (
            <span className="block truncate font-mono text-[9.5px] text-white/50">
              {profile.data.publicRepos} public {profile.data.publicRepos === 1 ? 'repo' : 'repos'}
            </span>
          )}
        </div>

        {/* Repo — text until clicked, top right */}
        <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5">
          <span className="shrink-0 font-display text-[9px] font-semibold tracking-[0.18em] text-white/45 uppercase">Repo</span>
          <RepoSelector
            repos={repos.data ?? []}
            current={repo}
            status={repos.status}
            error={repos.error}
            onPick={(id) => updateSettings({ gitRepo: id })}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            refresh(true);
            loadActivity(true);
          }}
          aria-label="Refresh contributions"
          title={`${updatedAt ? `Updated ${ago(updatedAt, now)} · ` : ''}refresh now (auto every 30 min)`}
          className={`shrink-0 text-xs text-white/40 hover:text-white/85 ${loading ? 'animate-spin' : ''}`}
        >
          ↻
        </button>
      </div>

      {/* Six months of tiles, stats beside them */}
      <div className="flex min-h-0 flex-1 gap-4">
        {stats.status === 'error' && !stats.data ? (
          <p className="flex-1 text-[11px] text-red-300/80" role="alert">
            {stats.error}
          </p>
        ) : (
          <Heatmap days={stats.data?.days ?? []} loading={!stats.data} onHover={setHovered} />
        )}
        <StatsColumn stats={stats.data} hovered={hovered} />
      </div>

      {/* The branch with the latest push, and its newest commits */}
      <RecentCommits repo={repo} activity={shown} status={activity.status} error={activity.error} now={now} />
    </div>
  );
});

// ---- Repo selector: plain text that turns into a searchable list ----------------

function RepoSelector({
  repos,
  current,
  status,
  error,
  onPick,
}: {
  repos: RepoSummary[];
  current: RepoSummary | null;
  status: Load<unknown>['status'];
  error?: string;
  onPick: (fullName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const shown = q ? repos.filter((r) => r.name.toLowerCase().includes(q)) : repos;
  const now = Date.now();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (id: string) => {
    onPick(id);
    setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (shown.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length);
    } else if (e.key === 'Enter' && shown[active]) {
      e.preventDefault();
      pick(shown[active].fullName);
    }
  };

  if (!current) {
    return (
      <span className="truncate text-[12px] text-white/50" title={error}>
        {status === 'error' ? (error ?? 'Repos unavailable') : status === 'loading' ? 'Loading repos…' : 'No public repos'}
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative flex min-w-0 justify-end">
      {open ? (
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={`Search ${repos.length} repositories…`}
          aria-label="Search repositories"
          role="combobox"
          aria-expanded
          aria-controls="git-repo-list"
          className="git-picker w-[220px] max-w-full rounded-md border px-2 py-[3px] text-[12px] text-white placeholder-white/40 outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setActive(Math.max(0, repos.findIndex((r) => r.fullName === current.fullName)));
            setOpen(true);
          }}
          aria-label={`Repository: ${current.name}. Click to choose another`}
          title={`${current.description ?? current.fullName} — click to choose another repository`}
          className="group/repo flex max-w-full min-w-0 items-center gap-1 text-left"
        >
          <span className="truncate text-[13px] font-semibold text-white group-hover/repo:underline">{current.name}</span>
          <span className="shrink-0 text-[10px] text-white/35 transition-colors group-hover/repo:text-white/70">▾</span>
        </button>
      )}
      {open && (
        <div className="dropdown-menu absolute top-full right-0 z-50 mt-1 w-[280px] overflow-hidden rounded-xl border shadow-2xl">
          <div id="git-repo-list" role="listbox" aria-label="Repositories" className="ultra-thin-scrollbar max-h-[260px] overflow-y-auto py-1">
            {shown.map((r, i) => (
              <div
                key={r.fullName}
                role="option"
                aria-selected={r.fullName === current.fullName}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r.fullName)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${active === i ? 'dropdown-active' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-white/90">
                    {r.name}
                    {r.fork && <span className="ml-1 text-[9px] text-white/40">fork</span>}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[9.5px] text-white/45">
                    {r.language && (
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full" style={{ background: LANG_COLOR[r.language] ?? '#8b949e' }} />
                        {r.language}
                      </span>
                    )}
                    {r.stars > 0 && <span>★ {r.stars}</span>}
                    <span>pushed {ago(r.pushedAt, now)}</span>
                  </span>
                </span>
                {r.fullName === current.fullName && <span className="text-xs text-[var(--color-accent)]">✓</span>}
              </div>
            ))}
            {shown.length === 0 && <p className="px-3 py-2 text-xs text-white/45">No repository matches “{query}”</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Contributions ---------------------------------------------------------------

// The first day shown: the same date six months ago.
function windowStart(today: Date): Date {
  return new Date(today.getFullYear(), today.getMonth() - MONTHS_BACK, today.getDate());
}

function weeksSince(start: Date, today: Date): number {
  const sundayOfStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - start.getDay());
  return Math.floor((today.getTime() - sundayOfStart.getTime()) / (7 * 86_400_000)) + 1;
}

const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'short' });
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function windowDays(days: readonly ContributionDay[], today = new Date()): ContributionDay[] {
  const from = localDateKey(windowStart(today));
  const to = localDateKey(today);
  return days.filter((d) => d.date >= from && d.date <= to);
}

function StatsColumn({ stats, hovered }: { stats: GitStats | null; hovered: ContributionDay | null }) {
  const inWindow = stats ? windowDays(stats.days) : [];
  const total = inWindow.reduce((sum, d) => sum + d.count, 0);
  const active = inWindow.filter((d) => d.count > 0).length;
  return (
    <div data-git-stats className="flex min-w-0 shrink-0 flex-col justify-between font-mono">
      <div className="grid w-max grid-cols-[auto_auto] gap-x-3.5 gap-y-0.5">
        <Stat value={stats?.currentStreak} unit="d" label="streak" accent />
        <Stat value={stats?.longestStreak} unit="d" label="best" />
        <Stat value={stats ? total : undefined} label="6 months" />
        <Stat value={stats ? active : undefined} label="active" />
      </div>
      <p data-testid="git-activity" className="truncate text-[9px] text-white/55">
        {hovered ? (
          <span className="text-emerald-300">
            {hovered.count} contribution{hovered.count === 1 ? '' : 's'} · {formatDay(hovered.date)}
          </span>
        ) : (
          <span aria-hidden className="flex items-center gap-0.5 text-white/40">
            Less
            {([0, 1, 2, 3, 4] as const).map((l) => (
              <span key={l} className="inline-block size-[7px] rounded-[1.5px]" style={{ background: LEVEL_BG[l] }} />
            ))}
            More
          </span>
        )}
      </p>
    </div>
  );
}

// Sunday-first week columns covering exactly the last six months up to today
// (days outside the window stay blank), with month labels above.
function Heatmap({
  days,
  loading,
  onHover,
}: {
  days: readonly ContributionDay[];
  loading: boolean;
  onHover: (day: ContributionDay | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(CELL);
  const today = new Date();
  const start = windowStart(today);
  const startKey = localDateKey(start);
  const weeks = weeksSince(start, today);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const byHeight = Math.floor((el.clientHeight - 10 + GAP) / 7) - GAP; // 10px for month labels
      setCell(Math.max(MIN_CELL, Math.min(CELL, byHeight || CELL)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(
    () => buildWeeks(days, weeks, new Date()).map((week) => week.map((d) => (d && d.date >= startKey ? d : null))),
    [days, weeks, startKey],
  );
  // A month label over the first column that starts a new month (skipped when
  // the next month starts too soon for both to fit).
  const starts = columns.map((week, i) => {
    const first = week.find(Boolean);
    if (!first) return null;
    const month = first.date.slice(0, 7);
    return month === columns[i - 1]?.find(Boolean)?.date.slice(0, 7) ? null : month;
  });
  const labels = starts.map((month, i) => {
    if (!month || starts.slice(i + 1, i + 3).some(Boolean)) return null;
    const [y, m] = month.split('-').map(Number);
    return monthFmt.format(new Date(y, m - 1, 1));
  });

  return (
    <div
      ref={ref}
      onMouseLeave={() => onHover(null)}
      className="flex min-h-0 shrink-0 flex-col overflow-hidden"
      style={{ width: weeks * (cell + GAP) - GAP }}
      aria-label={`Contribution graph, ${dayFmt.format(start)} – ${dayFmt.format(today)}`}
      title={`${dayFmt.format(start)} – ${dayFmt.format(today)}`}
    >
      <div className="relative h-2.5 shrink-0 font-mono text-[8.5px] leading-none text-white/45">
        {labels.map((label, i) =>
          label ? (
            <span key={i} className="absolute top-0" style={{ left: i * (cell + GAP) }}>
              {label}
            </span>
          ) : null,
        )}
      </div>
      <div className="flex" style={{ gap: GAP }}>
        {columns.map((week, i) => (
          <div key={i} className="flex flex-col" style={{ gap: GAP }}>
            {week.map((day, j) => (
              <span
                key={j}
                onMouseEnter={day ? () => onHover(day) : undefined}
                className={loading ? 'animate-pulse' : 'transition-transform hover:scale-125'}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: 2,
                  background: day ? LEVEL_BG[day.level] : 'transparent',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Latest branch and commits ------------------------------------------------------

function RecentCommits({
  repo,
  activity,
  status,
  error,
  now,
}: {
  repo: RepoSummary | null;
  activity: RepoActivity | null;
  status: Load<RepoActivity>['status'];
  error?: string;
  now: number;
}) {
  if (!repo || !activity) {
    return (
      <p className="font-mono text-[10px] text-white/45">
        {status === 'error' ? (error ?? 'Unavailable') : repo || status === 'loading' ? 'Loading commits…' : ' '}
      </p>
    );
  }
  return (
    <div className="min-w-0 border-t border-white/[0.07] pt-1.5">
      <a
        href={`${repo.url}/tree/${encodeURIComponent(activity.branch)}`}
        className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] hover:underline"
        title={`Branch ${activity.branch} on GitHub`}
      >
        <span aria-hidden className="text-white/55">⎇</span>
        <span className="truncate font-semibold text-purple-300">{activity.branch}</span>
        <span className="shrink-0 text-[9px] text-white/45">latest push</span>
      </a>
      {activity.commits.length === 0 ? (
        <p className="mt-0.5 text-[10px] text-white/45">No commits on this branch yet</p>
      ) : (
        <ul data-testid="git-commits" className="mt-0.5 space-y-px">
          {activity.commits.slice(0, 2).map((c) => (
            <li key={c.sha}>
              <a
                href={c.url}
                title={`${c.message}${c.author ? ` — ${c.author}` : ''} · open on GitHub`}
                className="group/commit flex min-w-0 items-baseline gap-1.5 rounded text-[10.5px] leading-snug"
              >
                <span className="shrink-0 font-mono text-[9.5px] text-amber-300">{c.sha}</span>
                <span className="min-w-0 flex-1 truncate text-white/80 group-hover/commit:text-white group-hover/commit:underline">
                  {c.message}
                </span>
                <span className="shrink-0 font-mono text-[9px] text-white/45">{ago(c.at, now)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Helpers --------------------------------------------------------------------------

const formatDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayFmt.format(new Date(y, m - 1, d));
};

function ago(then: number, now: number): string {
  if (!then) return '';
  const mins = Math.max(0, Math.round((now - then) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : dayFmt.format(new Date(then));
}

function GitHubMark() {
  return (
    <svg className="size-3.5 shrink-0 text-[var(--gh-4)]" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function Stat({ value, unit = '', label, accent = false }: { value?: number; unit?: string; label: string; accent?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className={`text-[14px] font-bold tabular-nums ${accent ? 'text-[#39d353]' : 'text-white/90'}`}>
        {value ?? '–'}
        {value !== undefined && unit}
      </span>
      <span className="truncate text-[8.5px] tracking-wider text-white/45 uppercase">{label}</span>
    </span>
  );
}

function GitSetup() {
  const updateSettings = useStore((s) => s.updateSettings);
  const [value, setValue] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = value.trim().replace(/^@/, '');
    if (name) updateSettings({ githubUsername: name });
  };
  return (
    <form onSubmit={submit} data-testid="git-widget" className="glass flex h-full flex-col justify-center gap-2 px-4">
      <h2 className="font-display text-[11px] font-semibold tracking-[0.2em] text-white/60">GIT COMMITS</h2>
      <p className="text-xs text-white/45">Show your contribution tiles — enter your GitHub username.</p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="username"
          aria-label="GitHub username"
          className="glass-inner min-w-0 flex-1 rounded-lg px-2.5 py-1.5 font-mono text-xs text-white/90 outline-none placeholder:text-white/30"
        />
        <button type="submit" className="accent-gradient rounded-lg px-3 text-xs font-semibold text-white">
          Connect
        </button>
      </div>
    </form>
  );
}
