import { useState, type CSSProperties, type FormEvent } from 'react';
import { useStore } from '../../store';
import type { FeedCategory, FeedKind } from '../../types';
import { normalizeUrl } from '../../utils';
import { requestHostAccess } from '../../lib/env';
import { clearCache } from '../../lib/cache';
import { Select } from '../ui/Select';

const FEED_PANELS = [{ value: 'news', label: 'News' }, { value: 'jobs', label: 'Jobs' }] as const;

// Settings → Scraping (plan Phase 6, §7 Q13): topic chips (J) and the sources
// feeding the news and jobs panels (I).

const KIND_LABEL: Record<FeedKind, string> = {
  hn: 'Hacker News front page',
  hnjobs: 'HN hiring posts',
  devto: 'Dev.to articles',
  remotive: 'Remotive jobs',
  remoteok: 'RemoteOK jobs',
  rss: 'RSS / Atom feed',
};

const field =
  'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none';

export function ScrapingTab() {
  return (
    <div className="space-y-5 text-sm text-white/90">
      <SectionCounts />
      <Topics />
      <Sources />
    </div>
  );
}

// How many items each feed section shows: 0–100.
// The panels reload with the new amounts when Settings closes.
function SectionCounts() {
  const news = useStore((s) => s.settings.feedNewsCount ?? 20);
  const jobs = useStore((s) => s.settings.feedJobsCount ?? 20);
  const updateSettings = useStore((s) => s.updateSettings);
  return (
    <section aria-label="Items per section" className="glass-inner space-y-4 rounded-xl p-4">
      <div>
        <h4 className="set-card-title text-[13.5px] font-semibold">Items per section</h4>
        <p className="set-card-hint mt-0.5 text-[12px]">How many stories and jobs each column shows (0 hides it).</p>
      </div>
      <CountSlider id="count-news" label="Tech news" value={news} onChange={(v) => updateSettings({ feedNewsCount: v })} />
      <CountSlider id="count-jobs" label="Dev jobs" value={jobs} onChange={(v) => updateSettings({ feedJobsCount: v })} />
    </section>
  );
}

function CountSlider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  // One quiet row: label, a half-width slider, the number.
  return (
    <div className="flex items-center gap-4">
      <label htmlFor={id} className="w-24 shrink-0 text-xs font-medium text-white/80">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="count-slider w-1/2 min-w-[140px]"
        style={{ '--fill': `${value}%` } as CSSProperties}
      />
      <span className="count-value w-12 shrink-0 text-right font-mono text-[13px] font-semibold text-white tabular-nums">{value}</span>
    </div>
  );
}

function Topics() {
  const topics = useStore((s) => s.feeds.topics);
  const addTopic = useStore((s) => s.addTopic);
  const updateTopic = useStore((s) => s.updateTopic);
  const deleteTopic = useStore((s) => s.deleteTopic);
  const [label, setLabel] = useState('');
  const [query, setQuery] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = label.trim().replace(/^#/, '');
    if (!clean) return;
    addTopic({ label: clean, query: query.trim() || clean.toLowerCase() });
    setLabel('');
    setQuery('');
  };

  return (
    <section aria-label="Topics" className="glass-inner space-y-3 rounded-xl p-4">
      <h4 className="set-card-title text-[13.5px] font-semibold">Topics</h4>
      <ul className="space-y-2">
        {topics.map((t) => (
          <li key={t.id} className="grid grid-cols-[8rem_1fr_auto] items-center gap-2">
            <input
              value={`#${t.label}`}
              onChange={(e) => updateTopic(t.id, { label: e.target.value })}
              aria-label="Topic label"
              className={field}
            />
            <input
              value={t.query}
              onChange={(e) => updateTopic(t.id, { query: e.target.value })}
              aria-label={`Keywords for ${t.label}`}
              className={`${field} font-mono`}
            />
            <button
              type="button"
              onClick={() => deleteTopic(t.id)}
              aria-label={`Delete topic ${t.label}`}
              className="px-2 text-xs text-white/40 hover:text-red-300"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="grid grid-cols-[8rem_1fr_auto] gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="#Security" aria-label="New topic label" className={field} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="keywords, comma, separated"
          aria-label="New topic keywords"
          className={`${field} font-mono`}
        />
        <button type="submit" className="rounded-xl bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15">
          Add
        </button>
      </form>
      <p className="text-[11px] text-white/40">A topic matches items whose title or tags contain any keyword as a whole word.</p>
    </section>
  );
}

function Sources() {
  const sources = useStore((s) => s.feeds.sources);
  const addFeedSource = useStore((s) => s.addFeedSource);
  const updateFeedSource = useStore((s) => s.updateFeedSource);
  const deleteFeedSource = useStore((s) => s.deleteFeedSource);
  const resetFeeds = useStore((s) => s.resetFeeds);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<FeedCategory>('news');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!url.trim()) return;
    const feedUrl = normalizeUrl(url);
    if (!(await requestHostAccess(feedUrl))) {
      setError('DevDeck needs permission to read that site to fetch its feed.');
      return;
    }
    addFeedSource({ name: name.trim() || new URL(feedUrl).hostname, kind: 'rss', url: feedUrl, category });
    clearCache('feeds');
    setName('');
    setUrl('');
  };

  return (
    <section aria-label="Sources" className="glass-inner space-y-3 rounded-xl p-4">
      <div className="flex items-center">
        <h4 className="set-card-title text-[13.5px] font-semibold">Sources</h4>
        <button type="button" onClick={resetFeeds} className="ml-auto text-[11px] text-white/40 hover:text-white">
          Restore defaults
        </button>
      </div>
      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => updateFeedSource(s.id, { enabled: e.target.checked })}
              aria-label={`Use ${s.name}`}
              className="accent-[var(--color-accent)]"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white/90">{s.name}</span>
              <span className="block truncate font-mono text-[10px] text-white/35">
                {KIND_LABEL[s.kind]} · {s.url}
              </span>
            </span>
            <Select
              value={s.category}
              onChange={(v) => updateFeedSource(s.id, { category: v as FeedCategory })}
              ariaLabel={`Panel for ${s.name}`}
              size="sm"
              className="w-[84px]"
              options={FEED_PANELS}
            />
            <button
              type="button"
              onClick={() => deleteFeedSource(s.id)}
              aria-label={`Delete source ${s.name}`}
              className="text-xs text-white/40 hover:text-red-300"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="space-y-2">
        <div className="grid grid-cols-[8rem_1fr_6rem_auto] gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Feed name" className={field} />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            aria-label="Feed URL"
            className={`${field} font-mono`}
          />
          <Select
            value={category}
            onChange={(v) => setCategory(v as FeedCategory)}
            ariaLabel="Feed panel"
            className="w-[96px]"
            options={FEED_PANELS}
          />
          <button type="submit" className="rounded-xl bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15">
            Add RSS
          </button>
        </div>
        {error && (
          <p role="alert" className="text-[11px] text-red-300">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
