import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useStore } from '../../store';
import {
  GIT_TTL_MS,
  buildWeeks,
  cachedGitStats,
  loadGitStats,
  type ContributionDay,
  type GitStats,
  type Level,
} from '../../services/github';

// GIT COMMITS (spec §3.5): classic green contribution tiles sized to the
// widget (16–52 weeks), plus current streak, longest streak and the
// calendar-year total. With no username it shows an inline setup field.

const CELL = 9; // largest tile size (px)
const MIN_CELL = 6;
const GAP = 2;
const MIN_WEEKS = 16;
const MAX_WEEKS = 52;

// GitHub's greens; the --gh-* tokens switch to the light palette in light mode.
const LEVEL_BG: Record<Level, string> = {
  0: 'var(--gh-0)',
  1: 'var(--gh-1)',
  2: 'var(--gh-2)',
  3: 'var(--gh-3)',
  4: 'var(--gh-4)',
};

type State =
  | { status: 'idle' | 'loading'; stats: GitStats | null }
  | { status: 'ready'; stats: GitStats }
  | { status: 'error'; stats: GitStats | null; error: string };

export const GitWidget = memo(function GitWidget() {
  const username = useStore((s) => s.settings.githubUsername);
  const token = useStore((s) => s.settings.githubToken);
  const [state, setState] = useState<State>(() => {
    const hit = username ? cachedGitStats(username, token) : null;
    return hit ? { status: 'ready', stats: hit } : { status: 'idle', stats: null };
  });
  const [hovered, setHovered] = useState<ContributionDay | null>(null);

  const refresh = useCallback(
    (force: boolean) => {
      if (!username) return;
      setState((s) => ({ status: 'loading', stats: s.stats?.username === username ? s.stats : null }));
      loadGitStats(username, token, { force })
        .then((stats) => setState({ status: 'ready', stats }))
        .catch((err: unknown) =>
          setState((s) => ({
            status: 'error',
            stats: s.stats,
            error: err instanceof Error ? err.message : 'GitHub unavailable',
          })),
        );
    },
    [username, token],
  );

  useEffect(() => {
    refresh(false);
    const timer = setInterval(() => refresh(false), GIT_TTL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!username) return <GitSetup />;

  const { stats } = state;
  const error = state.status === 'error' ? state.error : null;

  const activity = stats?.activity;
  const now = Date.now();

  return (
    <div data-testid="git-widget" className="glass flex h-full min-w-0 flex-col gap-1.5 px-3 pt-2.5 pb-2">
      {/* Header: who, how many repos, latest branch */}
      <div className="flex min-w-0 items-center gap-1.5">
        <GitHubMark />
        <a
          href={`https://github.com/${username}`}
          className="truncate font-display text-[11px] font-semibold tracking-[0.12em] text-white/80 uppercase hover:text-white"
          title="Open GitHub profile"
        >
          {username}
        </a>
        {activity?.publicRepos != null && (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-1.5 font-mono text-[9px] text-white/60">
            {activity.publicRepos} {activity.publicRepos === 1 ? 'repo' : 'repos'}
          </span>
        )}
        <span className="ml-auto" />
        {activity?.branch && (
          <a
            href={activity.repo ? `https://github.com/${activity.repo}/tree/${encodeURIComponent(activity.branch)}` : undefined}
            title={`Latest push: ${activity.repo ?? ''} · ${activity.branch}`}
            className="flex max-w-[45%] min-w-0 items-center gap-1 rounded-md border border-purple-400/30 bg-purple-500/15 px-1.5 font-mono text-[9px] font-semibold text-purple-300"
          >
            <span aria-hidden>⎇</span>
            <span className="truncate">{activity.branch}</span>
          </a>
        )}
        <button
          type="button"
          onClick={() => refresh(true)}
          aria-label="Refresh contributions"
          title={stats ? `Updated ${new Date(stats.fetchedAt).toLocaleTimeString()} — refresh` : 'Refresh'}
          className={`shrink-0 text-xs text-white/35 hover:text-white/80 ${state.status === 'loading' ? 'animate-spin' : ''}`}
        >
          ↻
        </button>
      </div>

      <div data-git-stats className="flex items-baseline gap-4 font-mono">
        <Stat value={stats?.currentStreak} unit="d" label="streak" accent />
        <Stat value={stats?.longestStreak} unit="d" label="longest" />
        <Stat value={stats?.totalYear} label={`in ${new Date().getFullYear()}`} />
        <span aria-hidden className="ml-auto flex shrink-0 items-center gap-0.5 self-center text-[9px] text-white/30">
          Less
          {([0, 1, 2, 3, 4] as const).map((l) => (
            <span key={l} className="inline-block size-[7px] rounded-[1.5px]" style={{ background: LEVEL_BG[l] }} />
          ))}
          More
        </span>
      </div>

      {error && !stats ? (
        <p className="text-xs text-red-300/80" role="alert">
          {error}
        </p>
      ) : (
        <Heatmap days={stats?.days ?? []} loading={!stats} onHover={setHovered} />
      )}

      {/* Footer: the hovered day, else the latest merge and commit */}
      <div className="flex min-w-0 items-center gap-2 font-mono text-[9px] leading-tight text-white/55">
        <span data-testid="git-activity" className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          {hovered ? (
            <span className="text-emerald-300">
              {hovered.count} contribution{hovered.count === 1 ? '' : 's'} on {formatDay(hovered.date)}
            </span>
          ) : (
            <>
              {activity?.mergedPr && (
                <a
                  href={`https://github.com/${activity.mergedPr.repo}/pull/${activity.mergedPr.number}`}
                  className="shrink-0 text-cyan-300 hover:underline"
                  title={`${activity.mergedPr.repo} #${activity.mergedPr.number} merged`}
                >
                  ⇄ PR #{activity.mergedPr.number} merged {ago(activity.mergedPr.at, now)}
                </a>
              )}
              {activity?.mergedPr && activity.commitSha && <span className="text-white/25">·</span>}
              {activity?.commitSha && (
                <a
                  href={activity.repo ? `https://github.com/${activity.repo}/commit/${activity.commitSha}` : undefined}
                  className="flex min-w-0 items-center gap-1 hover:text-white/80"
                  title={activity.commitMessage ?? undefined}
                >
                  <span className="shrink-0 text-amber-300">{activity.commitSha}</span>
                  {activity.commitMessage && <span className="truncate font-sans">“{activity.commitMessage}”</span>}
                  {activity.commitAt && <span className="shrink-0 text-white/35">{ago(activity.commitAt, now)}</span>}
                </a>
              )}
              {!activity?.mergedPr && !activity?.commitSha && stats && (
                <span className="text-white/35">No recent public activity</span>
              )}
            </>
          )}
        </span>
      </div>
    </div>
  );
});

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const formatDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayFmt.format(new Date(y, m - 1, d));
};

function ago(then: number, now: number): string {
  const mins = Math.max(0, Math.round((now - then) / 60_000));
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
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
    <span className="flex items-baseline gap-1">
      <span className={`text-[15px] font-bold tabular-nums ${accent ? 'text-[#39d353]' : 'text-white/90'}`}>
        {value ?? '–'}
        {value !== undefined && unit}
      </span>
      <span className="text-[9px] tracking-wider text-white/40 uppercase">{label}</span>
    </span>
  );
}

// Columns are Sunday-first weeks, newest on the right. Tile size follows the
// available height (7 rows must fit) and the week count follows the width.
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
  const [weeks, setWeeks] = useState(MIN_WEEKS);
  const [cell, setCell] = useState(CELL);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const byHeight = Math.floor((el.clientHeight + GAP) / 7) - GAP;
      const size = Math.max(MIN_CELL, Math.min(CELL, byHeight || CELL));
      setCell(size);
      const fit = Math.floor((el.clientWidth + GAP) / (size + GAP));
      setWeeks(Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, fit)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => buildWeeks(days, weeks, new Date()), [days, weeks]);

  return (
    <div ref={ref} onMouseLeave={() => onHover(null)} className="min-h-0 min-w-0 flex-1 overflow-hidden" aria-label="Contribution graph">
      <div className="flex justify-end" style={{ gap: GAP }}>
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
