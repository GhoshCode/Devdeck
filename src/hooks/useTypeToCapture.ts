import { useEffect, useRef } from 'react';

// Type anywhere to start a search: a printable key pressed (or text pasted)
// while nothing editable has focus is sent to the search bar instead.

type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing' | 'defaultPrevented'>;

// Keys DevDeck already uses as hotkeys when no field has focus (App.tsx).
const RESERVED = new Set(['/', ',']);

export function isEditable(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

const isActivatable = (el: Element | null) => !!el?.closest('button, a[href], summary, [role="button"], [role="option"], [role="tab"], label');

// An open dialog owns the keyboard; typing must not reach the search behind it.
const dialogOpen = () => !!document.querySelector('[role="dialog"], [aria-modal="true"]');

// The text a keydown should add to the search, or null to leave it alone.
export function capturedText(e: KeyLike, active: Element | null): string | null {
  if (e.defaultPrevented || e.isComposing) return null;
  // AltGr arrives as Ctrl+Alt on Windows and still types a character.
  const altGr = e.ctrlKey && e.altKey;
  if (!altGr && (e.ctrlKey || e.metaKey || e.altKey)) return null;
  // Named keys (Shift, F5, Escape, Tab, ArrowUp, Enter, Backspace…) are longer than one character.
  if ([...e.key].length !== 1) return null;
  if (RESERVED.has(e.key)) return null;
  if (isEditable(active)) return null;
  // Space presses the focused button or link; don't steal it.
  if (e.key === ' ' && isActivatable(active)) return null;
  return e.key;
}

export function useTypeToCapture(onText: (text: string) => void, enabled = true): void {
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const text = capturedText(e, document.activeElement);
      if (text === null || dialogOpen()) return;
      e.preventDefault();
      cb.current(text);
    };
    // Ctrl/⌘+V outside a field: the browser still fires `paste`, with the text.
    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented || isEditable(document.activeElement) || dialogOpen()) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text) return;
      e.preventDefault();
      cb.current(text.replace(/\r\n?/g, '\n'));
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('paste', onPaste);
    };
  }, [enabled]);
}
