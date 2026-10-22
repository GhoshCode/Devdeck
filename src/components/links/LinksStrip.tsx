import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import { animate, motion, useMotionValue, useTransform, type MotionValue } from 'motion/react';
import { useStore } from '../../store';
import { useNow } from '../../hooks/useNow';
import { buildStrip, relativeAge, type StripLink } from '../../services/search';
import { Favicon } from '../Favicon';

// Header strip of the centre frame (Zone 4, §7 Q7/Q8):
//   [E][E][E][E] fixed │ more E (auto-picked) … │ F recent … →
// The first five quick links never move; everything after them shares one
// horizontal scroller with a fade mask on the right edge. A faint three-line
// grip on the bar's right edge opens a panel under it with the other and recent
// sites (up to MORE_MAX), all in view; meanwhile the bar shows only the fixed ones.

const MORE_MAX = 15;

export const LinksStrip = memo(function LinksStrip() {
  const quickLinks = useStore((s) => s.quickLinks);
  const sites = useStore((s) => s.sites);
  const autoCount = useStore((s) => s.settings.autoQuickLinkCount);
  const recentCount = useStore((s) => s.settings.recentLinkCount);
  const recordVisit = useStore((s) => s.recordVisit);
  const now = useNow(60_000).getTime();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const strip = useMemo(
    () => buildStrip(quickLinks, sites, autoCount, recentCount, now),
    [quickLinks, sites, autoCount, recentCount, now],
  );
  const lastVisited = useMemo(() => new Map(sites.map((s) => [s.id, s.lastVisited])), [sites]);

  // However narrow the bar gets, its chips scroll sideways (drag, trackpad or
  // the vertical wheel), never hide.
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft += e.deltaY;
  };

  const open = (link: StripLink) => link.siteId && recordVisit(link.siteId);

  // The panel follows the pointer: progress runs 0 (folded) → 1 (open) while
  // the grip is dragged down or the panel's bottom edge is dragged up, and a
  // short ease-out carries it the rest of the way on release (or on a click).
  const progress = useMotionValue(0);
  const [expanded, setExpanded] = useState(false); // mounted (open, opening or closing)
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelHeight = () => panelRef.current?.offsetHeight || 200;
  const settle = (to: 0 | 1) => {
    setExpanded(true);
    // ease-out only: quick start, gentle landing, no overshoot
    void animate(progress, to, { duration: 0.32, ease: [0.16, 1, 0.3, 1] }).then(() => {
      if (to === 0 && progress.get() === 0) setExpanded(false);
    });
  };
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && settle(0);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && settle(0);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);
  const isOpen = progress.get() > 0.5;
  // Grip: drag down to pull the panel open; a click toggles it.
  const gripDrag = useVerticalDrag({
    onStart: () => setExpanded(true),
    onMove: (dy) => progress.set(clamp01(dy / panelHeight())),
    onEnd: (dy, v) => settle(dy / panelHeight() > 0.3 || v > 0.4 ? 1 : 0),
    onTap: () => settle(progress.get() > 0.5 ? 0 : 1),
  });
  // Bottom edge: drag up to fold the panel away; a click closes it.
  const edgeDrag = useVerticalDrag({
    onMove: (dy) => progress.set(clamp01(1 + dy / panelHeight())),
    onEnd: (dy, v) => settle(1 + dy / panelHeight() < 0.7 || v < -0.4 ? 0 : 1),
    onTap: () => settle(0),
  });

  // Everything after the fixed sites, each site once, most useful first.
  const more = useMemo(() => {
    const seen = new Set(strip.fixed.map((l) => l.url));
    const out: Array<{ link: StripLink; variant: 'auto' | 'recent' }> = [];
    for (const [list, variant] of [[strip.scrolling, 'auto'], [strip.recent, 'recent']] as const) {
      for (const link of list) {
        if (out.length >= MORE_MAX || seen.has(link.url)) continue;
        seen.add(link.url);
        out.push({ link, variant });
      }
    }
    return out;
  }, [strip]);

  return (
    <div ref={rootRef} className="relative min-w-0">
    <div data-testid="links-strip" className="links-bar glass-raised flex h-[var(--links-bar-h,56px)] min-w-0 shrink-0 items-center gap-2 overflow-hidden rounded-2xl border border-white/10 pr-1 pl-3">
      {/* The first five quick links stay put while the rest and the recent
          links scroll sideways beside them. On a bar too narrow for all five,
          they scroll too rather than being cut. */}
      <div data-strip="fixed" onWheel={onWheel} className="scrollbar-none flex min-w-0 shrink items-center gap-2 overflow-x-auto">
        {strip.fixed.map((link) => (
          <Chip key={link.id} link={link} variant="fixed" onOpen={open} />
        ))}
      </div>

      {/* while the panel is open the bar keeps only the fixed sites; the rest are in the panel */}
      {!expanded && (strip.scrolling.length > 0 || strip.recent.length > 0) && (
        <div
          ref={scrollerRef}
          onWheel={onWheel}
          data-strip="scroll"
          className="scrollbar-none flex min-w-24 flex-1 items-center gap-2 overflow-x-auto pl-1 [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-40px),transparent)]"
        >
          {strip.scrolling.map((link) => (
            <Chip key={link.id} link={link} variant="auto" onOpen={open} />
          ))}
          {strip.recent.length > 0 && (
            <>
              <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-gradient-to-b from-transparent via-white/30 to-transparent" />
              <span data-strip-label className="shrink-0 font-mono text-[9px] font-bold tracking-[0.2em] text-white/35">RECENT</span>
              {strip.recent.map((link) => {
                const at = link.siteId ? lastVisited.get(link.siteId) : null;
                return (
                  <Chip
                    key={`r-${link.id}`}
                    link={link}
                    variant="recent"
                    onOpen={open}
                    badge={at ? relativeAge(at, now) : undefined}
                  />
                );
              })}
            </>
          )}
          <span aria-hidden className="w-6 shrink-0" />
        </div>
      )}
      <button
        type="button"
        onPointerDown={gripDrag}
        // keyboard (Enter / Space): pointer presses are handled by the drag
        onClick={(e) => e.detail === 0 && settle(isOpen ? 0 : 1)}
        aria-expanded={expanded}
        aria-controls="links-panel"
        aria-label={expanded ? 'Close all quick links' : 'Show all quick links'}
        title={expanded ? 'Close · or drag the panel edge up' : 'Show all quick links · click or drag down'}
        data-testid="links-expand"
        className={`links-grip flex h-9 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded-md active:cursor-grabbing ${expanded ? 'is-open' : ''}`}
      >
        <GripDots className="h-4 w-2.5" />
      </button>
    </div>

      {expanded && (
        <PanelShell progress={progress} panelRef={panelRef}>
          {more.length > 0 ? (
            <>
              <div data-panel-row="more" className="flex flex-wrap gap-2">
                {more.map(({ link, variant }) => {
                  const at = variant === 'recent' && link.siteId ? lastVisited.get(link.siteId) : null;
                  return <Chip key={`p-${link.id}`} link={link} variant={variant} onOpen={open} badge={at ? relativeAge(at, now) : undefined} />;
                })}
              </div>
            </>
          ) : (
            <p className="px-1 text-xs text-white/45">No other or recent sites yet.</p>
          )}
          {/* The bottom edge is the panel's handle: drag it up to fold the panel
              away (the sites inside don't drag). */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Close all quick links"
            title="Drag up or click to close"
            data-testid="links-panel-edge"
            onPointerDown={edgeDrag}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && settle(0)}
            className="links-panel-edge -mx-3 mt-2 flex h-5 cursor-grab touch-none items-center justify-center rounded-b-2xl active:cursor-grabbing"
          >
            <GripDots className="links-panel-handle h-2.5 w-4 rotate-90" />
          </div>
        </PanelShell>
      )}
    </div>
  );
});

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// The drag / grab mark: two columns of three dots.
function GripDots({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 10 16" className={className} fill="currentColor" aria-hidden>
      {[2.5, 8, 13.5].map((y) => (
        <g key={y}>
          <circle cx="2.5" cy={y} r="1.5" />
          <circle cx="7.5" cy={y} r="1.5" />
        </g>
      ))}
    </svg>
  );
}

