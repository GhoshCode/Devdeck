import { FIRST_SECTION } from '../../types';
import { memo, useMemo, useState, type FormEvent } from 'react';
import { defaultSchedule, useStore } from '../../store';
import type { ProcessingItem, Schedule, ScheduleFrequency } from '../../types';
import { deriveNameFromUrl, normalizeUrl, searchSites } from '../../utils';
import { looksLikeUrl } from '../../services/search';
import { DAY_LABELS, describeSchedule, nextFireTime, ordinal } from '../../lib/schedule';
import { Select } from '../ui/Select';
import { Favicon } from '../Favicon';
import { Countdown } from '../ui/Countdown';
import { TimerPanel, type TimerChoice } from '../ui/TimerPanel';
import { showUndo } from '../ui/UndoToast';

// Full editor for Currently Processing (plan Phase 4): add from the library or
// by URL, group into sections, and set each item's reminder schedule. Used by
// the panel's mini settings cog and by Settings → Processing.

export const DEFAULT_SECTIONS = [FIRST_SECTION, 'Queue'];

// Currently processing is green, every other list (Queue and your own) amber —
// the same colours the calendar uses.
const tone = (section: string) => (section === FIRST_SECTION ? 'is-processing' : 'is-queue');

type SortBy = 'added' | 'next';
const SORTS: ReadonlyArray<{ value: SortBy; label: string }> = [
  { value: 'added', label: 'Newest first' },
  { value: 'next', label: 'Next reminder' },
];

// The reminder the left side sets up for the next site you add, remembered
// between visits (this browser only).
const DRAFT_KEY = 'devdeck.sitesReminderDraft';
const initialDraft = (): Schedule => {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Schedule> | null;
    // the start month is always this month; a saved end month only if it is still ahead
    if (raw && typeof raw === 'object') return { ...defaultSchedule(), enabled: true, ...raw, from: defaultSchedule().from, to: raw.to && raw.to >= defaultSchedule().from ? raw.to : '' };
  } catch {
    // unreadable: start from the default
  }
  return { ...defaultSchedule(), enabled: true };
};

