import { useSyncExternalStore } from 'react';
import { isExtension } from './env';

// Site icons for the extension, without a single failed request in the page:
// the service worker fetches each icon once and hands back a data: URL, which
// is cached in localStorage so later tabs paint it instantly. (A site with no
// icon — or a flaky answer from the icon service — just keeps its letter tile;
// it's asked again after a few days.) The website build loads icons directly.

const CACHE_KEY = 'devdeck.favicons.v1';
const MISS_KEY = 'devdeck.favicons.miss.v1';
const MAX = 800;
const RETRY_MS = 3 * 24 * 3600_000;

type Entry = string; // data URL
let cache: Record<string, Entry> = {};
let misses: Record<string, number> = {};
try {
  cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  misses = JSON.parse(localStorage.getItem(MISS_KEY) ?? '{}');
} catch {
  // storage unavailable: icons are fetched per session
}

const listeners = new Map<string, Set<() => void>>();
const inFlight = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const keys = Object.keys(cache);
      if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) delete cache[k];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      localStorage.setItem(MISS_KEY, JSON.stringify(misses));
    } catch {
      // quota: keep them in memory for this tab
    }
  }, 400);
}

type Runtime = { id?: string; sendMessage?: (m: unknown) => Promise<unknown> };
const runtime = () => (globalThis as { chrome?: { runtime?: Runtime } }).chrome?.runtime;

function request(host: string) {
  if (inFlight.has(host)) return;
  const miss = misses[host];
  if (miss && Date.now() - miss < RETRY_MS) return;
  const rt = runtime();
  if (!rt?.sendMessage) return;
  inFlight.add(host);
  rt.sendMessage({ type: 'devdeck:favicon', host })
    .then((res) => {
      const r = res as { ok?: boolean; data?: string } | undefined;
      if (r?.ok && r.data) {
        cache[host] = r.data;
        delete misses[host];
      } else misses[host] = Date.now();
    })
    .catch(() => {
      misses[host] = Date.now();
    })
    .finally(() => {
      inFlight.delete(host);
      save();
      listeners.get(host)?.forEach((fn) => fn());
    });
}

// The icon for a host: a data: URL once known, otherwise null (show the letter).
export function useProxiedFavicon(host: string): string | null {
  return useSyncExternalStore(
    (fn) => {
      let set = listeners.get(host);
      if (!set) listeners.set(host, (set = new Set()));
      set.add(fn);
      if (host && !cache[host]) request(host);
      return () => set!.delete(fn);
    },
    () => (host ? cache[host] ?? null : null),
  );
}

export const proxiedFavicons = () => isExtension() && !!runtime()?.sendMessage;
