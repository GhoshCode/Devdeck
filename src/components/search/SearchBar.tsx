import { openInNewTab, openInNewWindow } from '../../lib/openTab';
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../../store';
import { searchSites, getHostname } from '../../utils';
import { destinationFor, fetchSuggestions, looksLikeUrl, searchEngine, searchUrl } from '../../services/search';
import { AI_PROVIDERS, aiProvider, askAi, type AiProvider, type AiProviderId } from '../../services/ai';
import { COMMANDS, detectPlatform, parseCommand, runCommand, type CommandResult } from '../../services/commands';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { useTypeToCapture } from '../../hooks/useTypeToCapture';
import { Favicon } from '../Favicon';

// Always-visible search (Zone 3, §7 Q12) with a three-tier dropdown:
//   1. your sites (the library's fuzzy ranking)
//   2. Google autocomplete
//   3. the direct action — open the URL or search Google for the raw text
// ↑/↓ move, Enter picks (Ctrl/⌘+Enter → new tab), Esc closes. "/" and Ctrl+K
// focus it (wired in App).
//
// The mic fills the box by voice. The AI toggle switches Enter (and the
// SEARCH button) from Google to a new chat with the AI chosen in Settings →
// Profile (Gemini, ChatGPT, Claude, Perplexity or a custom URL), text sent;
// Google suggestions are hidden then, your sites still match.
//
// Type-to-capture: a printable key (or a paste) anywhere outside a field lands
// here. Long or multi-line text reveals a small expand button; the expanded
// composer grows to 280px (Shift+Enter new line, Enter submits) and collapses
// back without losing the text.

const SITE_LIMIT = 5;
const WEB_LIMIT = 5;
const SUGGEST_DEBOUNCE_MS = 150;
const LONG_TEXT = 65; // characters before the composer offers to expand
const SUGGEST_MAX = 120; // longer text reads as a prompt: no Google suggestions

type Item =
  | { kind: 'site'; key: string; siteId: string; name: string; url: string; meta: string }
  | { kind: 'web'; key: string; text: string; url: string }
  | { kind: 'go'; key: string; text: string; url: string; isUrl: boolean }
  | { kind: 'gemini'; key: string; text: string; url: string }
  | { kind: 'command'; key: string; text: string; url: string; result: CommandResult }
  | { kind: 'add'; key: string; text: string; url: string };

interface SearchBarProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  // Opens Settings → Library with the URL prefilled.
  onAddSite: (url: string) => void;
}

