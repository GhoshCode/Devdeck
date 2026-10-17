import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

// The v2 page shell (plan §1, §4 Phase 0): Top Bar, Search Row, then the
// 3-column cockpit — D on the left, the E/F + cards frame in the centre, I/J on
// the right. Responsive rules:
//   ≥1440px     all three columns inline
//   1024–1439px left column inline (narrower), right column in a drawer
//   <1024px     both side columns become slide-out drawers
// Each side slot is rendered exactly once — inline or in its drawer — so
// widget state is never duplicated.

interface DashboardLayoutProps {
  topBar: ReactNode;
  searchRow: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  // Pinned to the foot of the left column (the main settings gear).
  leftFooter?: ReactNode;
}

type Side = 'left' | 'right';

export function DashboardLayout({
  topBar,
  searchRow,
  left,
  center,
  right,
  leftFooter,
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

  const columns = rightInline
    ? 'grid-cols-[minmax(220px,250px)_minmax(0,1fr)_minmax(260px,300px)]'
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
    <div
      data-testid="dashboard"
      className="relative z-0 flex h-screen w-screen flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-4 sm:px-6 lg:overflow-y-hidden"
    >
      <div data-zone="top-bar" className="shrink-0">
        {topBar}
      </div>
      <div data-zone="search-row" className="shrink-0 py-2">
        {searchRow}
      </div>

      {/* Below 1024px the dashboard scrolls inside itself (never the page) so the
          cockpit keeps a usable height instead of being squeezed. */}
      <div data-zone="cockpit" className={`grid min-h-0 flex-1 gap-3 max-lg:min-h-[600px] ${columns}`}>
        {leftInline && (
          <aside data-zone="left" aria-label="Currently processing" className="min-h-0">
            {leftColumn}
          </aside>
        )}
        <section data-zone="center" className="flex min-h-0 min-w-0 flex-col">
          {center}
        </section>
        {rightInline && (
          <aside data-zone="right" aria-label="Tech news and topics" className="min-h-0">
            {right}
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
  );
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
