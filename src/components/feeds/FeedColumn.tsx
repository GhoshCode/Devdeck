import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SplitPanes } from '../layout/SplitPanes';
import { useStore } from '../../store';
import type { Topic } from '../../types';
import { useNow } from '../../hooks/useNow';
import { FEED_TTL_MS, cachedFeeds, loadFeeds, selectPanel, type FeedItem, type FeedResult } from '../../services/feeds';
import { relativeAge } from '../../services/search';
import { SlidersIcon } from '../ui/icons';

// Right column (plan Phase 5): I — tech news (items 1–4) and developer jobs
// (items 5–8) — over J, the topic chips that filter both panels.

const PER_PANEL = 4;

export const FeedColumn = memo(function FeedColumn({ onManage }: { onManage: () => void }) {
  const feeds = useStore((s) => s.feeds);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [state, setState] = useState<{ data: FeedResult | null; loading: boolean }>(() => ({
    data: cachedFeeds(feeds.sources),
    loading: false,
  }));
  const now = useNow(60_000).getTime();

  const refresh = useCallback(
    (force: boolean) => {
      setState((s) => ({ ...s, loading: true }));
      loadFeeds(feeds.sources, { force })
        .then((data) => setState({ data, loading: false }))
        .catch(() => setState((s) => ({ ...s, loading: false })));
    },
    [feeds.sources],
  );

  useEffect(() => {
    refresh(false);
    const t = setInterval(() => refresh(false), FEED_TTL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // A deleted topic must not leave the panels filtered by nothing.
  const topic: Topic | null = feeds.topics.find((t) => t.id === topicId) ?? null;
  const items = state.data?.items ?? [];
  const news = useMemo(() => selectPanel(items, 'news', topic, PER_PANEL), [items, topic]);
  const jobs = useMemo(() => selectPanel(items, 'jobs', topic, PER_PANEL), [items, topic]);
  const errors = state.data?.errors ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SplitPanes setting="feedSplit" label="Resize Tech news and Dev jobs" fitHint="fit Tech news to its stories">
      <FeedPanel
        title="TECH NEWS"
        start={1}
        items={news}
        now={now}
        loading={state.loading && !state.data}
        topic={topic}
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
      <FeedPanel title="DEV JOBS" start={PER_PANEL + 1} items={jobs} now={now} loading={state.loading && !state.data} topic={topic} />
      </SplitPanes>
      <TopicChips topics={feeds.topics} active={topic?.id ?? null} onSelect={setTopicId} onManage={onManage} />
    </div>
  );
});

function FeedPanel({
  title,
  start,
  items,
  now,
  loading,
  topic,
  footer,
}: {
  title: string;
  start: number;
  items: FeedItem[];
  now: number;
  loading: boolean;
  topic: Topic | null;
  footer?: ReactNode;
}) {
  return (
    <section aria-label={title === 'TECH NEWS' ? 'Tech news' : 'Developer jobs'} className="glass relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Accent slider bar */}
      <span aria-hidden className="accent-gradient absolute inset-x-0 top-0 h-[2px] opacity-80" />
      <header className="flex items-center gap-2 px-3 pt-3 pb-1.5">
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white/55">I</span>
        <h2 className="font-display text-[11px] font-semibold tracking-[0.18em] text-white/65">{title}</h2>
        {topic && <span className="font-mono text-[10px] text-[var(--color-accent)]">#{topic.label}</span>}
        <span className="ml-auto">{footer}</span>
      </header>
      <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-2">
        {loading &&
          Array.from({ length: PER_PANEL }, (_, i) => (
            <li key={i} className="mx-1.5 my-2 h-7 animate-pulse rounded-md bg-white/[0.05]" />
          ))}
        {!loading && items.length === 0 && (
          <li className="px-2 py-3 text-[11px] text-white/35">{topic ? `Nothing on #${topic.label} right now.` : 'No items — check your sources.'}</li>
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
  onSelect,
  onManage,
}: {
  topics: Topic[];
  active: string | null;
  onSelect: (id: string | null) => void;
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
      <div role="radiogroup" aria-label="Filter feeds by topic" className="ultra-thin-scrollbar flex max-h-[64px] flex-wrap gap-1.5 overflow-y-auto pr-1">
        <button type="button" role="radio" aria-checked={active === null} onClick={() => onSelect(null)} className={chip(active === null)}>
          All
        </button>
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active === t.id}
            onClick={() => onSelect(active === t.id ? null : t.id)}
            title={t.query}
            className={chip(active === t.id)}
          >
            #{t.label}
          </button>
        ))}
      </div>
    </section>
  );
}
