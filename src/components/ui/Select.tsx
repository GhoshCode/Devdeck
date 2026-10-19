import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';

// The one dropdown used across DevDeck instead of the browser's <select>:
// a glass trigger and a themed list in a portal (so dialogs and rounded cards
// never clip it). Keyboard: ↑/↓/Home/End move, Enter/Space pick, Esc closes,
// typing a letter jumps to the next option starting with it.

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string; // small right-aligned text (counts, offsets…)
  icon?: ReactNode;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Select…',
  size = 'md',
  className = '',
  menuWidth,
}: {
  value: T | '';
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
  menuWidth?: number; // defaults to the trigger's width
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Below the trigger, or above when there is no room.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(menuWidth ?? r.width, 140);
      const h = Math.min(260, options.length * 32 + 8);
      const up = r.bottom + h + 8 > window.innerHeight && r.top > h + 8;
      setPos({ top: up ? r.top - h - 4 : r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width, up });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, options.length, menuWidth]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!listRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // close just the list, not the dialog around it
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(last, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : last);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const from = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(k));
      const i = from >= 0 ? from : options.findIndex((o) => o.label.toLowerCase().startsWith(k));
      if (i >= 0) setActive(i);
    }
  };

  const pad = size === 'sm' ? 'h-7 px-2 text-[11px] rounded-lg' : 'h-9 px-3 text-xs rounded-xl';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`dropdown-trigger flex min-w-0 items-center gap-1.5 border text-left text-white/90 transition-colors ${pad} ${className}`}
      >
        {current?.icon}
        <span className={`min-w-0 flex-1 truncate ${current ? '' : 'text-white/45'}`}>{current?.label ?? placeholder}</span>
        <svg className={`size-3 shrink-0 text-white/45 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        pos &&
        createPortal(
          <motion.div
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: pos.up ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            onKeyDown={onKeyDown}
            className="dropdown-menu ultra-thin-scrollbar fixed z-[120] max-h-[260px] overflow-y-auto rounded-xl border py-1 shadow-2xl"
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <div
                  key={o.value}
                  id={`${id}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-white/85 ${active === i ? 'dropdown-active text-white' : ''}`}
                >
                  {o.icon}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 font-mono text-[10px] text-white/45">{o.hint}</span>}
                  <span className={`w-3 shrink-0 text-[var(--color-accent)] ${selected ? '' : 'invisible'}`}>✓</span>
                </div>
              );
            })}
          </motion.div>,
          document.body,
        )}
    </>
  );
}
