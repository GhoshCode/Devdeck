import { memo, useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../../store';
import type { ProcessingItem, Schedule, ScheduleFrequency } from '../../types';
import { deriveNameFromUrl, normalizeUrl, searchSites } from '../../utils';
import { looksLikeUrl } from '../../services/search';
import { DAY_LABELS, describeSchedule, nextFireTime } from '../../lib/schedule';
import { Favicon } from '../Favicon';
import { Countdown } from '../ui/Countdown';
import { TimerPanel } from '../ui/TimerPanel';

// Full editor for Currently Processing (plan Phase 4): add from the library or
// by URL, group into sections, and set each item's reminder schedule. Used by
// the panel's mini settings cog and by Settings → Processing.

export const DEFAULT_SECTIONS = ['Focus', 'Queue'];

export const ProcessingEditor = memo(function ProcessingEditor() {
  const processing = useStore((s) => s.processing);
  const items = useMemo(() => [...processing].sort((a, b) => a.order - b.order), [processing]);
  const sections = useMemo(
    () => [...new Set([...DEFAULT_SECTIONS, ...items.map((i) => i.section)])],
    [items],
  );
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <AddItem sections={sections} onAdded={setOpenId} />
      <datalist id="processing-sections">
        {sections.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {items.length === 0 ? (
        <p className="px-1 py-4 text-center text-xs text-white/40">
          Nothing in progress yet — add a site you're actively working on.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <ItemEditor
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() => setOpenId(openId === item.id ? null : item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
});

function AddItem({ sections, onAdded }: { sections: string[]; onAdded: (id: string) => void }) {
  const sites = useStore((s) => s.sites);
  const categories = useStore((s) => s.categories);
  const subcategories = useStore((s) => s.subcategories);
  const processing = useStore((s) => s.processing);
  const addProcessingItem = useStore((s) => s.addProcessingItem);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState(sections[0]);

  const q = query.trim();
  const already = new Set(processing.map((p) => p.siteId).filter(Boolean));
  const matches = q
    ? searchSites(q, sites, categories, subcategories)
        .filter((m) => !already.has(m.site.id))
        .slice(0, 5)
    : [];

  const add = (input: { name: string; url: string; siteId: string | null }) => {
    const item = addProcessingItem({ ...input, section: section.trim() || 'Focus', schedule: { enabled: true } });
    setQuery('');
    onAdded(item.id);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (matches[0]) {
      const { site } = matches[0];
      add({ name: site.name, url: site.url, siteId: site.id });
    } else if (looksLikeUrl(q)) {
      const url = normalizeUrl(q);
      add({ name: deriveNameFromUrl(url) || url, url, siteId: null });
    }
  };

  return (
    <form onSubmit={submit} className="glass-inner space-y-2 rounded-xl p-3">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your sites or paste a URL…"
          aria-label="Add a site to Currently Processing"
          className="min-w-0 flex-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:bg-white/10"
        />
        <input
          value={section}
          onChange={(e) => setSection(e.target.value)}
          list="processing-sections"
          aria-label="Section"
          className="w-24 rounded-lg bg-white/5 px-2 py-1.5 text-xs text-white/80 outline-none focus:bg-white/10"
        />
        {/* Also what makes Enter submit: a form with two text fields needs a submit button. */}
        <button
          type="submit"
          disabled={!q}
          className="rounded-lg bg-white/10 px-2.5 text-xs font-semibold text-white/80 hover:bg-white/15 disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {q && (
        <ul className="space-y-0.5">
          {matches.map(({ site, category }) => (
            <li key={site.id}>
              <button
                type="button"
                onClick={() => add({ name: site.name, url: site.url, siteId: site.id })}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-white/80 hover:bg-white/10"
              >
                <Favicon url={site.url} name={site.name} className="size-4" />
                <span className="truncate">{site.name}</span>
                <span className="ml-auto truncate text-[10px] text-white/35">{category.name}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-2 py-1 text-[11px] text-white/40">
              {looksLikeUrl(q) ? 'Press Enter to add this URL' : 'No matching sites — paste a full URL instead'}
            </li>
          )}
        </ul>
      )}
    </form>
  );
}

const FREQUENCIES: Array<{ id: ScheduleFrequency; label: string }> = [
  { id: 'minute', label: 'Minute' },
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
];

function ItemEditor({ item, open, onToggle }: { item: ProcessingItem; open: boolean; onToggle: () => void }) {
  const update = useStore((s) => s.updateProcessingItem);
  const remove = useStore((s) => s.deleteProcessingItem);
  const s = item.schedule;
  const setSchedule = (patch: Partial<Schedule>) => update(item.id, { schedule: { ...s, ...patch } });
  const next = nextFireTime(s, new Date());

  const toggleDay = (d: number) =>
    setSchedule({ daysOfWeek: s.daysOfWeek.includes(d) ? s.daysOfWeek.filter((x) => x !== d) : [...s.daysOfWeek, d] });

  const field = 'rounded-lg bg-white/5 px-2 py-1 text-xs text-white/85 outline-none focus:bg-white/10 [color-scheme:dark]';

  return (
    <li data-processing-id={item.id} className="glass-inner overflow-hidden rounded-xl">
      <div className="flex items-center gap-2 px-3 py-2">
        <Favicon url={item.url} name={item.name} className="size-4 shrink-0" />
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-xs font-semibold text-white/90">{item.name}</span>
          <span className="block truncate text-[10px] text-white/40">
            {item.section} · {describeSchedule(s)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => remove(item.id)}
          aria-label={`Remove ${item.name}`}
          className="text-xs text-white/30 hover:text-red-300"
        >
          ✕
        </button>
      </div>

      {open && (
        <div className="space-y-2.5 border-t border-white/[0.06] px-3 pt-2.5 pb-3 text-xs">
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <input
              value={item.name}
              onChange={(e) => update(item.id, { name: e.target.value })}
              aria-label="Name"
              className={field}
            />
            <input
              value={item.section}
              onChange={(e) => update(item.id, { section: e.target.value })}
              list="processing-sections"
              aria-label="Section"
              className={field}
            />
          </div>
          <input
            value={item.url}
            onChange={(e) => update(item.id, { url: e.target.value })}
            onBlur={(e) => update(item.id, { url: normalizeUrl(e.target.value) })}
            aria-label="URL"
            className={`${field} w-full font-mono`}
          />

          <label className="flex items-center gap-2 text-white/75">
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => setSchedule({ enabled: e.target.checked })}
              className="accent-[var(--color-accent)]"
            />
            Remind me to work on this
          </label>

          <fieldset disabled={!s.enabled} className="space-y-2.5 disabled:opacity-40">
            <div className="flex items-center gap-2">
              <div role="radiogroup" aria-label="Frequency" className="inline-flex rounded-lg bg-black/30 p-0.5">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={s.frequency === f.id}
                    onClick={() => setSchedule({ frequency: f.id })}
                    className={`rounded-md px-2 py-0.5 text-[11px] ${
                      s.frequency === f.id ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {s.frequency === 'daily' && (
                <input
                  type="time"
                  value={s.timeOfDay ?? '09:00'}
                  onChange={(e) => setSchedule({ timeOfDay: e.target.value || '09:00' })}
                  aria-label="Time of day"
                  className={field}
                />
              )}
            </div>

            <div role="group" aria-label="Days of the week" className="flex gap-1">
              {DAY_LABELS.map((label, d) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={s.daysOfWeek.includes(d)}
                  onClick={() => toggleDay(d)}
                  className={`flex-1 rounded-md py-1 text-[10px] font-semibold ${
                    s.daysOfWeek.includes(d)
                      ? 'bg-[var(--color-accent)]/25 text-white ring-1 ring-[var(--color-accent)]/50'
                      : 'bg-white/5 text-white/45 hover:bg-white/10'
                  }`}
                >
                  {label.slice(0, 2)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-white/55">
              <input type="month" value={s.from} onChange={(e) => setSchedule({ from: e.target.value })} aria-label="From month" className={field} />
              <span>→</span>
              <input type="month" value={s.to} onChange={(e) => setSchedule({ to: e.target.value })} aria-label="To month" className={field} />
            </div>
          </fieldset>

          <p className="font-mono text-[10px] text-white/40">
            {next ? `Next reminder: ${next.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'No upcoming reminder'}
          </p>

          <fieldset className="space-y-2 border-t border-white/[0.06] pt-2">
            <legend className="flex items-center gap-2 text-[11px] font-semibold text-white/75">
              Countdown timer
              {item.timer && <Countdown timer={item.timer} />}
            </legend>
            <TimerPanel
              value={item.timer ? { amount: item.timer.amount, unit: item.timer.unit } : null}
              start={item.timer?.start ?? Date.now()}
              onChange={(t) => {
                const start = item.timer?.start ?? Date.now();
                update(item.id, { timer: t ? { ...t, start } : null, createdAt: item.createdAt ?? start });
              }}
            />
          </fieldset>
        </div>
      )}
    </li>
  );
}
