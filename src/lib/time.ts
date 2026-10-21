// Pure time helpers shared by the TIME widget, greeting card and the to-do list.

const pad = (n: number) => String(n).padStart(2, '0');

export interface ClockParts {
  hours: string; // '09' / '21'
  minutes: string;
  seconds: string;
  meridiem: 'AM' | 'PM' | null; // null in 24h mode
}

export function clockParts(d: Date, h24: boolean): ClockParts {
  const h = d.getHours();
  const hours = h24 ? h : h % 12 || 12;
  return {
    hours: pad(hours),
    minutes: pad(d.getMinutes()),
    seconds: pad(d.getSeconds()),
    meridiem: h24 ? null : h >= 12 ? 'PM' : 'AM',
  };
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export const formatDateLine = (d: Date): string => dateFormatter.format(d).toUpperCase();

// Local 'YYYY-MM-DD' (not UTC — toISOString would shift the day near midnight).
export const localDateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// §7 Q5: a clean time-of-day greeting, uppercase, optionally with the name.
export function greetingFor(d: Date, name = ''): string {
  const h = d.getHours();
  const base =
    h >= 5 && h < 12
      ? 'GOOD MORNING'
      : h >= 12 && h < 17
        ? 'GOOD AFTERNOON'
        : h >= 17 && h < 22
          ? 'GOOD EVENING'
          : 'GOOD NIGHT';
  const trimmed = name.trim();
  return trimmed ? `${base}, ${trimmed.toUpperCase()}` : base;
}
