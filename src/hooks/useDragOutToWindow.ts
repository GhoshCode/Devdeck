import { useEffect } from 'react';
import { openInNewWindow } from '../lib/openTab';

// Drag a site out of the Site Map panel or out of the category cards box and
// let go where nothing takes it (outside the box, outside the browser): the
// site opens in a new browser window. Drops that something accepts — a
// section, the bin, the browser's tab strip — keep their usual meaning.
export function useDragOutToWindow() {
  useEffect(() => {
    let source: { url: string; zone: Element } | null = null;
    const onStart = (e: DragEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="http"]') as HTMLAnchorElement | null;
      const zone = a?.closest('[data-drag-zone]');
      source = a && zone ? { url: a.href, zone } : null;
    };
    const onEnd = (e: DragEvent) => {
      const s = source;
      source = null;
      if (!s || e.dataTransfer?.dropEffect !== 'none') return;
      const r = s.zone.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) openInNewWindow(s.url);
    };
    document.addEventListener('dragstart', onStart, true);
    document.addEventListener('dragend', onEnd, true);
    return () => {
      document.removeEventListener('dragstart', onStart, true);
      document.removeEventListener('dragend', onEnd, true);
    };
  }, []);
}
