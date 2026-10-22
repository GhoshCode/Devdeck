import { FIRST_SECTION } from '../../types';
import { memo, useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../../store';
import type { ProcessingItem, Schedule, ScheduleFrequency } from '../../types';
import { deriveNameFromUrl, normalizeUrl, searchSites } from '../../utils';
import { looksLikeUrl } from '../../services/search';
import { DAY_LABELS, describeSchedule, nextFireTime, ordinal } from '../../lib/schedule';
import { Select } from '../ui/Select';
import { Favicon } from '../Favicon';
import { Countdown } from '../ui/Countdown';
import { TimerPanel } from '../ui/TimerPanel';
import { showUndo } from '../ui/UndoToast';

// Full editor for Currently Processing (plan Phase 4): add from the library or
// by URL, group into sections, and set each item's reminder schedule. Used by
// the panel's mini settings cog and by Settings → Processing.

export const DEFAULT_SECTIONS = [FIRST_SECTION, 'Queue'];

// Starting reminders offered when a site is added (edit any of them afterwards).
const START_REMINDERS: ReadonlyArray<{ id: string; label: string; schedule: Partial<Schedule> }> = [
  { id: 'weekdays', label: 'Weekdays 9:00', schedule: { enabled: true, frequency: 'daily', timeOfDay: '09:00', daysOfWeek: [1, 2, 3, 4, 5] } },
  { id: 'daily', label: 'Every day 9:00', schedule: { enabled: true, frequency: 'daily', timeOfDay: '09:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] } },
  { id: 'weekly', label: 'Mondays 9:00', schedule: { enabled: true, frequency: 'weekly', timeOfDay: '09:00', daysOfWeek: [1] } },
  { id: 'off', label: 'No reminder', schedule: { enabled: false } },
];

// The sites panel: add on the left (pick a list, find a site or paste a URL,
// pick a starting reminder), your lists on the right (filter by list, search,
// open any site to edit its reminder or move it to another list). Used by the
// Queue / Currently processing manage buttons and by Settings → Processing.
export const ProcessingEditor = memo(function ProcessingEditor({ startSection }: { startSection?: string }) {
  const processing = useStore((s) => s.processing);
  const items = useMemo(() => [...processing].sort((a, b) => a.order - b.order), [processing]);
  const [extraSections, setExtraSections] = useState<string[]>([]);
  const sections = useMemo(
    () => [...new Set([...DEFAULT_SECTIONS, ...items.map((i) => i.section), ...extraSections])],
    [items, extraSections],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<string>(startSection ?? 'all');
  const [find, setFind] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.section, (m.get(i.section) ?? 0) + 1);
    return m;
  }, [items]);
  const f = find.trim().toLowerCase();
  const shown = items.filter((i) => (view === 'all' || i.section === view) && (!f || i.name.toLowerCase().includes(f) || i.url.toLowerCase().includes(f)));

  return (
    // two columns once there is room (the panel), one stacked column in narrower places (Settings)
    <div className="@container h-full min-h-0">
    <div data-testid="sites-panel" className="grid min-h-0 gap-4 @3xl:h-full @3xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <AddItem
        sections={sections}
        startSection={startSection}
        onNewSection={(name) => setExtraSections((s) => [...s, name])}
        onAdded={(id, section) => {
          setOpenId(id);
          setView((v) => (v === 'all' ? v : section));
        }}
      />

      <section aria-label="Your lists" className="flex min-h-0 flex-col gap-2.5">
        <div role="tablist" aria-label="Show list" className="flex flex-wrap gap-1.5">
          {['all', ...sections].map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={view === s}
              onClick={() => setView(s)}
              className={`sites-tab rounded-lg px-2.5 py-1 text-[11.5px] font-semibold ${view === s ? 'is-on' : ''}`}
            >
              {s === 'all' ? 'All' : s}
              <span className="ml-1.5 font-mono text-[10px] opacity-60">{s === 'all' ? items.length : (counts.get(s) ?? 0)}</span>
            </button>
          ))}
        </div>
        <input
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder={`Find in ${view === 'all' ? 'all lists' : view}…`}
          aria-label="Find in your lists"
          className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/35 focus:bg-white/10"
        />
        {shown.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-white/40">
            {items.length === 0 ? "Nothing here yet — add a site you're working on or lining up next." : 'No sites match.'}
          </p>
        ) : (
          <ul className="sites-list min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {shown.map((item) => (
              <ItemEditor
                key={item.id}
                item={item}
                sections={sections}
                open={openId === item.id}
                onToggle={() => setOpenId(openId === item.id ? null : item.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
    </div>
  );
});

function AddItem({
  sections,
  startSection,
  onNewSection,
  onAdded,
}: {
  sections: string[];
  startSection?: string;
  onNewSection: (name: string) => void;
  onAdded: (id: string, section: string) => void;
}) {
  const sites = useStore((s) => s.sites);
  const categories = useStore((s) => s.categories);
  const subcategories = useStore((s) => s.subcategories);
  const processing = useStore((s) => s.processing);
  const addProcessingItem = useStore((s) => s.addProcessingItem);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState(startSection ?? sections[0]);
  const [reminder, setReminder] = useState(START_REMINDERS[0].id);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');

  const q = query.trim();
  // Already in this list: by library site or by address, so nothing is added twice.
  const inList = useMemo(() => {
    const ids = new Set<string>();
    const urls = new Set<string>();
    for (const p of processing) {
      if (p.section !== section) continue;
      if (p.siteId) ids.add(p.siteId);
      urls.add(normalizeUrl(p.url));
    }
    return { ids, urls };
  }, [processing, section]);
  const matches = q ? searchSites(q, sites, categories, subcategories).slice(0, 8) : [];
  const isAdded = (siteId: string | null, url: string) => (siteId !== null && inList.ids.has(siteId)) || inList.urls.has(normalizeUrl(url));

  const add = (input: { name: string; url: string; siteId: string | null }) => {
    if (isAdded(input.siteId, input.url)) return;
    const start = START_REMINDERS.find((r) => r.id === reminder)!.schedule;
    const item = addProcessingItem({ ...input, section, schedule: { enabled: true } });
    useStore.getState().updateProcessingItem(item.id, { schedule: { ...item.schedule, ...start } });
    setQuery('');
    onAdded(item.id, section);
  };

  const pasted = looksLikeUrl(q) ? normalizeUrl(q) : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const first = matches.find((m) => !isAdded(m.site.id, m.site.url));
    if (first) add({ name: first.site.name, url: first.site.url, siteId: first.site.id });
    else if (pasted && !isAdded(null, pasted)) add({ name: deriveNameFromUrl(pasted) || pasted, url: pasted, siteId: null });
  };

  const createSection = () => {
    const name = newName.trim();
    setNaming(false);
    setNewName('');
    if (!name) return;
    if (!sections.includes(name)) onNewSection(name);
    setSection(name);
  };

  return (
    <form onSubmit={submit} aria-label="Add a site" className="sites-add glass-inner flex min-h-0 flex-col gap-3 rounded-xl p-3.5">
      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-[0.14em] text-white/50 uppercase">Add to</p>
        <div role="radiogroup" aria-label="Section" className="flex flex-wrap gap-1.5">
          {sections.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={section === s}
              onClick={() => setSection(s)}
              className={`sites-tab rounded-lg px-2.5 py-1 text-[11.5px] font-semibold ${section === s ? 'is-on' : ''}`}
            >
              {s}
            </button>
          ))}
          {naming ? (
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={createSection}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  createSection();
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  setNaming(false);
                }
              }}
              placeholder="List name"
              aria-label="New section name"
              className="w-28 rounded-lg bg-white/10 px-2 py-1 text-[11.5px] text-white outline-none"
            />
          ) : (
            <button type="button" onClick={() => setNaming(true)} className="sites-tab rounded-lg px-2.5 py-1 text-[11.5px] font-semibold opacity-70" title="Make another list">
              + New list
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your sites or paste a URL…"
          aria-label="Add a site to Currently Processing"
          className="min-w-0 flex-1 rounded-lg bg-white/5 px-2.5 py-2 text-xs text-white outline-none placeholder:text-white/35 focus:bg-white/10"
        />
        <button type="submit" disabled={!q} className="rounded-lg bg-[var(--color-accent)]/80 px-3 text-xs font-semibold text-white hover:bg-[var(--color-accent)] disabled:opacity-40">
          Add
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold tracking-[0.14em] text-white/50 uppercase">Remind me</p>
        <div role="radiogroup" aria-label="Starting reminder" className="flex flex-wrap gap-1.5">
          {START_REMINDERS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={reminder === r.id}
              onClick={() => setReminder(r.id)}
              className={`sites-tab rounded-lg px-2.5 py-1 text-[11px] ${reminder === r.id ? 'is-on' : ''}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {q && (
        <ul aria-label="Matching sites" className="min-h-0 space-y-0.5 overflow-y-auto">
          {matches.map(({ site, category }) => {
            const added = isAdded(site.id, site.url);
            return (
              <li key={site.id}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => add({ name: site.name, url: site.url, siteId: site.id })}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-white/85 hover:bg-white/10 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Favicon url={site.url} name={site.name} className="size-4" />
                  <span className="truncate">{site.name}</span>
                  <span className="ml-auto truncate text-[10px] text-white/35">{added ? `Added to ${section}` : category.name}</span>
                </button>
              </li>
            );
          })}
          {matches.length === 0 && (
            <li className="px-2 py-1 text-[11px] text-white/45">
              {pasted ? (isAdded(null, pasted) ? `Already in ${section}` : `Press Enter to add ${pasted}`) : 'No matching sites — paste a full URL instead'}
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
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];
const WEEK_INTERVALS = [1, 2, 3, 4].map((n) => ({ value: String(n), label: n === 1 ? 'Every week' : `Every ${n} weeks` }));
const MONTH_INTERVALS = [1, 2, 3, 6].map((n) => ({ value: String(n), label: n === 1 ? 'Every month' : `Every ${n} months` }));
const MONTH_DAYS = [
  ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `${ordinal(i + 1)} day` })),
  { value: '-1', label: 'Last day' },
];

function ItemEditor({ item, sections, open, onToggle }: { item: ProcessingItem; sections: string[]; open: boolean; onToggle: () => void }) {
  const update = useStore((s) => s.updateProcessingItem);
  const remove = useStore((s) => s.deleteProcessingItem);
  const reinsert = useStore((s) => s.reinsertProcessingItem);
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
          onClick={() => {
            remove(item.id);
            showUndo(`Removed ${item.name} from ${item.section}`, () => reinsert(item));
          }}
          aria-label={`Remove ${item.name}`}
          className="text-xs text-white/30 hover:text-red-300"
        >
          ✕
        </button>
      </div>

      {open && (
        <div className="space-y-2.5 border-t border-white/[0.06] px-3 pt-2.5 pb-3 text-xs">
          <div className="grid grid-cols-[1fr_9rem] gap-2">
            <input value={item.name} onChange={(e) => update(item.id, { name: e.target.value })} aria-label="Name" className={field} />
            <Select
              value={item.section}
              onChange={(v) => update(item.id, { section: v })}
              ariaLabel="Move to list"
              size="sm"
              options={sections.map((s) => ({ value: s, label: s }))}
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

          <fieldset disabled={!s.enabled} className="min-w-0 space-y-2.5 disabled:opacity-40">
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label="Frequency" className="inline-flex rounded-lg bg-black/30 p-0.5">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={s.frequency === f.id}
                    onClick={() => setSchedule(f.id === s.frequency ? {} : { frequency: f.id, interval: 1 })}
                    className={`rounded-md px-2 py-0.5 text-[11px] ${
                      s.frequency === f.id ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {(s.frequency === 'daily' || s.frequency === 'weekly' || s.frequency === 'monthly') && (
                <input
                  type="time"
                  value={s.timeOfDay ?? '09:00'}
                  onChange={(e) => setSchedule({ timeOfDay: e.target.value || '09:00' })}
                  aria-label="Time of day"
                  className={field}
                />
              )}
            </div>

            {s.frequency === 'weekly' && (
              <div className="flex items-center gap-2 text-white/60">
                <span className="text-[11px]">Repeat</span>
                <Select
                  value={String(s.interval ?? 1)}
                  onChange={(v) => setSchedule({ interval: Number(v) })}
                  ariaLabel="Repeat every"
                  size="sm"
                  className="w-[130px]"
                  options={WEEK_INTERVALS}
                />
                <span className="text-[11px]">on</span>
              </div>
            )}
            {s.frequency === 'monthly' && (
              <div className="flex flex-wrap items-center gap-2 text-white/60">
                <span className="text-[11px]">On</span>
                <Select
                  value={String(s.dayOfMonth ?? 1)}
                  onChange={(v) => setSchedule({ dayOfMonth: Number(v) })}
                  ariaLabel="Day of the month"
                  size="sm"
                  className="w-[118px]"
                  options={MONTH_DAYS}
                />
                <Select
                  value={String(s.interval ?? 1)}
                  onChange={(v) => setSchedule({ interval: Number(v) })}
                  ariaLabel="Repeat every"
                  size="sm"
                  className="w-[132px]"
                  options={MONTH_INTERVALS}
                />
              </div>
            )}
            {s.frequency !== 'monthly' && (
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
            )}

            <div className="flex items-center gap-1.5 text-white/55">
              <input
                type="month"
                value={s.from}
                onChange={(e) => setSchedule({ from: e.target.value })}
                aria-label="From month"
                className={field}
              />
              <span>→</span>
              <input
                type="month"
                value={s.to}
                onChange={(e) => setSchedule({ to: e.target.value })}
                aria-label="To month"
                className={field}
              />
              {s.to ? (
                <button type="button" onClick={() => setSchedule({ to: '' })} className="text-[10px] text-white/45 hover:text-white" title="Keep reminding with no end month">
                  no end
                </button>
              ) : (
                <span className="text-[10px] text-white/40">no end</span>
              )}
            </div>
          </fieldset>

          <p className="font-mono text-[10px] text-white/40">
            {next
              ? `Next reminder: ${next.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : 'No upcoming reminder'}
          </p>

          <fieldset className="min-w-0 space-y-2 border-t border-white/[0.06] pt-2">
            <legend className="flex items-center gap-2 text-[11px] font-semibold text-white/75">
              Countdown timer
              {item.timer && <Countdown timer={item.timer} />}
            </legend>
            <TimerPanel
              value={item.timer ? { amount: item.timer.amount, unit: item.timer.unit } : null}
              start={item.createdAt ?? item.timer?.start ?? Date.now()}
              onChange={(t) => {
                const start = item.createdAt ?? item.timer?.start ?? Date.now();
                update(item.id, { timer: t ? { ...t, start } : null, createdAt: item.createdAt ?? start });
              }}
            />
          </fieldset>
        </div>
      )}
    </li>
  );
}
