import { netFetch } from '../lib/netFetch';
import { quoteFor, type Quote } from '../lib/greeting';

// Quotes come from DummyJSON's free quotes API (1,454 quotes, no key).
// Today's quote is kept for the day so it doesn't change on every new tab;
// ↻ fetches a random one. Offline, the small built-in list fills in.

const KEY = 'devdeck.quote.v1';
const API = 'https://dummyjson.com/quotes';
const dayOf = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

type ApiQuote = { id?: number; quote?: string; author?: string };

async function get(url: string, fetcher: typeof fetch): Promise<Quote> {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`Quotes: HTTP ${res.status}`);
  const q = (await res.json()) as ApiQuote;
  if (!q.quote) throw new Error('Quotes: empty');
  return { text: q.quote.trim(), author: q.author?.trim() || 'Unknown' };
}

export function cachedQuote(d: Date): Quote | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { day: string; quote: Quote } | null;
    return c?.day === dayOf(d) ? c.quote : null;
  } catch {
    return null;
  }
}

// Today's quote: the same id all day (picked from the date), or a random one
// when `fresh` (the ↻ button). Falls back to the built-in list.
export async function fetchQuote(d: Date, fresh = false, fetcher: typeof fetch = netFetch): Promise<Quote> {
  if (!fresh) {
    const c = cachedQuote(d);
    if (c) return c;
  }
  try {
    const dayId = (Math.floor(d.getTime() / 86_400_000) % 1454) + 1;
    const quote = await get(fresh ? `${API}/random` : `${API}/${dayId}`, fetcher);
    try {
      localStorage.setItem(KEY, JSON.stringify({ day: dayOf(d), quote }));
    } catch {
      /* storage blocked */
    }
    return quote;
  } catch {
    return quoteFor(d, fresh ? Math.floor(Math.random() * 1000) : 0);
  }
}