// The sites panel: add on the left (pick a list, find a site / paste a URL or
// make a brand-new one, set its reminder), your lists on the right (newest
// first or by next reminder, filter by list, open any site to edit it).
// Used by the Queue / Currently processing manage buttons and Settings → Processing.
export const ProcessingEditor = memo(function ProcessingEditor({ startSection }: { startSection?: string }) {
  const processing = useStore((s) => s.processing);
  const [extraSections, setExtraSections] = useState<string[]>([]);
  const sections = useMemo(
    () => [...new Set([...DEFAULT_SECTIONS, ...processing.map((i) => i.section), ...extraSections])],
    [processing, extraSections],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<string>(startSection ?? 'all');
  const [find, setFind] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('added');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of processing) m.set(i.section, (m.get(i.section) ?? 0) + 1);
    return m;
  }, [processing]);
  const shown = useMemo(() => {
    const f = find.trim().toLowerCase();
    const list = processing.filter((i) => (view === 'all' || i.section === view) && (!f || i.name.toLowerCase().includes(f) || i.url.toLowerCase().includes(f)));
    if (sortBy === 'next') {
      const now = new Date();
      const at = new Map(list.map((i) => [i.id, nextFireTime(i.schedule, now)?.getTime() ?? Infinity]));
      return list.sort((a, b) => at.get(a.id)! - at.get(b.id)! || a.name.localeCompare(b.name));
    }
    // newest first: added time, then list order for older items without one
    return list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || b.order - a.order);
  }, [processing, view, find, sortBy]);

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
          setSortBy('added'); // the new site shows at the top
          setFind('');
          setView((v) => (v === 'all' ? v : section));
        }}
      />

      <section aria-label="Your lists" className="flex min-h-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <div role="tablist" aria-label="Show list" className="flex flex-wrap gap-1.5">
            {['all', ...sections].map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={view === s}
                onClick={() => setView(s)}
                className={`sites-tab rounded-lg px-2.5 py-1 text-[11.5px] font-semibold ${s === 'all' ? '' : tone(s)} ${view === s ? 'is-on' : ''}`}
              >
                {s === 'all' ? 'All' : s}
                <span className="ml-1.5 font-mono text-[10px] opacity-60">{s === 'all' ? processing.length : (counts.get(s) ?? 0)}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-white/50">
            Sort
            <Select value={sortBy} onChange={setSortBy} ariaLabel="Sort sites" size="sm" className="w-[132px]" options={SORTS} />
          </div>
        </div>
        <input
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder={`Find in ${view === 'all' ? 'all lists' : view}…`}
          aria-label="Find in your lists"
          className="sites-field rounded-lg px-2.5 py-1.5 text-xs outline-none"
        />
        {shown.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-white/40">
            {processing.length === 0 ? "Nothing here yet — add a site you're working on or lining up next." : 'No sites match.'}
          </p>
        ) : (
          <ul aria-label="Sites" className="sites-list min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
  const [mode, setMode] = useState<'find' | 'new'>('new');
  const [timer, setTimer] = useState<TimerChoice>(null);
  const [query, setQuery] = useState('');
  const [newSite, setNewSite] = useState({ name: '', url: '' });
  const [section, setSection] = useState(startSection ?? sections[0]);
  const [draft, setDraft] = useState<Schedule>(initialDraft);
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState('');
  const patchDraft = (patch: Partial<Schedule>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ enabled: next.enabled, frequency: next.frequency, timeOfDay: next.timeOfDay, daysOfWeek: next.daysOfWeek, interval: next.interval, dayOfMonth: next.dayOfMonth, to: next.to }));
      } catch {
        // storage blocked: the draft still applies this time
      }
      return next;
    });

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
    const item = addProcessingItem({ ...input, section, schedule: draft });
    if (timer) useStore.getState().updateProcessingItem(item.id, { timer: { ...timer, start: item.createdAt ?? Date.now() } });
    setQuery('');
    setNewSite({ name: '', url: '' });
    onAdded(item.id, section);
  };

  const pasted = looksLikeUrl(q) ? normalizeUrl(q) : null;
  const newUrl = looksLikeUrl(newSite.url.trim()) ? normalizeUrl(newSite.url.trim()) : null;
  const canAdd = mode === 'find' ? !!q : !!newUrl && !isAdded(null, newUrl);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'new') {
      if (newUrl && !isAdded(null, newUrl)) add({ name: newSite.name.trim() || deriveNameFromUrl(newUrl) || newUrl, url: newUrl, siteId: null });
      return;
    }
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

  const field = 'sites-field rounded-lg px-2.5 py-2 text-xs outline-none';
  const NEW_LIST = '__new_list__';
  return (
    <form onSubmit={submit} aria-label="Add a site" className={`sites-add ${tone(section)} flex min-h-0 flex-col gap-3 overflow-y-auto rounded-xl p-3.5`}>
      <div role="tablist" aria-label="How to add" className="sites-seg grid grid-cols-2 gap-1 rounded-lg p-0.5">
        {(
          [
            ['new', 'New site'],
            ['find', 'From your sites'],
          ] as const
        ).map(([id, text]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`rounded-md py-1 text-[11.5px] font-semibold ${mode === id ? 'is-on' : ''}`}>
            {text}
          </button>
        ))}
      </div>

      {/* the same layout as a site's card on the right: name + list, address, reminder, timer */}
      <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] gap-2">
        {mode === 'new' ? (
          <input
            value={newSite.name}
            onChange={(e) => setNewSite((s) => ({ ...s, name: e.target.value }))}
            placeholder="Name (e.g. Team wiki)"
            aria-label="New site name"
            className={field}
          />
        ) : (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your sites or paste a URL…"
            aria-label="Add a site to Currently Processing"
            className={field}
          />
        )}
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
            className={field}
          />
        ) : (
          <Select
            value={section}
            onChange={(v) => (v === NEW_LIST ? setNaming(true) : setSection(v))}
            ariaLabel="Add to list"
            size="sm"
            options={[...sections.map((s) => ({ value: s, label: s })), { value: NEW_LIST, label: '+ New list…' }]}
          />
        )}
      </div>

      {mode === 'new' ? (
        <>
          <input
            value={newSite.url}
            onChange={(e) => setNewSite((s) => ({ ...s, url: e.target.value }))}
            placeholder="https://wiki.example.com"
            aria-label="New site address"
            className={`${field} font-mono`}
          />
          {newSite.url.trim() && !newUrl && <p className="-mt-1 text-[11px] text-amber-300/80">That doesn't look like a web address yet.</p>}
          {newUrl && isAdded(null, newUrl) && <p className="-mt-1 text-[11px] text-white/45">Already in {section}.</p>}
        </>
      ) : (
        q && (
          <ul aria-label="Matching sites" className="-mt-1 max-h-44 space-y-0.5 overflow-y-auto">
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
                {pasted ? (isAdded(null, pasted) ? `Already in ${section}` : `Press Enter to add ${pasted}`) : 'No matching sites — paste a full URL, or use New site'}
              </li>
            )}
          </ul>
        )
      )}

      <label className="flex items-center gap-2 text-[12px] text-white/80">
        <input type="checkbox" checked={draft.enabled} onChange={(e) => patchDraft({ enabled: e.target.checked })} className="accent-[var(--color-accent)]" />
        Remind me to work on this
      </label>
      <ScheduleFields schedule={draft} onChange={patchDraft} disabled={!draft.enabled} />
      <div className="flex items-center gap-1.5 text-white/55">
        <input type="month" value={draft.from} onChange={(e) => patchDraft({ from: e.target.value || defaultSchedule().from })} aria-label="From month" className={`${field} py-1 [color-scheme:dark]`} />
        <span>→</span>
        {draft.to ? (
          <>
            <input type="month" value={draft.to} onChange={(e) => patchDraft({ to: e.target.value })} aria-label="To month" className={`${field} py-1 [color-scheme:dark]`} />
            <button type="button" onClick={() => patchDraft({ to: '' })} className="text-[10px] text-white/45 hover:text-white">
              no end
            </button>
          </>
        ) : (
          <>
            <span className="text-[11px] text-white/60">no end</span>
            <button type="button" onClick={() => patchDraft({ to: draft.from })} className="text-[10px] text-white/45 hover:text-white">
              + End month
            </button>
          </>
        )}
      </div>

      <fieldset className="min-w-0 space-y-2 border-t border-white/[0.06] pt-2">
        <legend className="text-[11px] font-semibold text-white/75">Countdown timer</legend>
        <TimerPanel value={timer} start={Date.now()} onChange={setTimer} />
      </fieldset>

      <button type="submit" disabled={!canAdd} className="sites-add-btn mt-auto shrink-0 rounded-lg py-2 text-xs font-semibold disabled:opacity-40">
        Add to {section}
      </button>
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

