import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';

// A small themed popover pinned to the element that opened it (portal, so
// rounded / scrolling cards never clip it). Outside click or Esc closes it.
export function AnchoredPopover({
  anchor,
  onClose,
  label,
  width = 300,
  children,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  label: string;
  width?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const h = ref.current?.offsetHeight ?? 240;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const below = r.bottom + 6;
      setPos({ top: below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, width]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // Clicks in another portal (a dropdown opened from inside) don't count as outside.
      if (!ref.current?.contains(t) && !anchor.contains(t) && !(t as Element).closest?.('[role="listbox"]')) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={label}
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14 }}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
      className="dropdown-menu dtp fixed z-[70] rounded-2xl border p-3 shadow-2xl"
    >
      {children}
    </motion.div>,
    document.body,
  );
}
