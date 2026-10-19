import { useStore } from '../store';
import { Favicon } from './Favicon';
import { UNCATEGORIZED_COLOR, UNCATEGORIZED_NAME } from '../lib/categories';
import type { Site } from '../types';

// Sites with no category sit loose in the row, right after the last category
// card — no card around them, just a quiet label and their tiles.
export function UncategorizedTiles({ sites }: { sites: Site[] }) {
  const recordVisit = useStore((s) => s.recordVisit);
  return (
    <section aria-label={UNCATEGORIZED_NAME} data-uncategorized className="flex h-full min-h-0 flex-col gap-2 px-1 pt-1">
      <h3 className="flex items-center gap-2 font-display text-[11px] font-semibold tracking-[0.18em] text-white/45 uppercase">
        <span className="size-1.5 rounded-full" style={{ background: UNCATEGORIZED_COLOR }} />
        {UNCATEGORIZED_NAME}
        <span className="font-mono tracking-normal text-white/30">{sites.length}</span>
      </h3>
      <div className="scrollbar-none grid min-h-0 grid-cols-[repeat(auto-fill,minmax(76px,1fr))] content-start gap-2 overflow-y-auto">
        {sites.map((site) => (
          <a
            key={site.id}
            href={site.url}
            onClick={() => recordVisit(site.id)}
            title={site.name}
            className="glass-inner group/tile flex aspect-square flex-col items-center justify-center gap-1 p-1.5 text-center transition-all duration-200 hover:scale-105 hover:border-white/20 hover:bg-[var(--color-glass-strong)] focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
          >
            <Favicon url={site.url} name={site.name} categoryColor={UNCATEGORIZED_COLOR} className="size-7" />
            <span className="w-full truncate text-[12px] font-medium text-white/80 group-hover/tile:text-white">{site.name}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