// The panel unrolls from the bar: its bottom is clipped by (1 − progress), it
// slides down a few px and fades in over the first part of the travel. All of
// it rides on one motion value, so it tracks the pointer frame by frame.
function PanelShell({ progress, panelRef, children }: { progress: MotionValue<number>; panelRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  const clipPath = useTransform(progress, (p) => `inset(0 0 ${(1 - p) * 100}% 0 round 16px)`);
  const y = useTransform(progress, [0, 1], [-10, 0]);
  const opacity = useTransform(progress, [0, 0.2, 1], [0, 1, 1]);
  return (
    <motion.div
      ref={panelRef}
      id="links-panel"
      data-testid="links-panel"
      style={{ clipPath, y, opacity }}
      className="links-panel absolute top-full right-0 left-0 z-40 mt-2 rounded-2xl border px-3 pt-3 will-change-[clip-path,transform]"
    >
      {children}
    </motion.div>
  );
}

// Pointer drag along y. onMove gets the distance from the press; onEnd the
// distance and the release velocity (px/ms, + = down). A press that barely
// moves is a tap.
function useVerticalDrag({
  onStart,
  onMove,
  onEnd,
  onTap,
}: {
  onStart?: () => void;
  onMove: (dy: number) => void;
  onEnd: (dy: number, velocity: number) => void;
  onTap: () => void;
}) {
  return (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    const startY = e.clientY;
    let moved = false;
    let last = { y: startY, t: performance.now() };
    let velocity = 0;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // no live pointer to capture (synthetic events): the window listeners still track it
    }
    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dy) < 4) return;
      if (!moved) onStart?.();
      moved = true;
      const t = performance.now();
      if (t > last.t) velocity = 0.7 * ((ev.clientY - last.y) / (t - last.t)) + 0.3 * velocity;
      last = { y: ev.clientY, t };
      onMove(dy);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (moved) onEnd(ev.clientY - startY, velocity);
      else onTap();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
}

function Chip({
  link,
  variant,
  onOpen,
  badge,
}: {
  link: StripLink;
  variant: 'fixed' | 'auto' | 'recent';
  onOpen: (link: StripLink) => void;
  badge?: string;
}) {
  return (
    <a
      href={link.url}
      onClick={() => onOpen(link)}
      data-chip={variant}
      title={link.url}
      className={`flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-[12.5px] font-medium whitespace-nowrap transition-all hover:-translate-y-px ${
        variant === 'fixed'
          ? 'chip-neon glass-inner bg-white/[0.09] text-white/95 hover:bg-white/15'
          : variant === 'auto'
            ? 'glass-inner text-white/80 hover:bg-white/10 hover:text-white'
            : 'rounded-full border border-white/10 bg-white/[0.03] font-medium text-white/65 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Favicon url={link.url} name={link.name} className="size-[18px] shrink-0" />
      {link.name}
      {badge && <span className="font-mono text-[10px] font-normal text-white/35">{badge}</span>}
    </a>
  );
}
