import { isExtension } from './env';

// Network requests for feeds, GitHub, weather, search suggestions and the
// offline probe.
//
// In the extension, the service worker makes the request and hands back the
// result, so a refused request (403 / 404 / 429 / 5xx) is never logged as an
// error in DevDeck's own console — the caller still sees the status.
//
// Fail-safe: if the worker can't be reached (e.g. the extension was just
// reloaded or updated while this tab stayed open — "Receiving end does not
// exist"), or doesn't answer within a few seconds, the page fetches directly,
// and keeps doing so for a minute. A missing worker must never look like
// "you're offline". On the website build this is plain fetch.

type ProxyReply = { status: number; statusText?: string; headers?: Array<[string, string]>; body?: string; error?: string };
type Runtime = { id?: string; sendMessage?: (m: unknown) => Promise<unknown> };
const runtime = () => (globalThis as { chrome?: { runtime?: Runtime } }).chrome?.runtime;

const PROXY_TIMEOUT_MS = 8000;
const BYPASS_MS = 60_000;
let bypassUntil = 0;

export const proxyAvailable = () => isExtension() && !!runtime()?.sendMessage && Date.now() >= bypassUntil;
export function markProxyDown() {
  bypassUntil = Date.now() + BYPASS_MS;
}

function headersOf(h: HeadersInit | undefined): Record<string, string> {
  if (!h) return {};
  if (h instanceof Headers) return Object.fromEntries(h.entries());
  if (Array.isArray(h)) return Object.fromEntries(h);
  return { ...(h as Record<string, string>) };
}

export const netFetch: typeof fetch = async (input, init) => {
  const rt = runtime();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!proxyAvailable() || !rt?.sendMessage || !/^https?:/i.test(url) || (init?.body !== undefined && init?.body !== null && typeof init.body !== 'string')) {
    return fetch(input, init);
  }
  const signal = init?.signal;
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  let reply: ProxyReply | undefined;
  try {
    const request = rt.sendMessage({ type: 'devdeck:fetch', url, init: { method: init?.method ?? 'GET', headers: headersOf(init?.headers), body: init?.body ?? undefined } }) as Promise<ProxyReply | undefined>;
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), PROXY_TIMEOUT_MS));
    const aborted = new Promise<never>((_, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    const r = await Promise.race([request, timeout, aborted]);
    if (r === 'timeout') throw new Error('proxy timeout');
    reply = r;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    // The worker isn't there (or didn't answer): go direct for a while.
    markProxyDown();
    return fetch(input, init);
  }
  if (!reply) {
    markProxyDown();
    return fetch(input, init);
  }
  if (reply.error) throw new TypeError(reply.error); // a real network failure, seen by the worker
  const status = reply.status >= 200 && reply.status <= 599 ? reply.status : 500;
  return new Response([101, 204, 205, 304].includes(status) ? null : (reply.body ?? ''), {
    status,
    statusText: reply.statusText ?? '',
    headers: reply.headers ?? [],
  });
};
