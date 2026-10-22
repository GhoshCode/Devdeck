import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useStore } from '../../store';
import { cardsAtRest, freeColumns, nextMode, sideMax, type SnapGeometry } from '../../lib/cardSnap';
import { CardSnapHandle, EdgeTab } from './CardSnapHandle';
import { MIN_LINKS, MIN_TERMINAL, TopSplitHandle } from './TopSplitHandle';

// The v2 page shell (plan §1, §4 Phase 0): Top Bar, Search Row, then the
// 3-column cockpit — D on the left, the E/F + cards frame in the centre, I/J on
// the right. Responsive rules:
//   ≥1440px     all three columns inline
//   1024–1439px left column inline (narrower), right column in a drawer
//   <1024px     both side columns become slide-out drawers
// Each side slot is rendered exactly once — inline or in its drawer — so
// widget state is never duplicated. With all three inline, a handle on each
// side of the centre resizes freely, and a tab on each inside edge of the
// cards box switches between balanced 1-, 2- and 3-card modes (2 by default).

interface DashboardLayoutProps {
  topBar: ReactNode;
  searchRow?: ReactNode; // optional: the search lives in the top bar now
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  // Pinned to the foot of the left column (the main settings gear).
  leftFooter?: ReactNode;
  // The terminal box, beside the quick-links bar.
  rightTop?: ReactNode;
  // All categories + the quick-links bar, above the cards.
  linksRow?: ReactNode;
}

// Lets the top bar know whether the right column (and its terminal slot) is
// on screen or folded into a drawer.
// cards: whole category cards in view (1–3); the links bar fits without scrolling below 3.
export const LayoutContext = createContext<{ rightInline: boolean; cards: number }>({ rightInline: false, cards: 3 });
export const useLayout = () => useContext(LayoutContext);

type Side = 'left' | 'right';

