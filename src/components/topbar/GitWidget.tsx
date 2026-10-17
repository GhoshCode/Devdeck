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
  type ReactNode,
} from 'react';
import { useStore } from '../../store';
import {
  GIT_TTL_MS,
  buildWeeks,
  cachedGitStats,
  loadGitStats,
  loadRepoDetail,
  loadRepos,
  type ContributionDay,
  type GitStats,
  type Level,
  type RepoDetail,
  type RepoSummary,
} from '../../services/github';

// GIT COMMITS (spec §3.5), two halves:
//   left  — the last three months of contribution tiles, streaks in the header
//   right — your repositories: pick one (count + names), then a branch, and see
//           that branch's latest commit
// Everything refreshes every 30 minutes (↻ forces it). With no username it
// shows an inline setup field.

const WEEKS = 13; // ≈ 3 months
const CELL = 10; // largest tile size (px)
const MIN_CELL = 6;
const GAP = 2;

// GitHub's greens; the --gh-* tokens switch to the light palette in light mode.
const LEVEL_BG: Record<Level, string> = {
  0: 'var(--gh-0)',
  1: 'var(--gh-1)',
  2: 'var(--gh-2)',
  3: 'var(--gh-3)',
  4: 'var(--gh-4)',
};

type Load<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; data: T | null; error?: string };

