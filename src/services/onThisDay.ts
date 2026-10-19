import { netFetch } from '../lib/netFetch';

// "On this day" under the greeting: tech and computing history for today's
// date, from Wikipedia's free On this day feed (no key). Events come first,
// then births/deaths of computer scientists, programmers and inventors.
// One day's list is cached, so it's fetched once a day.

export interface DayEvent {
  year: number;
  text: string;
  kind: 'event' | 'born' | 'died';
  url?: string;
}

type WikiEntry = { year?: number; text?: string; pages?: Array<{ content_urls?: { desktop?: { page?: string } } }> };
type WikiFeed = Partial<Record<'selected' | 'events' | 'births' | 'deaths', WikiEntry[]>>;

const TECH_EVENT =
  /\b(computers?|computing|software|internet|world wide web|web ?sites?|e-?mail|programming|microprocessors?|transistors?|semiconductors?|integrated circuit|Apple Inc|Apple Computer|Macintosh|Microsoft|IBM|Intel|Google|Amazon\.com|Facebook|Twitter|YouTube|Netflix|Wikipedia|Linux|Unix|Windows \d|Windows (95|98|XP|Vista|NT)|iPhone|iPod|iPad|Android|smartphones?|video games?|Nintendo|Sega|PlayStation|Xbox|Atari|ARPANET|hackers?|cyber\w*|algorithms?|artificial intelligence|robots?|ENIAC|UNIVAC|satellites?|Sputnik|bitcoin|cryptocurrency|Netscape|Yahoo|eBay|calculators?|CD-ROM|Wi-?Fi|Bluetooth|GPS|open[- ]source|GitHub|OpenAI|ChatGPT|search engine|browser)\b/i;
const TECH_PERSON = /\b(computer (scientist|engineer|programmer|pioneer)|programmer|software (engineer|developer)|co-?founder of (Apple|Microsoft|Google|Intel|Facebook)|hacker|cryptographer)\b/i;
// Inventors and engineers count only when the line names something tech.
const MAKER = /\b(inventor|engineer)\b/i;
const isTechPerson = (t: string) => TECH_PERSON.test(t) || (MAKER.test(t) && TECH_EVENT.test(t));
const NOT_TECH = /\bYouTube (personality|star|collective|channel|group)|YouTuber|Sidemen\b/i;

const KEY = 'devdeck.onthisday.v1';
const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;

const urlOf = (e: WikiEntry) => e.pages?.[0]?.content_urls?.desktop?.page;

export function techEvents(feed: WikiFeed): DayEvent[] {
  const seen = new Set<string>();
  const out: DayEvent[] = [];
  const add = (e: WikiEntry, kind: DayEvent['kind']) => {
    if (!e.text || typeof e.year !== 'number' || NOT_TECH.test(e.text)) return;
    const k = `${e.year}:${e.text.slice(0, 40)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ year: e.year, text: e.text.trim(), kind, url: urlOf(e) });
  };
  for (const e of [...(feed.selected ?? []), ...(feed.events ?? [])]) if (e.text && TECH_EVENT.test(e.text)) add(e, 'event');
  for (const e of feed.births ?? []) if (e.text && isTechPerson(e.text)) add(e, 'born');
  for (const e of feed.deaths ?? []) if (e.text && isTechPerson(e.text)) add(e, 'died');
  return out;
}

export async function fetchOnThisDay(d: Date, fetcher: typeof fetch = netFetch): Promise<DayEvent[]> {
  const day = dayKey(d);
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { day: string; events: DayEvent[] } | null;
    if (cached?.day === day && Array.isArray(cached.events)) return cached.events;
  } catch {
    /* no cache */
  }
  const res = await fetcher(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${day}`);
  if (!res.ok) throw new Error(`On this day: HTTP ${res.status}`);
  const events = techEvents((await res.json()) as WikiFeed);
  try {
    localStorage.setItem(KEY, JSON.stringify({ day, events }));
  } catch {
    /* storage full or blocked */
  }
  return events;
}
