import { memo, type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Site } from '../types';
import { useStore } from '../store';
import { Favicon } from './Favicon';
import { getHostname } from '../utils';

interface SiteRowProps {
  site: Site;
  categoryColor: string;
  isOverlay?: boolean;
}

export const SiteRow = memo(function SiteRow({
  site,
  categoryColor,
  isOverlay = false,
}: SiteRowProps) {
  const recordVisit = useStore((s) => s.recordVisit);
  const togglePrimary = useStore((s) => s.togglePrimary);

  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: site.id,
    data: { type: 'site', site },
    disabled: isOverlay,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const hostname = getHostname(site.url);

  const handleClick = () => {
    recordVisit(site.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-site-id={site.id}
      className={`group/site flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left @min-[240px]:gap-3 @min-[240px]:px-3 transition-colors duration-150 ${
        isOverlay
          ? 'glass-inner bg-white/10 shadow-2xl border-white/20'
          : 'hover:bg-white/[0.07] hover:border-white/10'
      }`}
    >
      <a
        href={site.url}
        onClick={handleClick}
        className="flex min-w-0 flex-1 items-center gap-2 focus-visible:outline-none @min-[240px]:gap-3"
      >
        <Favicon
          url={site.url}
          name={site.name}
          categoryColor={categoryColor}
          className="size-6 shrink-0"
        />
        <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
          <span
            title={site.name}
            className="truncate text-[12.5px] font-medium text-white/85 group-hover/site:text-white min-w-0 @min-[240px]:shrink-0 @min-[240px]:max-w-[65%]"
          >
            {site.name}
          </span>
          <span
            title={site.url}
            className="hidden truncate text-[10px] text-white/35 group-hover/site:text-white/60 min-w-0 flex-1 @min-[240px]:block"
          >
            {hostname}
          </span>
        </div>
      </a>

      {/* Pin: puts the site in the card's top row (it stays here too, marked pinned). */}
      <button
        type="button"
        onClick={() => togglePrimary(site.id)}
        aria-pressed={site.primary}
        aria-label={site.primary ? `Remove ${site.name} from the top row` : `Add ${site.name} to the top row`}
        title={site.primary ? 'Pinned to the top row — click to unpin' : 'Pin to the top row'}
        className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-[opacity,color,background-color] duration-150 hover:bg-white/10 ${
          site.primary
            ? 'site-pinned opacity-100'
            : 'text-white/40 opacity-0 group-hover/site:opacity-100 focus-visible:opacity-100 hover:text-white'
        }`}
      >
        <PinIcon filled={site.primary} />
      </button>
    </div>
  );
});

// Outline pin = not in the top row; filled pin = pinned there.
// A minimal outline thumbtack, tilted like a pin pressed into a board.
// "filled" (pinned) adds a soft tint inside the outline rather than a solid blob.
export function PinIcon({ filled, className = 'size-3.5' }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g transform="rotate(45 12 12)">
        <path
          d="M9 4h6M10 4v5.2c0 .6-.3 1.2-.8 1.5l-1.9 1.4A2.2 2.2 0 0 0 6.4 14v1h11.2v-1a2.2 2.2 0 0 0-.9-1.9l-1.9-1.4a1.9 1.9 0 0 1-.8-1.5V4"
          fill={filled ? 'currentColor' : 'none'}
          fillOpacity={filled ? 0.25 : 0}
        />
        <path d="M12 15v5.5" />
      </g>
    </svg>
  );
}
