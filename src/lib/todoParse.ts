import type { Priority, Repeat } from '../types';
import { stepRepeat } from './todos';
import { localDateKey } from './time';

// Natural-language quick add for the to-do composer:
//   "Ship release notes #launch !p1 tomorrow 5pm"
//   → text "Ship release notes", tag launch, urgent, due tomorrow 17:00
// Understands priorities (!1 !2 !3, p1–p3, !urgent !high !normal !low),
// #tags (must start with a letter, so "PR #42" stays text), relative dates
// (today, tonight, tomorrow, weekdays, next week, this weekend, in 3 days,
// in 2h), explicit dates (2026-10-20, Oct 20, 20 Oct, 20/10) and times
// (5pm, 5:30 pm, 17:00, noon, eod). A time alone means its next occurrence.

export interface ParsedTodo {
  text: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  tags: string[];
  repeat: Repeat | null;
  matched: string[]; // the phrases that were understood, for the preview chips
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// Whole day / month words only, so "Monthly", "wedding", "Friend" or
// "Marketing" are never read as Monday, Wednesday, Friday or March.
const DAY_NAMES = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday|tues|thurs|sun|mon|tue|wed|thu|fri|sat';
const MONTH_NAMES =
  'january|february|march|april|june|july|august|september|october|november|december|sept|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
const pad = (n: number) => String(n).padStart(2, '0');
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const PRIORITY: Record<string, Priority> = {
  '1': 1, p1: 1, urgent: 1,
  '2': 2, p2: 2, high: 2,
  '3': 3, p3: 3, normal: 3, low: 3,
};

export function parseQuickAdd(input: string, now = new Date()): ParsedTodo {
  let rest = ` ${input} `;
  const matched: string[] = [];
  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(rest);
    if (!m) return null;
    matched.push(m[0].trim());
    rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length);
    return m;
  };

  // Priority
  let priority: Priority = 0;
  const pm = take(/\s(?:!(1|2|3|p[123]|urgent|high|normal|low)|(p[123]))(?=\s)/i);
  if (pm) priority = PRIORITY[(pm[1] ?? pm[2]).toLowerCase()] ?? 0;

  // Tags
  const tags: string[] = [];
  for (let m = take(/\s#([a-z][\w-]*)(?=\s)/i); m; m = take(/\s#([a-z][\w-]*)(?=\s)/i)) {
    const tag = m[1].toLowerCase();
    if (!tags.includes(tag)) tags.push(tag);
  }

  // Date
  let date: Date | null = null;
  let time: string | null = null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Repeats: "daily", "every week", "weekly", "every month", "every weekday",
  // "every monday" (weekly, starting next Monday), "every year".
  let repeat: Repeat | null = null;
  // An "every …" phrase wins over a bare word, and a bare word that opens the
  // text is part of the title ("Daily standup every weekday" → "Daily standup").
  const rp =
    take(new RegExp(`\\s(?:every\\s+(day|weekdays?|week|month|year|${DAY_NAMES}))(?=\\s)`, 'i')) ??
    take(/(?<=\S)\s(daily|weekdays|weekly|monthly|yearly|annually)(?=\s)/i);
  if (rp) {
    const w = rp[1].toLowerCase();
    if (w === 'day' || w === 'daily') repeat = 'daily';
    else if (w === 'weekday' || w === 'weekdays') repeat = 'weekdays';
    else if (w === 'week' || w === 'weekly') repeat = 'weekly';
    else if (w === 'month' || w === 'monthly') repeat = 'monthly';
    else if (w === 'year' || w === 'yearly' || w === 'annually') repeat = 'yearly';
    else {
      repeat = 'weekly';
      date = addDays(today, (DAYS.indexOf(w.slice(0, 3)) - today.getDay() + 7) % 7 || 7);
    }
  }

  const rel = take(/\sin\s+(\d+)\s*(m|mins?|minutes?|h|hrs?|hours?|d|days?|w|weeks?)(?=\s)/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase()[0];
    if (unit === 'm' || unit === 'h') {
      const at = new Date(now.getTime() + n * (unit === 'm' ? 60_000 : 3_600_000));
      date = new Date(at.getFullYear(), at.getMonth(), at.getDate());
      time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
    } else {
      date = addDays(today, unit === 'w' ? n * 7 : n);
    }
  }

  if (!date) {
    const word = take(/\s(today|tonight|tomorrow|tmrw?|next week|this weekend|weekend|next month)(?=\s)/i);
    if (word) {
      const w = word[1].toLowerCase();
      if (w === 'today') date = today;
      else if (w === 'tonight') {
        date = today;
        time = '21:00';
      } else if (w.startsWith('tom') || w.startsWith('tmr')) date = addDays(today, 1);
      else if (w === 'next week') date = addDays(today, ((8 - today.getDay()) % 7) || 7); // next Monday
      else if (w.includes('weekend')) date = addDays(today, (6 - today.getDay() + 7) % 7); // Saturday
      else date = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    }
  }

  if (!date) {
    const wd = take(new RegExp(`\\s(next\\s+)?(${DAY_NAMES})(?=\\s)`, 'i'));
    if (wd) {
      const target = DAYS.indexOf(wd[2].toLowerCase().slice(0, 3));
      let diff = (target - today.getDay() + 7) % 7 || 7;
      if (wd[1]) diff += diff < 7 ? 7 : 0;
      date = addDays(today, diff);
    }
  }

  if (!date) {
    const iso = take(/\s(\d{4})-(\d{2})-(\d{2})(?=\s)/);
    const md = iso ? null : take(new RegExp(`\\s(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, 'i'));
    const dm = iso || md ? null : take(new RegExp(`\\s(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAMES})\\.?(?=\\s)`, 'i'));
    const sl = iso || md || dm ? null : take(/\s(\d{1,2})\/(\d{1,2})(?=\s)/);
    const build = (month: number, day: number) => {
      let d = new Date(today.getFullYear(), month, day);
      if (d < today) d = new Date(today.getFullYear() + 1, month, day); // next occurrence
      return d;
    };
    if (iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    else if (md) date = build(MONTHS.indexOf(md[1].toLowerCase().slice(0, 3)), Number(md[2]));
    else if (dm) date = build(MONTHS.indexOf(dm[2].toLowerCase().slice(0, 3)), Number(dm[1]));
    else if (sl) date = build(Number(sl[2]) - 1, Number(sl[1])); // day/month
  }

  // Time
  if (!time) {
    const t12 = take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s)/i);
    const t24 = t12 ? null : take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/);
    const named = t12 || t24 ? null : take(/\s(noon|midnight|eod|end of day)(?=\s)/i);
    if (t12) {
      let h = Number(t12[1]) % 12;
      if (t12[3].toLowerCase() === 'pm') h += 12;
      time = `${pad(h)}:${t12[2] ?? '00'}`;
    } else if (t24) time = `${pad(Number(t24[1]))}:${t24[2]}`;
    else if (named) {
      const n = named[1].toLowerCase();
      time = n === 'noon' ? '12:00' : n === 'midnight' ? '23:59' : '18:00';
    }
    if (time && !date) {
      // A time alone: today if it is still ahead, otherwise tomorrow.
      const [h, m] = time.split(':').map(Number);
      date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m) > now ? today : addDays(today, 1);
    }
  }

  // A repeat with no start date starts today (or the next weekday), and
  // moves one step on when today's time has already passed.
  if (repeat && !date) {
    date = today;
    if (repeat === 'weekdays') while (date.getDay() === 0 || date.getDay() === 6) date = addDays(date, 1);
    if (time) {
      const [h, m] = time.split(':').map(Number);
      if (new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m) <= now) {
        const k = stepRepeat(localDateKey(date), repeat).split('-').map(Number);
        date = new Date(k[0], k[1] - 1, k[2]);
      }
    }
  }
  // Weekday repeats never start on a weekend, whichever rule set the date.
  if (repeat === 'weekdays' && date) while (date.getDay() === 0 || date.getDay() === 6) date = addDays(date, 1);

  const text = rest.replace(/\s+/g, ' ').trim();
  return {
    text: text || input.trim(),
    dueDate: date ? localDateKey(date) : null,
    dueTime: date ? time : null,
    priority,
    tags,
    repeat,
    matched,
  };
}