export const GitWidget = memo(function GitWidget() {
  const username = useStore((s) => s.settings.githubUsername);
  const token = useStore((s) => s.settings.githubToken);
  const gitRepo = useStore((s) => s.settings.gitRepo ?? null);
  const gitBranch = useStore((s) => s.settings.gitBranch ?? null);
  const updateSettings = useStore((s) => s.updateSettings);

  const [stats, setStats] = useState<Load<GitStats>>(() => {
    const hit = username ? cachedGitStats(username, token) : null;
    return { status: hit ? 'ready' : 'idle', data: hit };
  });
  const [repos, setRepos] = useState<Load<RepoSummary[]>>({ status: 'idle', data: null });
  const [detail, setDetail] = useState<Load<RepoDetail>>({ status: 'idle', data: null });
  const [hovered, setHovered] = useState<ContributionDay | null>(null);

  const message = (err: unknown) => (err instanceof Error ? err.message : 'GitHub unavailable');

  const refresh = useCallback(
    (force: boolean) => {
      if (!username) return;
      setStats((s) => ({ ...s, status: 'loading' }));
      loadGitStats(username, token, { force })
        .then((data) => setStats({ status: 'ready', data }))
        .catch((err) => setStats((s) => ({ ...s, status: 'error', error: message(err) })));
      setRepos((s) => ({ ...s, status: 'loading' }));
      loadRepos(username, token, { force })
        .then((data) => setRepos({ status: 'ready', data }))
        .catch((err) => setRepos((s) => ({ ...s, status: 'error', error: message(err) })));
    },
    [username, token],
  );

  useEffect(() => {
    refresh(false);
    const timer = setInterval(() => refresh(false), GIT_TTL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // The selected repo, else the most recently pushed one.
  const repo = useMemo(() => {
    const list = repos.data ?? [];
    return list.find((r) => r.fullName === gitRepo) ?? list[0] ?? null;
  }, [repos.data, gitRepo]);
  const branch = repo && gitRepo === repo.fullName ? gitBranch : null;

  const loadDetail = useCallback(
    (force: boolean) => {
      if (!repo) return;
      setDetail((s) => ({ ...s, status: 'loading' }));
      loadRepoDetail(repo, branch, token, { force })
        .then((data) => setDetail({ status: 'ready', data }))
        .catch((err) => setDetail((s) => ({ ...s, status: 'error', error: message(err) })));
    },
    [repo, branch, token],
  );
  useEffect(() => loadDetail(false), [loadDetail]);

  if (!username) return <GitSetup />;

  const days = stats.data?.days ?? [];
  const loading = stats.status === 'loading' || repos.status === 'loading' || detail.status === 'loading';
  const shownDetail = detail.data && repo && detail.data.fullName === repo.fullName ? detail.data : null;

  return (
    <div data-testid="git-widget" className="glass @container flex h-full min-w-0 flex-col gap-1.5 px-3 pt-2 pb-2">
      {/* Header: who, streaks, refresh */}
      <div className="flex min-w-0 items-center gap-2">
        <GitHubMark />
        <a
          href={`https://github.com/${username}`}
          className="truncate font-display text-[11px] font-semibold tracking-[0.12em] text-white/80 uppercase hover:text-white"
          title="Open GitHub profile"
        >
          {username}
        </a>
        <span data-git-stats className="ml-auto flex shrink-0 items-baseline gap-2.5 font-mono whitespace-nowrap">
          <Stat value={stats.data?.currentStreak} unit="d" label="streak" accent />
          <span className="hidden @min-[340px]:contents">
            <Stat value={stats.data?.longestStreak} unit="d" label="best" />
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            refresh(true);
            loadDetail(true);
          }}
          aria-label="Refresh contributions"
          title={stats.data ? `Updated ${new Date(stats.data.fetchedAt).toLocaleTimeString()} — refresh` : 'Refresh'}
          className={`shrink-0 text-xs text-white/35 hover:text-white/80 ${loading ? 'animate-spin' : ''}`}
        >
          ↻
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* Left: three months of tiles */}
        <div className="flex min-h-0 shrink-0 flex-col gap-1">
          {stats.status === 'error' && !stats.data ? (
            <p className="w-[140px] text-[11px] text-red-300/80" role="alert">
              {stats.error}
            </p>
          ) : (
            <Heatmap days={days} loading={!stats.data} onHover={setHovered} />
          )}
          <p data-testid="git-activity" className="truncate font-mono text-[9px] text-white/55">
            {hovered ? (
              <span className="text-emerald-300">
                {hovered.count} on {formatDay(hovered.date)}
              </span>
            ) : (
              `${lastWeeksTotal(days, WEEKS)} in 3 months`
            )}
          </p>
        </div>

        {/* Right: repos → branch → latest commit */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 border-l border-white/[0.07] pl-3">
          <Picker
            label="Repository"
            icon="📁"
            value={repo?.name ?? (repos.status === 'error' ? 'Repos unavailable' : 'Loading repos…')}
            badge={repos.data ? `${repos.data.length} ${repos.data.length === 1 ? 'repo' : 'repos'}` : undefined}
            options={(repos.data ?? []).map((r) => ({ id: r.fullName, label: r.name, hint: ago(r.pushedAt, Date.now()) }))}
            selected={repo?.fullName ?? null}
            searchable
            onPick={(id) => updateSettings({ gitRepo: id, gitBranch: null })}
            title={repos.error}
          />
          <Picker
            label="Branch"
            icon="⎇"
            mono
            value={shownDetail?.branch ?? repo?.defaultBranch ?? '—'}
            badge={shownDetail ? `${shownDetail.branches.length} ${shownDetail.branches.length === 1 ? 'branch' : 'branches'}` : undefined}
            options={(shownDetail?.branches ?? []).map((b) => ({
              id: b,
              label: b,
              hint: b === repo?.defaultBranch ? 'default' : undefined,
            }))}
            selected={shownDetail?.branch ?? null}
            searchable={(shownDetail?.branches.length ?? 0) > 8}
            onPick={(id) => repo && updateSettings({ gitRepo: repo.fullName, gitBranch: id === repo.defaultBranch ? null : id })}
            disabled={!shownDetail}
          />
          <LatestCommit detail={shownDetail} status={detail.status} error={detail.error} />
        </div>
      </div>
    </div>
  );
});

function LatestCommit({ detail, status, error }: { detail: RepoDetail | null; status: Load<RepoDetail>['status']; error?: string }) {
  if (!detail) {
    return (
      <p className="font-mono text-[10px] text-white/45">
        {status === 'error' ? (error ?? 'Unavailable') : status === 'loading' ? 'Loading latest commit…' : ' '}
      </p>
    );
  }
  if (!detail.commit) return <p className="text-[10px] text-white/45">No commits on this branch yet</p>;
  const c = detail.commit;
  return (
    <a
      data-testid="git-latest-commit"
      href={c.url}
      title={`${c.message}${c.author ? ` — ${c.author}` : ''}`}
      className="group/commit block min-w-0 rounded-md text-[10.5px] leading-snug"
    >
      <span className="flex items-center gap-1.5 font-mono text-[9.5px]">
        <span className="text-amber-300">{c.sha}</span>
        <span className="text-white/45">{ago(c.at, Date.now())}</span>
        {c.author && <span className="truncate text-white/45">· {c.author}</span>}
      </span>
      <span className="line-clamp-1 text-white/80 group-hover/commit:text-white">{c.message}</span>
    </a>
  );
}

// A compact field-like button that opens a list (optionally searchable).
function Picker({
  label,
  icon,
  value,
  badge,
  options,
  selected,
  searchable = false,
  mono = false,
  disabled = false,
  title,
  onPick,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  badge?: string;
  options: Array<{ id: string; label: string; hint?: string }>;
  selected: string | null;
  searchable?: boolean;
  mono?: boolean;
  disabled?: boolean;
  title?: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openList = () => {
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.id === selected)));
    setOpen(true);
  };
  const pick = (id: string) => {
    onPick(id);
    setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (shown.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length);
    } else if (e.key === 'Enter' && shown[active]) {
      e.preventDefault();
      pick(shown[active].id);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0" onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => (open ? setOpen(false) : openList())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        title={title ?? `${label}: ${value}`}
        className="git-picker flex w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-[3px] text-left disabled:cursor-default"
      >
        <span aria-hidden className="shrink-0 text-[10px] text-white/55">
          {icon}
        </span>
        <span className={`min-w-0 flex-1 truncate text-[11px] font-semibold text-white/90 ${mono ? 'font-mono' : ''}`}>{value}</span>
        {badge && <span className="shrink-0 font-mono text-[9px] text-white/50">{badge}</span>}
        <svg className={`size-3 shrink-0 text-white/45 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="dropdown-menu absolute top-full right-0 z-50 mt-1 w-[max(100%,240px)] overflow-hidden rounded-xl border shadow-2xl">
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder={`Find a ${label.toLowerCase()}…`}
              aria-label={`Find a ${label.toLowerCase()}`}
              className="w-full border-b border-white/[0.08] bg-transparent px-3 py-2 text-xs text-white placeholder-white/35 outline-none"
            />
          )}
          <div role="listbox" aria-label={`${label} list`} className="ultra-thin-scrollbar max-h-[240px] overflow-y-auto py-1">
            {shown.map((o, i) => (
              <div
                key={o.id}
                role="option"
                aria-selected={o.id === selected}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.id)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs ${active === i ? 'dropdown-active' : ''}`}
              >
                <span className={`min-w-0 flex-1 truncate text-white/90 ${mono ? 'font-mono' : ''}`}>{o.label}</span>
                {o.hint && <span className="shrink-0 font-mono text-[10px] text-white/45">{o.hint}</span>}
                {o.id === selected && <span className="text-[var(--color-accent)]">✓</span>}
              </div>
            ))}
            {shown.length === 0 && <p className="px-3 py-2 text-xs text-white/45">No match</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function lastWeeksTotal(days: readonly ContributionDay[], weeks: number): number {
  const cols = buildWeeks(days, weeks, new Date());
  return cols.flat().reduce((sum, d) => sum + (d?.count ?? 0), 0);
}

const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const formatDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayFmt.format(new Date(y, m - 1, d));
};

