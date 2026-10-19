import { memo, useMemo, useRef, type WheelEvent } from 'react';
import { useStore } from '../../store';
import { useNow } from '../../hooks/useNow';
import { buildStrip, relativeAge, type StripLink } from '../../services/search';
import { Favicon } from '../Favicon';

// Header strip of the centre frame (Zone 4, §7 Q7/Q8):
//   [E][E][E][E] fixed │ more E (auto-picked) … │ F recent … →
// The first four quick links never move; everything after them shares one
// horizontal scroller with a fade mask on the right edge.

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

  // Vertical wheel scrolls the strip sideways.
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    el.scrollLeft += e.deltaY;
  };

  const open = (link: StripLink) => link.siteId && recordVisit(link.siteId);

  return (
    <div data-testid="links-strip" className="links-bar glass-raised flex h-[var(--links-bar-h,56px)] min-w-0 shrink-0 items-center gap-2 overflow-hidden rounded-2xl border border-white/10 px-3">
      <div data-strip="fixed" className="scrollbar-none flex min-w-0 shrink items-center gap-2 overflow-x-auto">
        {strip.fixed.map((link) => (
          <Chip key={link.id} link={link} variant="fixed" onOpen={open} />
        ))}
      </div>

      {(strip.scrolling.length > 0 || strip.recent.length > 0) && (
        <div
          ref={scrollerRef}
          onWheel={onWheel}
          data-strip="scroll"
          className="scrollbar-none flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-40px),transparent)] pl-1"
        >
          {strip.scrolling.map((link) => (
            <Chip key={link.id} link={link} variant="auto" onOpen={open} />
          ))}
          {strip.recent.length > 0 && (
            <>
              <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-gradient-to-b from-transparent via-white/30 to-transparent" />
              <span className="shrink-0 font-mono text-[9px] font-bold tracking-[0.2em] text-white/35">RECENT</span>
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
    </div>
  );
});

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
          ? 'glass-inner border-white/15 bg-white/[0.09] text-white/95 hover:bg-white/15'
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