// Frequency, time and days of a reminder: the site editor and the add side share it.
function ScheduleFields({ schedule: s, onChange: setSchedule, disabled = false }: { schedule: Schedule; onChange: (patch: Partial<Schedule>) => void; disabled?: boolean }) {
  const toggleDay = (d: number) =>
    setSchedule({ daysOfWeek: s.daysOfWeek.includes(d) ? s.daysOfWeek.filter((x) => x !== d) : [...s.daysOfWeek, d] });
  const field = 'rounded-lg bg-white/5 px-2 py-1 text-xs text-white/85 outline-none focus:bg-white/10 [color-scheme:dark]';
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2.5 disabled:opacity-40">
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

    </fieldset>
  );
}

function ItemEditor({ item, sections, open, onToggle }: { item: ProcessingItem; sections: string[]; open: boolean; onToggle: () => void }) {
  const update = useStore((s) => s.updateProcessingItem);
  const remove = useStore((s) => s.deleteProcessingItem);
  const reinsert = useStore((s) => s.reinsertProcessingItem);
  const s = item.schedule;
  const setSchedule = (patch: Partial<Schedule>) => update(item.id, { schedule: { ...s, ...patch } });
  const next = nextFireTime(s, new Date());

  const field = 'rounded-lg bg-white/5 px-2 py-1 text-xs text-white/85 outline-none focus:bg-white/10 [color-scheme:dark]';

  return (
    <li data-processing-id={item.id} data-section-tone={item.section === FIRST_SECTION ? "processing" : "queue"} className={`sites-row ${tone(item.section)} glass-inner overflow-hidden rounded-xl`}>
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
            <ScheduleFields schedule={s} onChange={setSchedule} />

            <div className="flex items-center gap-1.5 text-white/55">
              <input
                type="month"
                value={s.from}
                onChange={(e) => setSchedule({ from: e.target.value })}
                aria-label="From month"
                className={field}
              />
              <span>→</span>
              {s.to ? (
                <>
                  <input type="month" value={s.to} onChange={(e) => setSchedule({ to: e.target.value })} aria-label="To month" className={field} />
                  <button type="button" onClick={() => setSchedule({ to: '' })} className="text-[10px] text-white/45 hover:text-white" title="Keep reminding with no end month">
                    no end
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[11px] text-white/60">no end</span>
                  <button type="button" onClick={() => setSchedule({ to: s.from || new Date().toISOString().slice(0, 7) })} className="text-[10px] text-white/45 hover:text-white">
                    + End month
                  </button>
                </>
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