export const SearchBar = memo(function SearchBar({ inputRef, onAddSite }: SearchBarProps) {
  const sites = useStore((s) => s.sites);
  const categories = useStore((s) => s.categories);
  const subcategories = useStore((s) => s.subcategories);
  const recordVisit = useStore((s) => s.recordVisit);
  const geminiMode = useStore((s) => !!s.settings.geminiMode);
  const aiId = useStore((s) => s.settings.aiProvider);
  const aiCustomUrl = useStore((s) => s.settings.aiCustomUrl);
  const ai = useMemo(() => aiProvider(aiId, aiCustomUrl), [aiId, aiCustomUrl]);
  const engineId = useStore((s) => s.settings.searchEngine);
  const engine = searchEngine(engineId);
  // Scrolling on the AI icon cycles the AIs (custom only when it has a {q} URL).
  const aiWheel = useRef({ sum: 0, lock: 0 });
  const cycleAi = (dy: number) => {
    const now = Date.now();
    if (now < aiWheel.current.lock) return;
    aiWheel.current.sum += dy;
    if (Math.abs(aiWheel.current.sum) < 40) return;
    const ids: AiProviderId[] = [...AI_PROVIDERS.map((p) => p.id), ...(aiCustomUrl?.includes('{q}') ? (['custom'] as const) : [])];
    const at = Math.max(0, ids.indexOf(aiId ?? 'gemini'));
    const next = ids[(at + (aiWheel.current.sum > 0 ? 1 : -1) + ids.length) % ids.length];
    aiWheel.current = { sum: 0, lock: now + 220 };
    updateSettings({ aiProvider: next });
  };
  const updateSettings = useStore((s) => s.updateSettings);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [web, setWeb] = useState<{ q: string; items: string[] }>({ q: '', items: [] });
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const caretToEnd = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const q = query.trim();
  const multiline = !!query && (query.includes('\n') || query.length > LONG_TEXT || overflowing);
  const lines = query ? query.split('\n').length : 0;

  useTypeToCapture((text) => {
    caretToEnd.current = true;
    setQuery((cur) => cur + text);
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  });

  // Compact: one row that scrolls sideways. Expanded: grows with the text up
  // to the composer's max height, then scrolls inside.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (expanded) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    } else {
      el.style.height = '';
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
    }
    if (caretToEnd.current) {
      caretToEnd.current = false;
      const end = el.value.length;
      el.setSelectionRange(end, end);
      el.scrollTop = el.scrollHeight;
      el.scrollLeft = el.scrollWidth;
    }
  }, [query, expanded, inputRef]);

  useEffect(() => {
    if (!query) setExpanded(false);
  }, [query]);

  const toggleExpanded = () => {
    caretToEnd.current = true;
    setExpanded((v) => !v);
    setOpen(false);
    inputRef.current?.focus();
  };

  const speech = useSpeechInput((text, final) => {
    setQuery(text);
    setActive(-1);
    setOpen(true);
    if (final) inputRef.current?.focus();
  });
  const hint = speech.error ?? notice;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  // Tier 2, debounced; stale responses are dropped by comparing the query.
  useEffect(() => {
    if (!q || looksLikeUrl(q) || geminiMode || q.length > SUGGEST_MAX || q.includes('\n')) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetchSuggestions(q, WEB_LIMIT + 1, ctrl.signal)
        .then((items) => setWeb({ q, items }))
        .catch(() => setWeb({ q, items: [] }));
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, geminiMode]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Built-in commands (calc, open, gh, npm, g, b64e, b64d, help) run right
  // here: ">" forces command mode, otherwise the first word must be a command.
  const command = useMemo<Item | null>(() => {
    if (!q) return null;
    const { name } = parseCommand(q);
    const known = COMMANDS.some((c) => c.name === name) || name === '?' || name === '=' || name === 'google';
    if (!q.startsWith('>') && !(known && (q.includes(' ') || name === 'help'))) return null;
    const result = runCommand(q, { admin: false, platform: detectPlatform(), sites });
    return { kind: 'command', key: 'cmd', text: q.replace(/^>s*/, ''), url: result.kind === 'open' ? result.url : '', result };
  }, [q, sites]);

  const items = useMemo<Item[]>(() => {
    if (!q) return [];
    const siteItems: Item[] = searchSites(q, sites, categories, subcategories)
      .slice(0, SITE_LIMIT)
      .map(({ site, category }) => ({
        kind: 'site',
        key: `s-${site.id}`,
        siteId: site.id,
        name: site.name,
        url: site.url,
        meta: `${getHostname(site.url)} · ${category.name}`,
      }));
    const webItems: Item[] =
      web.q === q && !geminiMode
        ? web.items
            .filter((t) => t.toLowerCase() !== q.toLowerCase())
            .slice(0, WEB_LIMIT)
            .map((text) => ({ kind: 'web', key: `w-${text}`, text, url: searchUrl(text, engineId) }))
        : [];
    const isUrl = looksLikeUrl(q);
    const direct: Item = { kind: 'go', key: 'go', text: q, url: destinationFor(q, engineId), isUrl };
    // A URL that isn't in the library yet can be saved straight from here.
    const known = isUrl && sites.some((s) => getHostname(s.url) === getHostname(direct.url));
    const add: Item[] = isUrl && !known ? [{ kind: 'add', key: 'add', text: q, url: direct.url }] : [];
    if (command) return [command, ...siteItems];
    if (geminiMode) {
      // Asking the AI is what Enter does, so it leads; a typed URL can still be opened.
      const ask: Item = { kind: 'gemini', key: 'gemini', text: q, url: '' };
      return [ask, ...siteItems, ...(isUrl ? [direct, ...add] : [])];
    }
    return [...siteItems, ...webItems, direct, ...add];
  }, [q, sites, categories, subcategories, web, geminiMode, command, engineId]);

  const toGemini = (text: string, newTab: boolean) => {
    setOpen(false);
    setQuery('');
    void askAi(ai, text, { newTab }).then((how) => {
      if (how === 'clipboard') setNotice(`Prompt copied — paste it into ${ai.name} (Ctrl/⌘+V) and press Enter`);
      else if (how === 'manual') setNotice(`${ai.name} opened in a new tab — type your prompt there`);
    });
  };

  const runBuiltin = async (res: CommandResult, newTab: boolean) => {
    if (res.kind === 'open') {
      setOpen(false);
      setQuery('');
      void newTab; // always a new tab: the start page stays put
      openInNewTab(res.url);
      return;
    }
    if (res.kind === 'copy') {
      try {
        await navigator.clipboard.writeText(res.text);
      } catch {
        // shown below instead
      }
    }
    // Output and errors stay on screen; the query stays so it can be tweaked.
    setOpen(false);
    setNotice(res.message);
  };

  const go = (item: Item | undefined, newTab: boolean) => {
    setExpanded(false);
    if (item?.kind === 'command' || (!item && command)) {
      void runBuiltin((item?.kind === 'command' ? item : (command as Extract<Item, { kind: 'command' }>)).result, newTab);
      return;
    }
    if (item?.kind === 'gemini' || (!item && geminiMode && q)) {
      toGemini(q, newTab);
      return;
    }
    if (item?.kind === 'add') {
      setOpen(false);
      setQuery('');
      onAddSite(item.url);
      return;
    }
    const url = item ? item.url : destinationFor(q, engineId);
    if (!q && !item) return;
    if (item?.kind === 'site') recordVisit(item.siteId);
    setOpen(false);
    setQuery('');
    void newTab;
    openInNewTab(url);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Multi-line text: the arrows move the caret between lines.
      if (!items.length || expanded || query.includes('\n')) return;
      e.preventDefault();
      setOpen(true);
      // -1 is "the input itself"; wrapping passes through it in both directions.
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => {
        const next = i + step;
        if (next >= items.length) return -1;
        if (next < -1) return items.length - 1;
        return next;
      });
    } else if (e.key === 'Enter') {
      if (e.shiftKey) return; // new line
      e.preventDefault();
      // Enter: search (or open the pick) in a new tab · Ctrl/⌘+Enter: the same
      // in a new window · Alt+Enter: ask the selected AI.
      if (e.altKey && q) {
        toGemini(q, false);
        setExpanded(false);
        return;
      }
      const pick = active >= 0 && !expanded ? items[active] : undefined;
      if ((e.ctrlKey || e.metaKey) && q && pick?.kind !== 'command' && pick?.kind !== 'gemini' && pick?.kind !== 'add') {
        if (pick?.kind === 'site') recordVisit(pick.siteId);
        openInNewWindow(pick ? pick.url : destinationFor(q, engineId));
        setOpen(false);
        setQuery('');
        setExpanded(false);
        return;
      }
      go(pick, false);
    } else if (e.key === 'Escape') {
      if (expanded) setExpanded(false);
      else if (open && q) setOpen(false);
      else {
        setQuery('');
        e.currentTarget.blur();
      }
    }
  };

  const showDropdown = open && items.length > 0 && !expanded;

  const firstWeb = items.findIndex((i) => i.kind === 'web');
  const goIndex = items.findIndex((i) => i.kind === 'go');

  // Clear, voice, AI mode and Search: in the bar, or in the composer footer when expanded.
  const actions = (
    <div className="flex shrink-0 items-center gap-2.5">
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs text-white/40 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      ) : (
        <kbd className="hidden shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/45 sm:inline">
          /
        </kbd>
      )}
      {speech.supported && (
        <button
          type="button"
          onClick={() => (speech.listening ? speech.stop() : void speech.start())}
          aria-label={speech.listening ? 'Stop voice input' : 'Search by voice'}
          aria-pressed={speech.listening}
          title={speech.listening ? 'Stop listening' : 'Search by voice'}
          className={`relative flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
            speech.listening ? 'mic-live bg-red-500/20 text-red-300' : 'text-white/45 hover:bg-white/10 hover:text-white'
          }`}
        >
          <MicIcon className="size-[18px]" />
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          updateSettings({ geminiMode: !geminiMode });
          inputRef.current?.focus();
        }}
        onWheel={(e) => cycleAi(e.deltaY || e.deltaX)}
        aria-label={`${ai.name} mode`}
        aria-pressed={geminiMode}
        title={`${geminiMode ? `${ai.name} mode on — Enter asks ${ai.name}` : `Ask ${ai.name} instead of searching ${engine.name}`} · scroll to switch AI · Alt+Enter asks it`}
        className={`flex size-8 shrink-0 items-center justify-center rounded-xl border transition-all ${
          geminiMode
            ? 'border-[#9b72cb]/50 bg-[#9b72cb]/20'
            : 'border-transparent opacity-60 grayscale hover:bg-white/10 hover:opacity-100 hover:grayscale-0'
        }`}
      >
        <AiIcon provider={ai} className="size-[18px]" />
      </button>
      <button
        type="button"
        onClick={() => (q ? go(undefined, false) : inputRef.current?.focus())}
        aria-label={geminiMode ? `Ask ${ai.name} now` : 'Search the web'}
          title={geminiMode ? `Ask ${ai.name}` : `Search ${engine.name}`}
        className="accent-gradient flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 min-[1700px]:px-4 text-xs font-semibold tracking-wide text-white shadow-md transition-transform hover:scale-[1.03]"
      >
        <SearchIcon className="size-4" />
        <span className="hidden min-[1700px]:inline">SEARCH</span>
      </button>
    </div>
  );

  return (
    <div ref={rootRef} className={`h-[52px] min-w-0 flex-1 max-sm:basis-full ${expanded ? '' : 'relative'}`}>
      <div
        data-gemini={geminiMode || undefined}
        data-ai={geminiMode ? ai.id : undefined}
        data-composer={expanded ? 'expanded' : 'compact'}
        className={`glass-raised isolate flex flex-col rounded-2xl transition-[border-color,box-shadow] duration-300 focus-within:border-white/30 ${
          geminiMode ? 'gemini-ring' : ''
        } ${expanded ? 'search-composer absolute inset-x-0 top-0 z-40 max-h-[280px] bg-[var(--color-base-elevated)]/95' : 'relative h-[52px]'}`}
      >
       <div className={`flex min-h-0 gap-2.5 pl-4 ${expanded ? 'flex-1 items-start pt-2 pr-3' : 'h-[52px] items-center pr-1.5'}`}>
        {geminiMode ? (
          <AiIcon provider={ai} className={`size-5 shrink-0 ${expanded ? 'mt-2.5' : ''}`} />
        ) : (
          <SearchIcon className={`size-5 shrink-0 text-white/45 ${expanded ? 'mt-2.5' : ''}`} />
        )}
        <div className={`relative flex min-h-0 min-w-0 flex-1 self-stretch ${expanded ? 'pt-1.5 pb-1' : 'items-center'}`}>
        <textarea
          ref={inputRef}
          rows={1}
          wrap={expanded ? 'soft' : 'off'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => q && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={
            speech.listening ? 'Listening…' : geminiMode ? `Ask ${ai.name} anything…` : `Search ${engine.name} or your sites — Alt+Enter asks ${ai.name}`
          }
          aria-label="Search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          aria-activedescendant={active >= 0 ? `search-opt-${active}` : undefined}
          aria-autocomplete="list"
          aria-multiline={expanded}
          spellCheck={false}
          autoComplete="off"
          className={`block w-full min-w-0 resize-none bg-transparent text-[15px] leading-6 font-medium text-white placeholder-white/40 outline-none ${
            expanded ? 'composer-scroll max-h-[214px] overflow-y-auto pr-2' : `h-6 overflow-hidden ${multiline ? 'pr-6' : ''}`
          }`}
        />
        <AnimatePresence>
          {multiline && !expanded && (
            <motion.button
              key="expand"
              type="button"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.14 }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleExpanded}
              aria-label="Expand search composer"
              title={`Expand (${lines} line${lines === 1 ? '' : 's'} · ${query.length} chars)`}
              data-testid="composer-expand"
              className="composer-toggle absolute right-0 bottom-[3px] flex h-[15px] items-center gap-0.5 rounded-[5px] border border-white/15 px-1 text-white/60 hover:border-white/30 hover:text-white"
            >
              <ExpandIcon className="size-[10px]" />
            </motion.button>
          )}
        </AnimatePresence>
        </div>
        {!expanded && actions}
       </div>
        {expanded && (
          <div className="flex shrink-0 items-center gap-3 border-t border-white/10 py-1.5 pr-1.5 pl-4 font-mono text-[10.5px] whitespace-nowrap text-white/45 tabular-nums">
            <span data-testid="composer-lines">
              {lines} line{lines === 1 ? '' : 's'} · {query.length} chars
            </span>
            <span className="hidden min-[1800px]:inline">⇧↵ new line · ↵ {geminiMode ? `ask ${ai.name}` : `search · Ctrl+↵ new window · Alt+↵ ask ${ai.name}`} · Esc collapse</span>
            <span className="ml-auto" />
            {actions}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleExpanded}
              aria-label="Collapse search composer"
              title="Collapse (Esc) · Shift+Enter adds a line"
              data-testid="composer-collapse"
              className="composer-toggle flex size-8 items-center justify-center rounded-xl border border-white/15 text-white/60 hover:border-white/30 hover:text-white"
            >
              <CollapseIcon className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {hint && !showDropdown && (
        <p
          role="status"
          data-testid="search-hint"
          className="glass-raised absolute top-full left-4 z-50 mt-2 rounded-xl bg-[var(--color-base-elevated)]/95 px-3 py-1.5 text-xs text-white/80"
        >
          {hint}
        </p>
      )}

      {showDropdown && (
        <div
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className="glass-raised absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl bg-[var(--color-base-elevated)]/95 py-1.5"
        >
          {items.map((item, i) => (
            <div key={item.key}>
              {i === 0 && item.kind === 'site' && <TierLabel>Your sites</TierLabel>}
              {i === firstWeb && <TierLabel divider={i > 0}>Suggestions</TierLabel>}
              {i === goIndex && i > 0 && <div className="mx-3 my-1 h-px bg-white/[0.07]" />}
              <button
                id={`search-opt-${i}`}
                type="button"
                role="option"
                aria-selected={active === i}
                onMouseEnter={() => setActive(i)}
                onClick={(e) => go(item, e.ctrlKey || e.metaKey)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                  active === i ? 'bg-white/12 text-white' : 'text-white/80'
                }`}
              >
                {item.kind === 'site' ? (
                  <>
                    <Favicon url={item.url} name={item.name} className="size-5 shrink-0" />
                    <span className="truncate font-semibold text-white">{item.name}</span>
                    <span className="truncate font-mono text-xs text-white/40">{item.meta}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-white/35">open ↗</span>
                  </>
                ) : item.kind === 'web' ? (
                  <>
                    <SearchIcon className="size-4 shrink-0 text-white/35" />
                    <span className="truncate">{item.text}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-white/35">{engine.name}</span>
                  </>
                ) : item.kind === 'command' ? (
                  <>
                    <span className="flex size-5 shrink-0 items-center justify-center font-mono text-xs font-bold text-[var(--color-accent)]">&gt;_</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono font-semibold text-white">{item.text}</span>
                      <span className={`ml-2 font-mono text-xs ${item.result.kind === 'error' ? 'text-red-300' : 'text-white/55'}`}>
                        {item.result.kind === 'output' ? `→ ${item.result.message}` : item.result.message}
                      </span>
                    </span>
                    <kbd className="ml-auto shrink-0 font-mono text-[10px] text-white/35">Run ↵</kbd>
                  </>
                ) : item.kind === 'gemini' ? (
                  <>
                    <AiIcon provider={ai} className="size-5 shrink-0" />
                    <span className="truncate">
                      Ask {ai.name} <span className="font-semibold text-white">“{item.text}”</span>
                    </span>
                    <kbd className="ml-auto shrink-0 font-mono text-[10px] text-white/35">Enter</kbd>
                  </>
                ) : item.kind === 'add' ? (
                  <>
                    <span className="flex size-5 shrink-0 items-center justify-center text-emerald-300">+</span>
                    <span className="truncate">
                      Add <span className="font-semibold text-white">{getHostname(item.url)}</span> to your library
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex size-5 shrink-0 items-center justify-center text-[var(--color-accent)]">
                      {item.isUrl ? '↗' : '↵'}
                    </span>
                    <span className="truncate">
                      {item.isUrl ? 'Open ' : `Search ${engine.name} for `}
                      <span className="font-semibold text-white">“{item.text}”</span>
                    </span>
                    <kbd className="ml-auto shrink-0 font-mono text-[10px] text-white/35">Enter</kbd>
                  </>
                )}
              </button>
            </div>
          ))}
          {!geminiMode && (
            <p data-testid="search-ai-hint" className="mx-3 mt-1 flex items-center justify-end gap-1.5 border-t border-white/[0.07] pt-1.5 font-mono text-[10px] text-white/40">
              <AiIcon provider={ai} className="size-3" />
              <kbd className="rounded border border-white/15 px-1 text-white/55">Ctrl</kbd>+<kbd className="rounded border border-white/15 px-1 text-white/55">Enter</kbd> new window ·{' '}
              <kbd className="rounded border border-white/15 px-1 text-white/55">Alt</kbd>+<kbd className="rounded border border-white/15 px-1 text-white/55">Enter</kbd> asks {ai.name}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

function TierLabel({ children, divider = false }: { children: string; divider?: boolean }) {
  return (
    <div
      className={`px-4 pt-1.5 pb-1 text-[10px] font-bold tracking-[0.18em] text-white/40 uppercase ${
        divider ? 'mt-1 border-t border-white/[0.07] pt-2' : ''
      }`}
    >
      {children}
    </div>
  );
}

// The chosen AI's mark: Gemini's sparkle, otherwise a simple glyph in the
// service's colour.
function AiIcon({ provider, className }: { provider: AiProvider; className: string }) {
  if (provider.id === 'gemini') return <GeminiSparkle className={className} />;
  const glyph = provider.id === 'chatgpt' ? '✺' : provider.id === 'claude' ? '✳' : provider.id === 'perplexity' ? '⁂' : '✦';
  return (
    <span aria-hidden className={`${className} flex items-center justify-center text-[15px] leading-none font-bold`} style={{ color: provider.color }}>
      {glyph}
    </span>
  );
}

// Four-point sparkle in Gemini's blue → violet → rose.
function GeminiSparkle({ className }: { className: string }) {
  const id = `gemini-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={id} x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4285f4" />
          <stop offset="0.55" stopColor="#9b72cb" />
          <stop offset="1" stopColor="#d96570" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 2c.6 5.2 4.8 9.4 10 10-5.2.6-9.4 4.8-10 10-.6-5.2-4.8-9.4-10-10 5.2-.6 9.4-4.8 10-10z"
      />
    </svg>
  );
}

function ExpandIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" />
    </svg>
  );
}

function CollapseIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.5 6.5h-4v-4M9.5 6.5 14 2M2.5 9.5h4v4M6.5 9.5 2 14" />
    </svg>
  );
}

function MicIcon({ className }: { className: string }) {

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}
