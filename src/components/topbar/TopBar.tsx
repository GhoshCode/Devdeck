import type { ReactNode } from 'react';
import { useLayout } from '../layout/DashboardLayout';
import { TimeWidget } from './TimeWidget';
import { DateGreet } from './DateGreet';

// Zone 1 (plan §1), three columns:
//   left   — TIME over the date, A/B (weather + UV) and the location
//   middle — greeting + daily quote over search, Site Map and Bookmarks
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
  // Wide screens: the terminal sits above the news column (level with the
  // quick-links bar) and the Git box takes the full height here.
  const { rightInline } = useLayout();
  return (
    <div
      data-topbar-grid
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:h-[236px] md:grid-cols-[minmax(320px,1fr)_minmax(0,1.15fr)_minmax(320px,1fr)] lg:grid-cols-[minmax(340px,505px)_minmax(460px,1fr)_minmax(340px,505px)]"
    >
      {/* Left: clock, then the date with weather + UV on its line, and the place under it (click the clock to change its face). */}
      <div data-widget="time-cluster" className="flex min-w-0 flex-col items-start gap-1.5 px-3 pt-1 sm:col-span-2 md:col-span-1">
        <div data-widget-card="clock-weather" className="flex h-[132px] w-[380px] max-w-full min-w-0 shrink-0 overflow-hidden">
          <TimeWidget />
        </div>
        {weather}
      </div>
      {/* Left and right columns are equal width, so this column — the greeting at the top and the search at the bottom — sits in the exact middle of the screen, just above the cockpit. */}
      <div data-widget="search" className="relative z-20 flex min-w-0 flex-col justify-between gap-3 pt-7 pb-5 sm:col-span-2 md:col-span-1">
        <div data-widget="date-greet" className="mx-auto w-full max-w-[940px] min-w-0 px-1 md:pr-14">
          <DateGreet />
        </div>
        {search}
      </div>
      <div data-widget="git" className="relative z-10 flex min-h-[224px] min-w-0 flex-col gap-2 sm:col-span-2 md:col-span-1 md:min-h-0">
        <div className="relative z-10 min-h-0 flex-1">{git}</div>
        {!rightInline && command}
      </div>
    </div>
  );
}
