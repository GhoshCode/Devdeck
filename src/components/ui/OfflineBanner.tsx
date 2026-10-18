import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { OfflineIcon } from './icons';

// When the connection drops, a soft see-through veil (75% transparent) over
// the category area — the quick-links row above stays clear — with a short
// note. It leaves on its own when the connection is back.

// navigator.onLine only notices a dead network adapter; Wi-Fi that is still
// connected but has no internet reads as online. So we also probe a tiny
// endpoint: every 20 s while online, every 5 s while offline, and right away
// on focus or any network change.
const PROBE_URL = 'https://www.gstatic.com/generate_204';

async function probe(): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    await fetch(`${PROBE_URL}?t=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      clearTimeout(timer);
      const ok = navigator.onLine && (await probe());
      if (!alive) return;
      setOnline(ok);
      timer = setTimeout(check, ok ? 20_000 : 5_000);
    };
    const down = () => {
      setOnline(false);
      void check();
    };
    const recheck = () => void check();
    window.addEventListener('online', recheck);
    window.addEventListener('offline', down);
    window.addEventListener('focus', recheck);
    void check();
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener('online', recheck);
      window.removeEventListener('offline', down);
      window.removeEventListener('focus', recheck);
    };
  }, []);
  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="offline"
          role="status"
          aria-live="polite"
          data-testid="offline-banner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="offline-veil pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-b-[inherit] p-6"
        >
          <motion.div
            initial={{ y: 10, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="offline-card flex max-w-sm flex-col items-center gap-2 rounded-2xl border px-6 py-5 text-center"
          >
            <span className="offline-icon flex size-14 items-center justify-center rounded-2xl">
              <OfflineIcon className="size-8" />
            </span>
            <p className="font-display text-[15px] font-semibold text-white">You're offline</p>
            <p className="text-[12px] leading-relaxed text-white/65">
              No internet connection right now. Your deck still works — sites open, news, weather and GitHub refresh as soon as you're back online.
            </p>
            <span className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] text-white/45">
              <span className="offline-dot size-1.5 rounded-full" /> waiting for connection…
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
