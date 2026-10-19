import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SplitPanes } from '../layout/SplitPanes';
import { useStore } from '../../store';
import type { Topic } from '../../types';
import { useNow } from '../../hooks/useNow';
import { FEED_TTL_MS, cachedFeeds, loadFeeds, selectPanel, type FeedItem, type FeedResult } from '../../services/feeds';
import { relativeAge } from '../../services/search';
import { SlidersIcon } from '../ui/icons';
import { LoadingBar } from '../ui/LoadingBar';

// Right column (plan Phase 5): I — tech news (items 1–4) and developer jobs
// (items 5–8) — over J, the topic chips that filter both panels.

// Items per panel: Settings → Scraping sets each from 0 to 100.
const DEFAULT_PER_PANEL = 4;
const perPanel = (n: number | undefined) => Math.min(100, Math.max(0, Math.round(n ?? DEFAULT_PER_PANEL)));

export const FeedColumn = memo(function FeedColumn({ onManage }: { onManage: () => void }) {
  const feeds = useStore((s) => s.feeds);
  const newsCount = perPanel(useStore((s) => s.settings.feedNewsCount));
  const jobsCount = perPanel(useStore((s) => s.settings.feedJobsCount));
  // Several topics can be on at once; none = All.
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [state, setState] = useState<{ data: FeedResult | null; loading: boolean }>(() => ({
    data: cachedFeeds(feeds.sources),
    loading: false,
  }));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const now = useNow(60_000).getTime();

  const refresh = useCallback(
    (force: boolean) => {
      setState((s) => ({ ...s, loading: true }));
      loadFeeds(feeds.sources, { force, onProgress: (done, total) => setProgress({ done, total }) })
        .then((data) => setState({ data, loading: false }))
        .catch(() => setState((s) => ({ ...s, loading: false })))
        .finally(() => setProgress(null));
    },
    [feeds.sources],
  );

  useEffect(() => {
    refresh(false);
    const t = setInterval(() => refresh(false), FEED_TTL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Items-per-section changed in Settings → Scraping: fetch afresh once
  // Settings closes, so the panels fill up to the new amounts.
  const shownCounts = useRef(`${newsCount}/${jobsCount}`);
  useEffect(() => {
    const onClosed = () => {
      const now = `${newsCount}/${jobsCount}`;
      if (now === shownCounts.current) return;
      shownCounts.current = now;
      refresh(true);
    };
    window.addEventListener('devdeck:settings-closed', onClosed);
    return () => window.removeEventListener('devdeck:settings-closed', onClosed);
  }, [newsCount, jobsCount, refresh]);

  // A deleted topic simply drops out of the selection.
  const selected: Topic[] = useMemo(() => feeds.topics.filter((t) => topicIds.includes(t.id)), [feeds.topics, topicIds]);
  const items = state.data?.items ?? [];
  const news = useMemo(() => selectPanel(items, 'news', selected, newsCount), [items, selected, newsCount]);
  const jobs = useMemo(() => selectPanel(items, 'jobs', selected, jobsCount), [items, selected, jobsCount]);
  const errors = state.data?.errors ?? [];
  const busy = state.loading && !!progress && progress.total > 0;
  const bar = busy ? <LoadingBar active value={progress.done / progress.total} label={`Fetching sources: ${progress.done} of ${progress.total}`} /> : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SplitPanes setting="feedSplit" label="Resize Tech news and Dev jobs" fitHint="fit Tech news to its stories">
      <FeedPanel
        title="TECH NEWS"
        start={1}
        items={news}
        now={now}
        loading={state.loading && !state.data}
        topics={selected}
        skeletons={newsCount}
        bar={bar}
        status={busy ? `${progress.done}/${progress.total}` : null}
        footer={
          <button
            type="button"
            onClick={() => refresh(true)}
            aria-label="Refresh feeds"
            title={state.data ? `Updated ${new Date(state.data.fetchedAt).toLocaleTimeString()}${errors.length ? `\n${errors.join('\n')}` : ''}` : 'Refresh'}
            className={`text-xs ${errors.length ? 'text-amber-300/80' : 'text-white/35'} hover:text-white ${state.loading ? 'animate-spin' : ''}`}
          >
            ↻
          </button>
        }
      />
      <FeedPanel title="DEV JOBS" start={newsCount + 1} items={jobs} now={now} loading={state.loading && !state.data} topics={selected} skeletons={jobsCount} bar={bar} />
      </SplitPanes>
      <TopicChips
        topics={feeds.topics}
        active={selected.map((t) => t.id)}
        onToggle={(id) => setTopicIds((ids) => (id === null ? [] : ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
        onManage={onManage}
      />
    </div>
  );
});

function FeedPanel({
  title,
  start,
  items,
  now,
  loading,
  topics,
  skeletons,
  bar,
  status,
  footer,
}: {
  title: string;
  start: number;
  items: FeedItem[];
  now: number;
  loading: boolean;
  topics: Topic[];
  skeletons: number;
  bar?: ReactNode;
  status?: string | null;
  footer?: ReactNode;
}) {
  const tag = topics.length === 1 ? `#${topics[0].label}` : topics.length > 1 ? `${topics.length} topics` : null;
  return (
    <section aria-label={title === 'TECH NEWS' ? 'Tech news' : 'Developer jobs'} className="glass relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Accent slider bar; while sources load it becomes a progress bar */}
      {bar ? <span className="absolute inset-x-0 top-0">{bar}</span> : <span aria-hidden className="accent-gradient absolute inset-x-0 top-0 h-[2px] opacity-80" />}
      <header className="flex items-center gap-2 px-3 pt-3 pb-1.5">
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white/55">I</span>
        <h2 className="font-display text-[11px] font-semibold tracking-[0.18em] text-white/65">{title}</h2>
        {tag && <span className="truncate font-mono text-[10px] text-[var(--color-accent)]" title={topics.map((t) => '#' + t.label).join(' ')}>{tag}</span>}
        {status && <span className="font-mono text-[9.5px] text-white/40">fetching {status}</span>}
        <span className="ml-auto">{footer}</span>
      </header>
      <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-2">
        {loading &&
          Array.from({ length: Math.min(6, Math.max(1, skeletons)) }, (_, i) => (
            <li key={i} aria-hidden className="flex gap-2 px-1.5 py-2">
              <span className="skeleton mt-0.5 h-3 w-4 rounded" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="skeleton h-3 rounded" style={{ width: `${88 - ((i * 17) % 30)}%` }} />
                <span className="skeleton h-2 w-1/3 rounded" />
              </span>
            </li>
          ))}
        {!loading && skeletons === 0 && <li className="px-2 py-3 text-[11px] text-white/35">Hidden — set how many to show in Settings → Scraping.</li>}
        {!loading && skeletons > 0 && items.length === 0 && (
          <li className="px-2 py-3 text-[11px] text-white/35">{tag ? `Nothing on ${tag} right now.` : 'No items — check your sources.'}</li>
        )}
        {items.map((item, i) => (
          <li key={item.id} data-feed-item={item.category}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              title={item.title}
              className="group/feed flex gap-2 rounded-lg px-1.5 py-1.5 hover:bg-white/[0.06]"
            >
              <span className="w-4 shrink-0 pt-px text-right font-mono text-[11px] font-bold text-white/30 group-hover/feed:text-[var(--color-accent)]">
                {start + i}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[12.5px] leading-snug font-medium text-white/85 group-hover/feed:text-white">{item.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/35">
                  <span className="rounded bg-white/[0.07] px-1 font-semibold text-white/50">{item.source}</span>
                  {item.meta && <span className="truncate">{item.meta}</span>}
                  {item.publishedAt > 0 && <span className="ml-auto shrink-0 font-mono">{relativeAge(item.publishedAt, now)}</span>}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TopicChips({
  topics,
  active,
  onToggle,
  onManage,
}: {
  topics: Topic[];
  active: string[];
  onToggle: (id: string | null) => void;
  onManage: () => void;
}) {
  const chip = (selected: boolean) =>
    `rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
      selected
        ? 'border-[var(--color-accent)]/70 bg-[var(--color-accent)]/20 text-white'
        : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10 hover:text-white'
    }`;
  return (
    <section aria-label="Topics" className="glass shrink-0 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white/55">J</span>
        <h2 className="font-display text-[11px] font-semibold tracking-[0.18em] text-white/65">TOPICS</h2>
        <button
          type="button"
          onClick={onManage}
          aria-label="Manage topics and sources"
          title="Manage topics and sources"
          className="ml-auto flex size-8 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <SlidersIcon className="size-[21px]" />
        </button>
      </div>
      {/* Pick any number of topics; All clears the selection. */}
      <div role="group" aria-label="Filter feeds by topic" className="ultra-thin-scrollbar flex max-h-[64px] flex-wrap gap-1.5 overflow-y-auto pr-1">
        <button type="button" aria-pressed={active.length === 0} onClick={() => onToggle(null)} className={chip(active.length === 0)}>
          All
        </button>
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={active.includes(t.id)}
            onClick={() => onToggle(t.id)}
            title={t.query}
            className={chip(active.includes(t.id))}
          >
            #{t.label}
          </button>
        ))}
      </div>
    </section>
  );
}
