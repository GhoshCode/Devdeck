import { isExtension } from './env';

// Network requests for feeds, GitHub, weather and search suggestions.
//
// In the extension, the service worker makes the request and hands back the
// result. A refused or failing request (an API that answers 403 / 404 / 429 /
// 5xx) is then never logged as an error in DevDeck's own console — the caller
// still sees the status and shows it (e.g. in the feed's tooltip). The worker
// also has the extension's host permissions, so there are no CORS surprises.
// On the website build this is plain fetch.

type ProxyReply = { status: number; statusText?: string; headers?: Array<[string, string]>; body?: string; error?: string };
type Runtime = { id?: string; sendMessage?: (m: unknown) => Promise<unknown> };
const runtime = () => (globalThis as { chrome?: { runtime?: Runtime } }).chrome?.runtime;

function headersOf(h: HeadersInit | undefined): Record<string, string> {
  if (!h) return {};
  if (h instanceof Headers) return Object.fromEntries(h.entries());
  if (Array.isArray(h)) return Object.fromEntries(h);
  return { ...(h as Record<string, string>) };
}

export const netFetch: typeof fetch = async (input, init) => {
  const rt = runtime();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!isExtension() || !rt?.sendMessage || !/^https?:/i.test(url) || (init?.body !== undefined && init?.body !== null && typeof init.body !== 'string')) {
    return fetch(input, init);
  }
  const signal = init?.signal;
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const request = rt
    .sendMessage({ type: 'devdeck:fetch', url, init: { method: init?.method ?? 'GET', headers: headersOf(init?.headers), body: init?.body ?? undefined } })
    .then((r) => r as ProxyReply | undefined);
  const aborted = new Promise<never>((_, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  const reply = await (signal ? Promise.race([request, aborted]) : request);
  if (!reply || reply.error) throw new TypeError(reply?.error ?? 'Network request failed');
  const status = reply.status >= 200 && reply.status <= 599 ? reply.status : 500;
  return new Response([101, 204, 205, 304].includes(status) ? null : (reply.body ?? ''), {
    status,
    statusText: reply.statusText ?? '',
    headers: reply.headers ?? [],
  });
};
