import { memo, useState } from 'react';
import { getHostname } from '../utils';
import { proxiedFavicons, useProxiedFavicon } from '../lib/faviconStore';

interface FaviconProps {
  url: string;
  name: string;
  categoryColor?: string;
  className?: string;
  // Browser bookmarks: use Chrome's own favicon cache (no network, no 404s,
  // the icon you see in the bookmark bar). Falls back to the web service
  // outside the extension.
  browser?: boolean;
}

const chromeRuntime = () => (globalThis as { chrome?: { runtime?: { id?: string; getURL?: (p: string) => string } } }).chrome?.runtime;
export function browserFaviconUrl(pageUrl: string, size = 32): string | null {
  const rt = chromeRuntime();
  if (!rt?.id || !rt.getURL) return null;
  return `${rt.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

// Sites the favicon service has no icon for answer 404, and the browser logs
// every failed image as a console error. So a missing icon is asked for only
// once, ever: hosts known to have none (checked against the starter library)
// and any host that failed before (remembered in localStorage) go straight to
// the letter tile without a request.
const KNOWN_MISSING = ['changelog.com', 'cvedetails.com', 'dev.mysql.com', 'en.cppreference.com', 'gchq.github.io', 'javascriptweekly.com', 'leetcode.com', 'pkg.go.dev'];
const STORE_KEY = 'devdeck.favicon.missing';

const missing: Set<string> = (() => {
  const set = new Set(KNOWN_MISSING);
  try {
    for (const h of JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as string[]) set.add(h);
  } catch {
    // storage unavailable — the built-in list still applies
  }
  return set;
})();

function rememberMissing(host: string) {
  if (missing.has(host)) return;
  missing.add(host);
  try {
    const own = [...missing].filter((h) => !KNOWN_MISSING.includes(h)).slice(-500);
    localStorage.setItem(STORE_KEY, JSON.stringify(own));
  } catch {
    // not remembered across reloads; fine
  }
}

export const Favicon = memo(function Favicon({
  url,
  name,
  categoryColor = '#a78bfa',
  className = 'size-6',
  browser = false,
}: FaviconProps) {
  const domain = getHostname(url);
  const cached = browser ? browserFaviconUrl(url) : null;
  // Extension: the service worker fetches the icon, so the page never makes a
  // request that can fail (and log an error).
  const proxy = !cached && proxiedFavicons();
  const proxied = useProxiedFavicon(proxy && domain && !missing.has(domain) ? domain : '');
  const [hasError, setHasError] = useState(() => missing.has(domain));
  const initial = (name.trim()[0] || '?').toUpperCase();

  if (cached && !hasError) {
    return <img src={cached} alt="" className={`${className} rounded-sm object-contain shrink-0`} loading="lazy" onError={() => setHasError(true)} />;
  }

  if (proxy && proxied && !hasError) {
    return <img src={proxied} alt="" className={`${className} rounded-sm object-contain shrink-0`} onError={() => setHasError(true)} />;
  }

  if (proxy || hasError || !domain || missing.has(domain)) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded font-display text-xs font-bold text-white shadow-sm shrink-0`}
        style={{ backgroundColor: categoryColor }}
        aria-hidden="true"
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      className={`${className} rounded-sm object-contain shrink-0`}
      loading="lazy"
      onError={() => {
        rememberMissing(domain);
        setHasError(true);
      }}
    />
  );
});
