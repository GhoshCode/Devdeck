import { netFetch } from '../lib/netFetch';
import { quoteFor, type Quote } from '../lib/greeting';

// Quotes come from DummyJSON's free quotes API (1,454 quotes, no key) while
// online: a new one every 30 minutes (kept for that half hour so new tabs
// agree); ↻ fetches a random one. Offline, the built-in list fills in.

const KEY = 'devdeck.quote.v1';
const API = 'https://dummyjson.com/quotes';
export const QUOTE_SLOT_MS = 30 * 60_000;
const slotOf = (d: Date) => String(Math.floor(d.getTime() / QUOTE_SLOT_MS));

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
    return c?.day === slotOf(d) ? c.quote : null;
  } catch {
    return null;
  }
}

// This half hour's quote: the same id for 30 minutes (picked from the time), or a random one
// when `fresh` (the ↻ button). Falls back to the built-in list.
export async function fetchQuote(d: Date, fresh = false, fetcher: typeof fetch = netFetch): Promise<Quote> {
  if (!fresh) {
    const c = cachedQuote(d);
    if (c) return c;
  }
  try {
    const slotId = (Math.floor(d.getTime() / QUOTE_SLOT_MS) % 1454) + 1;
    const quote = await get(fresh ? `${API}/random` : `${API}/${slotId}`, fetcher);
    try {
      localStorage.setItem(KEY, JSON.stringify({ day: slotOf(d), quote }));
    } catch {
      /* storage blocked */
    }
    return quote;
  } catch {
    return quoteFor(d, fresh ? Math.floor(Math.random() * 1000) : 0);
  }
}
