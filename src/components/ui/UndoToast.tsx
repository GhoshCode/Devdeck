import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

// "Removed X · Undo" bar at the bottom of the screen. Any delete can call
// showUndo(message, undo); the bar stays for UNDO_MS (paused while the
// pointer is over it), and Undo puts the item back exactly as it was. A new
// delete replaces the bar — the previous one can no longer be undone.

export const UNDO_MS = 5000;

type Entry = { id: number; message: string; undo: () => void };
let current: Entry | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showUndo(message: string, undo: () => void) {
  current = { id: ++seq, message, undo };
  emit();
}
const dismiss = (id: number) => {
  if (current?.id === id) {
    current = null;
    emit();
  }
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function UndoToast() {
  const entry = useSyncExternalStore(subscribe, () => current);
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex justify-center px-4">
      <AnimatePresence>{entry && <Bar key={entry.id} entry={entry} />}</AnimatePresence>
    </div>,
    document.body,
  );
}

function Bar({ entry }: { entry: Entry }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(UNDO_MS);
  const undoRef = useRef<HTMLButtonElement>(null);

  // Count down only while not hovered; whatever time is left resumes after.
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const id = setTimeout(() => dismiss(entry.id), left.current);
    return () => {
      clearTimeout(id);
      left.current -= Date.now() - started;
    };
  }, [paused, entry.id]);

  // Ctrl/⌘+Z undoes while the bar is up (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !t.closest('input, textarea, [contenteditable]')) {
        e.preventDefault();
        undoRef.current?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      data-testid="undo-bar"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="undo-bar pointer-events-auto relative flex max-w-[min(520px,100%)] items-center gap-3 overflow-hidden rounded-xl border py-2 pr-2 pl-4 shadow-2xl"
    >
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/85">{entry.message}</span>
      <button
        ref={undoRef}
        type="button"
        onClick={() => {
          entry.undo();
          dismiss(entry.id);
        }}
        className="undo-btn shrink-0 rounded-lg px-3 py-1 text-[12px] font-semibold"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={() => dismiss(entry.id)}
        aria-label="Dismiss"
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-white/45 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
      {/* Time left: a hairline that drains (and holds while hovered). */}
      <span
        aria-hidden
        className="undo-progress absolute bottom-0 left-0 h-[2px]"
        style={{ animationDuration: `${UNDO_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
      />
    </motion.div>
  );
}
