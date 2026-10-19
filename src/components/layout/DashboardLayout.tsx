import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useStore } from '../../store';
import { clampTaken, maxTaken, snapColumns, type SnapGeometry } from '../../lib/cardSnap';
import { CardSnapHandle } from './CardSnapHandle';

// The v2 page shell (plan §1, §4 Phase 0): Top Bar, Search Row, then the
// 3-column cockpit — D on the left, the E/F + cards frame in the centre, I/J on
// the right. Responsive rules:
//   ≥1440px     all three columns inline
//   1024–1439px left column inline (narrower), right column in a drawer
//   <1024px     both side columns become slide-out drawers
// Each side slot is rendered exactly once — inline or in its drawer — so
// widget state is never duplicated. With all three inline, a handle on each
// side of the centre resizes by whole category cards (1–3 stay in the centre).

interface DashboardLayoutProps {
  topBar: ReactNode;
  searchRow?: ReactNode; // optional: the search lives in the top bar now
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  // Pinned to the foot of the left column (the main settings gear).
  leftFooter?: ReactNode;
  // Sits above the right column, level with the floating quick-links bar
  // (the terminal box), so both side columns start where the cards start.
  rightTop?: ReactNode;
}

// Lets the top bar know whether the right column (and its terminal slot) is
// on screen or folded into a drawer.
export const LayoutContext = createContext<{ rightInline: boolean }>({ rightInline: false });
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
}: DashboardLayoutProps) {
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

  const columns = rightInline
    ? 'transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none'
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
    <LayoutContext.Provider value={{ rightInline }}>
    <div
      data-testid="dashboard"
      className="relative z-0 flex h-screen w-screen flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-4 sm:px-6 lg:overflow-y-hidden"
    >
      <div data-zone="top-bar" className="shrink-0">
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
        style={rightInline ? snap.style : undefined}
      >
        {leftInline && (
          <aside data-zone="left" aria-label="Currently processing" className="flex min-h-0 flex-col gap-3">
            {/* breathing space level with the quick-links bar */}
            <div aria-hidden className="shrink-0" style={{ height: 'var(--links-bar-h)' }} />
            <div className="min-h-0 flex-1">{leftColumn}</div>
          </aside>
        )}
        {rightInline && <CardSnapHandle side="left" {...snap.handle('left')} />}
        <section ref={snap.centerRef} data-zone="center" className="flex min-h-0 min-w-0 flex-col">
          {center}
        </section>
        {rightInline && <CardSnapHandle side="right" {...snap.handle('right')} />}
        {rightInline && (
          <aside data-zone="right" aria-label="Tech news and topics" className="flex min-h-0 flex-col gap-3">
            <div data-zone="right-top" className="flex shrink-0 items-center" style={{ height: 'var(--links-bar-h)' }}>
              <div className="w-full">{rightTop}</div>
            </div>
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

// Measures the cockpit and the category cards, and turns the saved "cards
// taken" per side into column widths.
function useCardSnap(enabled: boolean) {
  const cockpitRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLElement>(null);
  const left = useStore((s) => s.settings.cockpitLeftCards ?? 0);
  const right = useStore((s) => s.settings.cockpitRightCards ?? 0);
  const categoryCount = useStore((s) => s.categories.length);
  const updateSettings = useStore((s) => s.updateSettings);
  const [geo, setGeo] = useState<SnapGeometry | null>(null);

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

  const cols = geo ? snapColumns(geo, left, right) : null;
  const taken = geo ? clampTaken(geo, left, right) : { left: 0, right: 0 };
  const max = geo ? maxTaken(geo) : 0;
  const style: CSSProperties = {
    gridTemplateColumns: `${cols?.left ?? LEFT_BASE}px ${HANDLE}px minmax(0,1fr) ${HANDLE}px ${cols?.right ?? RIGHT_BASE}px`,
  };
  const handle = (side: 'left' | 'right') => ({
    taken: taken[side],
    max: max - (side === 'left' ? taken.right : taken.left),
    unit: geo ? geo.card + geo.gap : 420,
    onChange: (n: number) => updateSettings(side === 'left' ? { cockpitLeftCards: n } : { cockpitRightCards: n }),
  });
  return { cockpitRef, centerRef, style, handle };
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