function ago(then: number, now: number): string {
  if (!then) return '';
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
      <span className={`text-[13px] font-bold tabular-nums ${accent ? 'text-[#39d353]' : 'text-white/90'}`}>
        {value ?? '–'}
        {value !== undefined && unit}
      </span>
      <span className="text-[9px] tracking-wider text-white/45 uppercase">{label}</span>
    </span>
  );
}

// Thirteen Sunday-first week columns (≈ 3 months), newest on the right. Tile
// size follows the available height so all seven rows fit.
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

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const byHeight = Math.floor((el.clientHeight + GAP) / 7) - GAP;
      setCell(Math.max(MIN_CELL, Math.min(CELL, byHeight || CELL)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => buildWeeks(days, WEEKS, new Date()), [days]);

  return (
    <div
      ref={ref}
      onMouseLeave={() => onHover(null)}
      className="min-h-0 flex-1 overflow-hidden"
      style={{ width: WEEKS * (cell + GAP) - GAP }}
      aria-label="Contribution graph, last 3 months"
    >
      <div className="flex" style={{ gap: GAP }}>
        {columns.map((week, i) => (
          <div key={i} className="flex flex-col" style={{ gap: GAP }}>
            {week.map((day, j) => (
              <span
                key={j}
                onMouseEnter={day ? () => onHover(day) : undefined}
                title={day ? `${day.count} contribution${day.count === 1 ? '' : 's'} on ${formatDay(day.date)}` : undefined}
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
