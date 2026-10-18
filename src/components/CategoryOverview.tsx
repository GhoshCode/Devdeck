import { memo, useEffect, useMemo, type MouseEvent } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store';
import { orderWithPin } from '../lib/categories';
import { Favicon } from './Favicon';
import { getCategoryDisplayColor } from '../utils';

// Category overview: every category in one grid, opened from the menu button
// at the left of the quick-links row. It fills the cards area and adapts to
// how wide that area is (it follows the snap-resize of the side columns):
//   wide (3 cards)  — name, site count and the pinned sites with icons & names
//   medium (2)      — name, count and a row of pinned-site icons
//   narrow (1)      — compact name + count boxes
// Clicking a category jumps the cards row to it.

// Four solid blocks in a staggered grid (tall / short over short / tall),
// filled with the theme accent.
export function CategoryMenuIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="var(--color-accent)" aria-hidden>
      <rect x="2" y="2" width="7.2" height="9.6" rx="2.2" />
      <rect x="10.8" y="2" width="7.2" height="5.4" rx="2" />
      <rect x="2" y="12.8" width="7.2" height="5.2" rx="2" />
      <rect x="10.8" y="8.6" width="7.2" height="9.4" rx="2.2" />
    </svg>
  );
}

// Scroll the category row so this card leads, and flash it briefly.
export function revealCategory(id: string) {
  const card = document.querySelector<HTMLElement>(`[data-category-id="${CSS.escape(id)}"]`);
  const track = card?.closest<HTMLElement>('[data-cards-track]');
  if (!card || !track) return;
  const wrapper = (card.parentElement && card.parentElement !== track ? card.parentElement : card) as HTMLElement;
  // Go to the page that holds the card (rows move a page at a time).
  const cards = Array.from(track.children).filter((c) => !(c as HTMLElement).dataset.pagerSpacer) as HTMLElement[];
  const per = Math.max(1, Number(track.dataset.perPage) || 1);
  const lead = cards[Math.floor(Math.max(0, cards.indexOf(wrapper)) / per) * per] ?? wrapper;
  track.scrollTo({ left: Math.max(0, lead.offsetLeft - (cards[0]?.offsetLeft ?? 0)), behavior: 'smooth' });
  card.classList.remove('card-flash');
  void card.offsetWidth; // restart the animation
  card.classList.add('card-flash');
  setTimeout(() => card.classList.remove('card-flash'), 1400);
}

export const CategoryOverview = memo(function CategoryOverview({ onClose }: { onClose: () => void }) {
  const categories = useStore((s) => s.categories);
  const subcategories = useStore((s) => s.subcategories);
  const sites = useStore((s) => s.sites);
  const pinnedId = useStore((s) => s.pinnedCategoryId);
  const recordVisit = useStore((s) => s.recordVisit);
  const theme = useStore((s) => s.settings.themeMode);
  const light = theme === 'light' || (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light');

  const rows = useMemo(
    () =>
      orderWithPin(categories, pinnedId).map((c) => {
        const own = sites.filter((s) => s.categoryId === c.id).sort((a, b) => a.order - b.order);
        const pinned = own.filter((s) => s.primary);
        return {
          category: c,
          count: own.length,
          subs: subcategories.filter((s) => s.categoryId === c.id).length,
          // Pinned sites first; a category with none shows its first few.
          sites: (pinned.length ? pinned : own).slice(0, 8),
          pinned: pinned.length > 0,
        };
      }),
    [categories, subcategories, sites, pinnedId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The cards view mounts again after closing, so reveal once it has laid out.
  const jump = (id: string) => {
    onClose();
    setTimeout(() => revealCategory(id), 420);
  };
  const openSite = (e: MouseEvent, siteId: string) => {
    e.stopPropagation();
    recordVisit(siteId);
  };

  return (
    <motion.section
      aria-label="Category overview"
      id="category-overview"
      data-testid="category-overview"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.16 }}
      className="category-overview @container flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border"
    >
      {/* The top bar takes you back to the category cards. */}
      <header
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClose())}
        aria-label="Back to category cards"
        title="Back to category cards"
        className="overview-bar flex shrink-0 cursor-pointer items-center gap-2 border-b border-white/[0.07] px-4 py-2"
      >
        <CategoryMenuIcon className="size-4 text-white/70" />
        <h2 className="font-display text-[12px] font-bold tracking-[0.16em] text-white/80 uppercase">All categories</h2>
        <span className="rounded-full bg-white/[0.08] px-2 font-mono text-[10px] text-white/55">{rows.length}</span>
        <span className="ml-auto hidden font-mono text-[10px] text-white/35 @min-[520px]:inline">click a category to jump · click this bar or Esc for the cards</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close category overview"
          className="flex size-7 items-center justify-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </header>
      <div className="ultra-thin-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 @min-[640px]:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] @min-[1080px]:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] @min-[1080px]:gap-3">
          {rows.map(({ category: c, count, subs, sites: shown, pinned }, i) => {
            const color = getCategoryDisplayColor(c.color, light);
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.18 }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => jump(c.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), jump(c.id))}
                  aria-label={`${c.name}, ${count} sites — jump to card`}
                  style={{ ['--cat' as string]: color }}
                  className="overview-tile group/tile flex h-full cursor-pointer flex-col gap-2 rounded-xl border p-2.5 transition-colors @min-[640px]:p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                    <span className="min-w-0 flex-1 truncate font-display text-[12px] font-bold tracking-[0.1em] uppercase" style={{ color }}>
                      {c.name}
                    </span>
                    {c.id === pinnedId && (
                      <span title="Pinned category" className="text-[10px] text-white/45">
                        📌
                      </span>
                    )}
                    <span className="shrink-0 rounded-full bg-white/[0.08] px-1.5 font-mono text-[10px] text-white/60">{count}</span>
                  </div>
                  {/* Medium: icons only. Wide: icon + name list. */}
                  {shown.length > 0 && (
                    <>
                      <div className="hidden flex-wrap gap-1 @min-[640px]:flex @min-[1080px]:hidden">
                        {shown.map((s) => (
                          <a key={s.id} href={s.url} title={s.name} onClick={(e) => openSite(e, s.id)} className="overview-site rounded-md p-1">
                            <Favicon url={s.url} name={s.name} categoryColor={c.color} className="size-4" />
                          </a>
                        ))}
                      </div>
                      <ul className="hidden grid-cols-2 gap-x-2 gap-y-0.5 @min-[1080px]:grid">
                        {shown.map((s) => (
                          <li key={s.id} className="min-w-0">
                            <a
                              href={s.url}
                              title={s.url}
                              onClick={(e) => openSite(e, s.id)}
                              className="overview-site flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-white/70 hover:text-white"
                            >
                              <Favicon url={s.url} name={s.name} categoryColor={c.color} className="size-3.5 shrink-0" />
                              <span className="truncate">{s.name}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <span className="mt-auto hidden font-mono text-[9.5px] text-white/35 @min-[640px]:block">
                    {pinned ? 'pinned sites' : 'first sites'} · {subs} subcategor{subs === 1 ? 'y' : 'ies'}
                  </span>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </motion.section>
  );
});