export function DashboardLayout({
  topBar,
  searchRow,
  left,
  center,
  right,
  leftFooter,
  rightTop,
  linksRow,
}: DashboardLayoutProps) {
  const termWidth = useStore((s) => s.settings.topTerminalWidth ?? null);
  const updateSettings = useStore((s) => s.updateSettings);
  const topRowRef = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery('(min-width: 1440px)');
  const medium = useMediaQuery('(min-width: 1024px)');
  const leftInline = medium;
  const rightInline = wide;
  const [drawer, setDrawer] = useState<Side | null>(null);

  // Close a drawer whose column has become inline after a resize.
  useEffect(() => {
    if ((drawer === 'left' && leftInline) || (drawer === 'right' && rightInline)) setDrawer(null);
  }, [drawer, leftInline, rightInline]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  const snap = useCardSnap(rightInline);
  // Unresized, the terminal is as wide as the Git box in the top bar (or the news column without one).
  const gitWidth = useWidthOf('[data-testid="git-widget"]', rightInline);
  const searchSpan = useSpanOf('[data-search-row]', topRowRef, rightInline);
  // On narrower screens the terminal gives way first, so the links bar keeps
  // room for its fixed quick links (never below MIN_TERMINAL).
  const room = searchSpan ? searchSpan.row - searchSpan.left - 36 - MIN_LINKS : Infinity;
  const terminal = Math.round(Math.max(MIN_TERMINAL, Math.min(termWidth ?? gitWidth ?? snap.rightWidth, room)));

  const columns = rightInline
    ? snap.dragging || !snap.settled
      ? ''
      : 'transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none'
    : leftInline
      ? 'grid-cols-[200px_minmax(0,1fr)]'
      : 'grid-cols-1';

  const leftColumn = (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-3">{left}</div>
      {leftInline && leftFooter}
    </div>
  );

  return (
    <LayoutContext.Provider value={{ rightInline, cards: rightInline ? snap.cards : 3 }}>
    <div
      data-testid="dashboard"
      className="relative z-0 flex h-[calc(100vh/var(--ui-zoom,1))] w-[calc(100vw/var(--ui-zoom,1))] flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-4 sm:px-6 lg:overflow-y-hidden"
    >
      {/* above the cockpit, so the search suggestions and panel cover the terminal box */}
      <div data-zone="top-bar" className="relative z-40 shrink-0">
        {topBar}
      </div>
      {searchRow && (
        <div data-zone="search-row" className="shrink-0">
          {searchRow}
        </div>
      )}

      {/* Below 1024px the dashboard scrolls inside itself (never the page) so the
          cockpit keeps a usable height instead of being squeezed. */}
      <div
        ref={snap.cockpitRef}
        data-zone="cockpit"
        className={`grid min-h-0 flex-1 max-lg:min-h-[600px] [--links-bar-h:56px] ${rightInline ? '' : 'gap-3'} ${columns}`}
        style={rightInline ? { ...snap.style, gridTemplateRows: 'calc(var(--links-bar-h) + 7px) minmax(0, 1fr)', rowGap: 12 } : undefined}
      >
        {/* Wide screens: the quick-links bar and the terminal share their own row
            above the cards and the news. The links bar sits right under the search
            row (same left edge, whatever the columns below do) and fills the
            row up to the terminal, growing when the terminal narrows. By default the terminal is as wide
            as the Git box in the top bar; drag the handle between them to size it
            — double-click to go back. */}
        {rightInline && (
          <div ref={topRowRef} data-zone="top-row" className="flex min-w-0 items-end pt-[7px]" style={{ gridColumn: '1 / 6', gridRow: 1 }}>
            <div
              data-zone="links-row"
              className="min-w-0 flex-1 [&>*]:mx-0"
              style={searchSpan ? { marginLeft: searchSpan.left } : undefined}
            >
              {linksRow}
            </div>
            {/* the handle sits 12px from both: the links fill up to it */}
            <div className="w-3 shrink-0" />
            <TopSplitHandle
              width={terminal}
              custom={termWidth !== null}
              rowRef={topRowRef}
              lead={(searchSpan?.left ?? 0) + 36}
              onChange={(w) => updateSettings({ topTerminalWidth: w })}
            />
            <div data-zone="right-top" className="ml-3 flex shrink-0 items-center" style={{ width: terminal, height: 'var(--links-bar-h)' }}>
              <div className="w-full">{rightTop}</div>
            </div>
          </div>
        )}
        {leftInline && (
          <aside data-zone="left" aria-label="Currently processing" className="flex min-h-0 flex-col gap-3" style={rightInline ? { gridColumn: 1, gridRow: 2 } : undefined}>
            {/* breathing space level with the quick-links bar */}
            {!rightInline && <div aria-hidden className="shrink-0" style={{ height: 'var(--links-bar-h)' }} />}
            <div className="min-h-0 flex-1">{leftColumn}</div>
          </aside>
        )}
        {rightInline && (
          <div style={{ gridColumn: 2, gridRow: 2 }} className="flex min-h-0">
            <CardSnapHandle side="left" {...snap.handle('left')} />
          </div>
        )}
        <section ref={snap.centerRef} data-zone="center" className="relative flex min-h-0 min-w-0 flex-col gap-3" style={rightInline ? { gridColumn: 3, gridRow: 2 } : undefined}>
          {!rightInline && <div className="mt-[7px] shrink-0">{linksRow}</div>}
          {center}
          {rightInline && snap.canStep && <EdgeTab side="left" cards={snap.cards} next={snap.next} unit={snap.unit} onStep={snap.step} onCards={snap.toCards} />}
          {rightInline && snap.canStep && <EdgeTab side="right" cards={snap.cards} next={snap.next} unit={snap.unit} onStep={snap.step} onCards={snap.toCards} />}
        </section>
        {rightInline && (
          <div style={{ gridColumn: 4, gridRow: 2 }} className="flex min-h-0">
            <CardSnapHandle side="right" {...snap.handle('right')} />
          </div>
        )}
        {rightInline && (
          <aside data-zone="right" aria-label="Tech news and topics" className="flex min-h-0 flex-col gap-3" style={{ gridColumn: 5, gridRow: 2 }}>
            <div className="min-h-0 flex-1">{right}</div>
          </aside>
        )}
      </div>

      {/* With the left column in a drawer, its footer floats bottom-left. */}
      {!leftInline && leftFooter && <div className="fixed bottom-4 left-4 z-30">{leftFooter}</div>}

      {/* Drawer toggles for whichever columns are collapsed */}
      {!leftInline && (
        <DrawerToggle side="left" label="Open currently processing" onClick={() => setDrawer('left')} />
      )}
      {!rightInline && (
        <DrawerToggle side="right" label="Open news and topics" onClick={() => setDrawer('right')} />
      )}

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(null)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              key={drawer}
              role="dialog"
              aria-label={drawer === 'left' ? 'Currently processing' : 'Tech news and topics'}
              initial={{ x: drawer === 'left' ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: drawer === 'left' ? '-100%' : '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className={`fixed top-0 bottom-0 z-50 flex w-[min(320px,86vw)] flex-col p-4 ${
                drawer === 'left' ? 'left-0' : 'right-0'
              } bg-[var(--color-base-elevated)]/95 backdrop-blur-2xl border-white/10 ${
                drawer === 'left' ? 'border-r' : 'border-l'
              }`}
            >
              {drawer === 'left' ? leftColumn : right}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
    </LayoutContext.Provider>
  );
}

const HANDLE = 12; // each resize handle stands in for the old column gap
const LEFT_BASE = 250;
const RIGHT_BASE = 300;

// Measures the cockpit and the category cards, and turns the saved side
// widths into columns. The outside handles set a width freely; the edge tabs
// step the centre down by whole cards.
function useCardSnap(enabled: boolean) {
  const cockpitRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLElement>(null);
  const leftW = useStore((s) => s.settings.cockpitLeftWidth ?? null);
  const rightW = useStore((s) => s.settings.cockpitRightWidth ?? null);
  const mode = useStore((s) => s.settings.cockpitCards ?? null);
  const categoryCount = useStore((s) => s.categories.length);
  const updateSettings = useStore((s) => s.updateSettings);
  const [geo, setGeo] = useState<SnapGeometry | null>(null);
  const [dragging, setDragging] = useState(false);
  // No column animation until the first measured layout is on screen, so the
  // page doesn't visibly slide into its card mode on load.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!geo || settled) return;
    const t = setTimeout(() => setSettled(true), 120);
    return () => clearTimeout(t);
  }, [geo, settled]);

  useLayoutEffect(() => {
    const cockpit = cockpitRef.current;
    const centre = centerRef.current;
    if (!enabled || !cockpit || !centre) return;
    const measure = () => {
      const track = centre.querySelector<HTMLElement>('[data-cards-track]');
      const card = track?.firstElementChild as HTMLElement | null;
      if (!track || !card) return setGeo(null);
      const cs = getComputedStyle(track);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      setGeo({
        width: cockpit.clientWidth,
        handle: HANDLE,
        leftBase: LEFT_BASE,
        rightBase: RIGHT_BASE,
        chrome: centre.offsetWidth - track.clientWidth + pad,
        card: card.offsetWidth,
        gap: parseFloat(cs.columnGap) || 0,
        count: categoryCount || undefined,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(cockpit);
    ro.observe(centre);
    const t = setTimeout(measure, 400); // cards mount after their entrance animation starts
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [enabled, categoryCount]);

  const cols = geo ? freeColumns(geo, leftW, rightW, mode) : null;
  const left = cols?.left ?? LEFT_BASE;
  const right = cols?.right ?? RIGHT_BASE;
  const style: CSSProperties = {
    gridTemplateColumns: `${left}px ${HANDLE}px minmax(0,1fr) ${HANDLE}px ${right}px`,
  };
  const save = (side: Side, w: number | null) => updateSettings(side === 'left' ? { cockpitLeftWidth: w } : { cockpitRightWidth: w });
  const handle = (side: Side) => ({
    width: side === 'left' ? left : right,
    min: side === 'left' ? LEFT_BASE : RIGHT_BASE,
    max: geo ? sideMax(geo, side === 'left' ? right : left) : side === 'left' ? left : right,
    onChange: (w: number | null) => {
      // double-click: back to the card mode
      if (w === null) return updateSettings({ cockpitLeftWidth: null, cockpitRightWidth: null });
      // the first drag of one side pins the other where it is, so it doesn't jump
      const other: Side = side === 'left' ? 'right' : 'left';
      if (leftW === null && rightW === null) save(other, other === 'left' ? left : right);
      save(side, w);
    },
    onDragging: setDragging,
  });
  // The edge tabs pick a whole-card mode; both sides follow it (free widths are dropped).
  const toCards = (n: number) => updateSettings({ cockpitCards: n, cockpitLeftWidth: null, cockpitRightWidth: null });
  const step = () => geo && toCards(nextMode(geo, left, right));
  const next = geo ? nextMode(geo, left, right) : 1;
  // only one mode fits (narrow screen or a single category): no tabs to show
  const canStep = !!geo && cardsAtRest(geo) > 1;
  const unit = geo ? geo.card + geo.gap : 420;
  const cards = cols?.cards ?? (geo ? Math.max(1, cardsAtRest(geo)) : 3);
  return { cockpitRef, centerRef, style, handle, step, toCards, next, canStep, unit, cards, rightWidth: right, dragging, settled };
}

// Where the first element matching the selector sits horizontally, relative to
// the given row ({ left, width } px; null if either is missing). Kept current.
function useSpanOf(selector: string, rowRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [span, setSpan] = useState<{ left: number; width: number; row: number } | null>(null);
  useEffect(() => {
    const row = rowRef.current;
    const el = document.querySelector(selector);
    if (!enabled || !row || !el) return setSpan(null);
    const read = () => {
      const r = row.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      setSpan((prev) => {
        const next = { left: Math.round(b.left - r.left), width: Math.round(b.width), row: Math.round(r.width) };
        return prev && prev.left === next.left && prev.width === next.width && prev.row === next.row ? prev : next;
      });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(row);
    ro.observe(el);
    window.addEventListener('resize', read);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', read);
    };
  }, [selector, rowRef, enabled]);
  return span;
}

// Width of the first element matching the selector, kept current (null if none).
function useWidthOf(selector: string, enabled: boolean) {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let ro: ResizeObserver | null = null;
    let seen: Element | null = null;
    const attach = () => {
      const el = document.querySelector(selector);
      if (el === seen) return;
      ro?.disconnect();
      seen = el;
      if (!el) return setWidth(null);
      const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
      read();
      ro = new ResizeObserver(read);
      ro.observe(el);
    };
    attach();
    // the widget can be swapped or hidden in Settings
    const mo = new MutationObserver(attach);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      ro?.disconnect();
      mo.disconnect();
    };
  }, [selector, enabled]);
  return width;
}

function DrawerToggle({ side, label, onClick }: { side: Side; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`glass-raised fixed top-1/2 z-30 flex h-16 w-5 -translate-y-1/2 items-center justify-center text-white/60 hover:text-white ${
        side === 'left' ? 'left-0 rounded-r-xl border-l-0' : 'right-0 rounded-l-xl border-r-0'
      }`}
    >
      <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={side === 'left' ? 'M4 2l4 4-4 4' : 'M8 2L4 6l4 4'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
