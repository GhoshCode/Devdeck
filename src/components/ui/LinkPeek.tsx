import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Hover any site, link or site icon anywhere in DevDeck and its full address
// appears in a small popover. One document-level listener covers every link
// (quick links, cards, rows, feeds, Site Map…), so no component needs wiring.
// The browser's own title tooltip is held back while the popover shows.

const DELAY = 380;

type Peek = { url: string; host: string; x: number; y: number; above: boolean };

const linkOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLAnchorElement>('a[href^="http"]') : null);

export function LinkPeek() {
  const [peek, setPeek] = useState<Peek | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const current = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const restoreTitle = (a: HTMLAnchorElement | null) => {
      if (a?.dataset.peekTitle !== undefined) {
        a.setAttribute('title', a.dataset.peekTitle);
        delete a.dataset.peekTitle;
      }
    };
    const hide = () => {
      clearTimeout(timer.current);
      restoreTitle(current.current);
      current.current = null;
      setPeek(null);
    };
    const onOver = (e: MouseEvent) => {
      const a = linkOf(e.target);
      if (a === current.current) return;
      hide();
      if (!a || a.closest('[data-no-peek]')) return;
      current.current = a;
      // Keep the native tooltip from doubling up with ours.
      const title = a.getAttribute('title');
      if (title !== null) {
        a.dataset.peekTitle = title;
        a.removeAttribute('title');
      }
      timer.current = setTimeout(() => {
        const r = a.getBoundingClientRect();
        let host = '';
        try {
          host = new URL(a.href).hostname.replace(/^www\./, '');
        } catch {
          host = a.href;
        }
        const above = r.bottom + 64 > window.innerHeight;
        setPeek({ url: a.href, host, x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above });
      }, DELAY);
    };
    const onOut = (e: MouseEvent) => {
      if (current.current && !current.current.contains(e.relatedTarget as Node | null)) hide();
    };
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('mousedown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      hide();
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mousedown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!peek) return null;
  const width = Math.min(420, window.innerWidth - 16);
  const left = Math.max(8, Math.min(peek.x - width / 2, window.innerWidth - width - 8));
  return createPortal(
    <div
      role="tooltip"
      data-testid="link-peek"
      className="link-peek pointer-events-none fixed z-[95] flex justify-center"
      style={{ left, width, top: peek.y, transform: peek.above ? 'translateY(-100%)' : undefined }}
    >
      <div className="link-peek-card max-w-full rounded-lg border px-2.5 py-1.5 shadow-xl">
        <div className="truncate text-[11px] font-semibold text-white/90">{peek.host}</div>
        <div className="font-mono text-[10.5px] leading-snug break-all text-white/60">{peek.url}</div>
      </div>
    </div>,
    document.body,
  );
}
