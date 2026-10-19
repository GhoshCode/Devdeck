import { memo, useState } from 'react';
import { getHostname } from '../utils';

interface FaviconProps {
  url: string;
  name: string;
  categoryColor?: string;
  className?: string;
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
}: FaviconProps) {
  const domain = getHostname(url);
  const [hasError, setHasError] = useState(() => missing.has(domain));
  const initial = (name.trim()[0] || '?').toUpperCase();

  if (hasError || !domain || missing.has(domain)) {
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
