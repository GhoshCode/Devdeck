import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useStore } from '../../store';

type SplitSetting = 'leftSplit' | 'feedSplit';

// Two stacked panes with a drag handle between them (Focus / Queue, Tech
// news / Dev jobs). The split is saved per place; arrow keys nudge it and a
// double-click fits the top pane to its contents.
const SPLIT_MIN = 0.18;
const SPLIT_MAX = 0.82;

export function SplitPanes({
  setting,
  label,
  fitHint,
  children,
}: {
  setting: SplitSetting;
  label: string;
  fitHint: string;
  children: [ReactNode, ReactNode];
}) {
  const saved = useStore((s) => s.settings[setting] ?? 0.5);
  const updateSettings = useStore((s) => s.updateSettings);
  const [ratio, setRatio] = useState(saved);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setRatio(saved), [saved]);

  const clamp = (r: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, r));
  const commit = (r: number) => updateSettings({ [setting]: Math.round(clamp(r) * 1000) / 1000 });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    let last = ratio;
    const move = (ev: globalThis.PointerEvent) => {
      last = clamp((ev.clientY - box.top) / box.height);
      setRatio(last);
    };
    const up = () => {
      setDragging(false);
      commit(last);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Fit Focus to its content: header + one row per site, within the limits.
  const fitToContent = () => {
    const box = ref.current;
    const focus = box?.firstElementChild as HTMLElement | null;
    const list = focus?.querySelector('ul, ol');
    if (!box || !focus) return;
    const needed = (focus.querySelector('section')?.scrollHeight ?? focus.scrollHeight) - (list ? list.clientHeight - list.scrollHeight : 0);
    commit(needed / box.clientHeight);
  };

  return (
    <div ref={ref} className={`flex min-h-0 flex-1 flex-col ${dragging ? 'cursor-row-resize select-none' : ''}`}>
      <div className="flex min-h-0 flex-col" style={{ flex: `0 0 calc(${ratio * 100}% - 6px)` }}>
        {children[0]}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={label}
        aria-valuemin={Math.round(SPLIT_MIN * 100)}
        aria-valuemax={Math.round(SPLIT_MAX * 100)}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        title={`Drag to resize · double-click to ${fitHint}`}
        onPointerDown={onPointerDown}
        onDoubleClick={fitToContent}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            commit(ratio + (e.key === 'ArrowDown' ? 0.04 : -0.04));
          }
        }}
        className="group/split flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center"
      >
        <span
          className={`h-1 rounded-full transition-all ${
            dragging ? 'w-14 bg-[var(--color-accent)]' : 'w-8 bg-white/20 group-hover/split:w-12 group-hover/split:bg-white/45'
          }`}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children[1]}</div>
    </div>
  );
}
