import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUOTE_SLOT_MS, fetchQuote } from './quotes';

const api = (fail = false) =>
  vi.fn(async (url: string) => {
    if (fail) throw new Error('offline');
    const id = url.split('/').pop();
    return new Response(JSON.stringify({ id, quote: `Quote ${id}`, author: 'A' }), { status: 200 });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

describe('quotes', () => {
  beforeEach(() => localStorage.clear());

  it('keeps one API quote per half hour and fetches a new one in the next', async () => {
    const t0 = new Date(2026, 9, 21, 10, 5);
    const f = api();
    const a = await fetchQuote(t0, false, f);
    const same = await fetchQuote(new Date(t0.getTime() + 20 * 60_000), false, f); // 10:25, same slot
    const next = await fetchQuote(new Date(t0.getTime() + QUOTE_SLOT_MS), false, f); // 10:35, next slot
    expect(a.text).toMatch(/^Quote \d+$/);
    expect(same).toEqual(a);
    expect(next.text).not.toBe(a.text);
    expect(f).toHaveBeenCalledTimes(2); // the cached half hour didn't refetch
  });

  it('falls back to the bundled quotes offline', async () => {
    const q = await fetchQuote(new Date(2026, 9, 21, 10, 5), false, api(true));
    expect(q.text).not.toMatch(/^Quote \d+$/);
    expect(q.text.length).toBeGreaterThan(5);
  });
});
