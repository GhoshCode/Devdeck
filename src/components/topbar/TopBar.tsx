import type { ReactNode } from 'react';
import { TimeWidget } from './TimeWidget';

// Zone 1 (plan §1): GREETING, then [TIME | A/B] over C, TO DO, GIT COMMITS.
// Slots for widgets built separately are passed in so this stays layout-only.
// <640px: one column · 640–767px: two · 768–1023px: the greeting spans a row
// of its own above the other three · ≥1024px: one row of four, greeting first.
interface TopBarProps {
  greeting: ReactNode;
  weather: ReactNode;
  command: ReactNode;
  todo: ReactNode;
  git: ReactNode;
}

export function TopBar({ greeting, weather, command, todo, git }: TopBarProps) {
  return (
    <div
      data-topbar-grid
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[minmax(360px,400px)_minmax(0,1.15fr)_minmax(0,0.85fr)] md:grid-rows-[auto_168px] lg:h-[168px] lg:grid-cols-[minmax(290px,340px)_minmax(360px,400px)_minmax(0,1.1fr)_minmax(0,0.8fr)] lg:grid-rows-[168px]"
    >
      <div data-widget="greeting" className="min-h-[150px] min-w-0 sm:col-span-2 md:col-span-3 md:min-h-[96px] lg:col-span-1 lg:min-h-0">
        {greeting}
      </div>
      <div data-widget="time-cluster" className="flex min-w-0 flex-col gap-2">
        {/* Clock + weather share one glass card (click the clock to change its face). */}
        <div data-widget-card="clock-weather" className="glass flex min-h-[96px] flex-1 items-stretch overflow-hidden p-0">
          <TimeWidget />
          {weather}
        </div>
        {command}
      </div>
      <div data-widget="todo" className="relative min-h-[168px] min-w-0 md:min-h-0">
        {todo}
      </div>
      <div data-widget="git" className="min-h-[168px] min-w-0 sm:col-span-2 md:col-span-1 md:min-h-0">
        {git}
      </div>
    </div>
  );
}
