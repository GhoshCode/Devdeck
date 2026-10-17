import type { ReactNode } from 'react';
import { TimeWidget } from './TimeWidget';
import { DateGreet } from './DateGreet';

// Zone 1 (plan §1): [TIME | A/B], TO DO, GIT COMMITS over C (command prompt),
// then DATE/GREET. Slots for widgets built separately are passed in so this
// stays layout-only. <640px: one column · 640–767px: two · 768–1023px: one
// row of three (no date/greet) · ≥1024px: the full four-column bar.
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
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:h-[168px] md:grid-cols-[minmax(340px,380px)_minmax(0,0.8fr)_minmax(0,1.2fr)] lg:grid-cols-[minmax(380px,420px)_minmax(0,0.75fr)_minmax(0,1.25fr)_minmax(220px,auto)]"
    >
      {/* Clock + weather share one glass card (click the clock to change its face). */}
      <div data-widget="time-cluster" className="flex min-h-[132px] min-w-0">
        <div data-widget-card="clock-weather" className="glass flex min-w-0 flex-1 items-stretch overflow-hidden p-0">
          <TimeWidget />
          {weather}
        </div>
      </div>
      <div data-widget="todo" className="relative min-h-[168px] min-w-0 md:min-h-0">
        {todo}
      </div>
      <div data-widget="git" className="flex min-h-[168px] min-w-0 flex-col gap-2 sm:col-span-2 md:col-span-1 md:min-h-0">
        <div className="min-h-0 flex-1">{git}</div>
        {command}
      </div>
      {/* Below 1024px the date/greeting gives way to the widgets; the clock still shows the time. */}
      <div data-widget="date-greet" className="hidden min-w-0 lg:block">
        <DateGreet />
      </div>
    </div>
  );
}
