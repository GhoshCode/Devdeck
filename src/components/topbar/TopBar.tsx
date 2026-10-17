import type { ReactNode } from 'react';
import { TimeWidget } from './TimeWidget';
import { DateGreet } from './DateGreet';

// Zone 1 (plan §1), three columns:
//   left   — TIME | A/B (no card) over DATE/GREET with the daily quote
//   middle — search, Site Map and Bookmarks on one line
//   right  — GIT COMMITS over C (command prompt), pinned to the top-right corner
// The to-do lives in the left column's Queue / To-do card.
// Slots for widgets built separately are passed in so this stays layout-only.
// <640px: one column · 640–767px: two · ≥768px: the three columns.
interface TopBarProps {
  weather: ReactNode;
  search: ReactNode;
  git: ReactNode;
  command: ReactNode;
}

export function TopBar({ weather, search, git, command }: TopBarProps) {
  return (
    <div
      data-topbar-grid
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:h-[208px] md:grid-cols-[minmax(320px,1fr)_minmax(0,1.15fr)_minmax(320px,1fr)] lg:grid-cols-[minmax(400px,480px)_minmax(0,1fr)_minmax(400px,480px)]"
    >
      <div data-widget="time-cluster" className="flex min-w-0 flex-col gap-1 sm:col-span-2 md:col-span-1">
        {/* Clock and weather sit bare, side by side, with some breathing room (click the clock to change its face). */}
        <div data-widget-card="clock-weather" className="flex min-h-[110px] min-w-0 flex-1 items-stretch overflow-hidden px-2 pt-1 pb-1">
          <TimeWidget />
          {weather}
        </div>
        <div data-widget="date-greet" className="min-w-0 shrink-0 px-3">
          <DateGreet />
        </div>
      </div>
      {/* Left and right columns are equal width, so this column — and the search in it — sits in the exact middle of the screen, just above the cockpit. */}
      <div data-widget="search" className="relative z-20 flex min-w-0 flex-col justify-end gap-3 pb-1 sm:col-span-2 md:col-span-1">
        {search}
      </div>
      <div data-widget="git" className="relative z-10 flex min-h-[224px] min-w-0 flex-col gap-2 sm:col-span-2 md:col-span-1 md:min-h-0">
        <div className="relative z-10 min-h-0 flex-1">{git}</div>
        {command}
      </div>
    </div>
  );
}
