import type { ReactNode } from 'react';
import { TimeWidget } from './TimeWidget';
import { DateGreet } from './DateGreet';

// Zone 1 (plan §1), three columns:
//   left   — DATE/GREET (with the daily quote) over [TIME | A/B]
//   middle — TO DO
//   right  — GIT COMMITS over C (command prompt), pinned to the top-right corner
// Slots for widgets built separately are passed in so this stays layout-only.
// <640px: one column · 640–767px: two · ≥768px: the three columns.
interface TopBarProps {
  weather: ReactNode;
  command: ReactNode;
  todo: ReactNode;
  git: ReactNode;
}

export function TopBar({ weather, command, todo, git }: TopBarProps) {
  return (
    <div
      data-topbar-grid
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:h-[224px] md:grid-cols-[minmax(340px,1fr)_minmax(0,0.9fr)_minmax(340px,1fr)] lg:grid-cols-[minmax(400px,500px)_minmax(0,1fr)_minmax(400px,440px)]"
    >
      <div data-widget="time-cluster" className="flex min-w-0 flex-col gap-2 sm:col-span-2 md:col-span-1">
        <div data-widget="date-greet" className="min-w-0 shrink-0 px-1">
          <DateGreet />
        </div>
        {/* Clock + weather share one glass card (click the clock to change its face). */}
        <div data-widget-card="clock-weather" className="glass flex min-h-[96px] min-w-0 flex-1 items-stretch overflow-hidden p-0">
          <TimeWidget />
          {weather}
        </div>
      </div>
      <div data-widget="todo" className="relative min-h-[224px] min-w-0 md:min-h-0">
        {todo}
      </div>
      <div data-widget="git" className="flex min-h-[224px] min-w-0 flex-col gap-2 md:min-h-0">
        <div className="relative z-10 min-h-0 flex-1">{git}</div>
        {command}
      </div>
    </div>
  );
}
