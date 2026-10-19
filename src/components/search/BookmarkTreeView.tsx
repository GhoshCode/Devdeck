import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { findNode, isFolder, isInside, isRootContainer, moveNode, type BmNode } from '../../services/bookmarks';
import { Favicon } from '../Favicon';
import { BOX_W, HEADER_H, MAX_SITES, SITE_H, layoutTree } from './bookmarkLayout';
import { FolderIcon, TreeIcon } from './BookmarkDrawer';

// Tree View: every browser bookmark folder as a box, flowing top to bottom.
// Grab a site — or a whole folder by its header — and drop it on any folder
// box to move it there (the browser's bookmarks change too). Drag the empty
// canvas to pan, wheel to zoom, Fit to see everything.

type Drag = { id: string; title: string; url?: string; folder: boolean; fromParent?: string };
const MIN_Z = 0.25;
const MAX_Z = 1.6;
const EDGE = 64; // px from the viewport edge where a drag auto-pans

export default function BookmarkTreeView({ roots, onClose }: { roots: BmNode[]; onClose: () => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => initialCollapsed(roots));
  const [moreSites, setMoreSites] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState({ x: 40, y: 80, k: 1 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<{ id: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMoved, setLastMoved] = useState<string | null>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const layout = useMemo(() => layoutTree(roots, collapsed, moreSites), [roots, collapsed, moreSites]);

  const fit = useCallback(() => {
    const vp = vpRef.current;
    if (!vp || !layout.width) return;
    const k = Math.min(1, Math.max(MIN_Z, Math.min((vp.clientWidth - 80) / layout.width, (vp.clientHeight - 120) / Math.max(1, layout.height))));
    setView({ k, x: (vp.clientWidth - layout.width * k) / 2, y: 70 });
  }, [layout.width, layout.height]);
  // Fit once on open.
  const fitted = useRef(false);
  useLayoutEffect(() => {
    if (!fitted.current && layout.width) {
      fitted.current = true;
      fit();
    }
  }, [fit, layout.width]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (dragRef.current) cancelDrag();
      else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // ---- zoom (wheel, around the cursor) -------------------------------------
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      const { x, y, k } = viewRef.current;
      if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        setView({ x: x - e.deltaX, y, k }); // trackpad sideways swipe pans
        return;
      }
      const nk = Math.min(MAX_Z, Math.max(MIN_Z, k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setView({ k: nk, x: px - ((px - x) * nk) / k, y: py - ((py - y) * nk) / k });
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);
  const zoomBy = (f: number) => {
    const vp = vpRef.current;
    if (!vp) return;
    const { x, y, k } = viewRef.current;
    const nk = Math.min(MAX_Z, Math.max(MIN_Z, k * f));
    const cx = vp.clientWidth / 2;
    const cy = vp.clientHeight / 2;
    setView({ k: nk, x: cx - ((cx - x) * nk) / k, y: cy - ((cy - y) * nk) / k });
  };

  // ---- pan (drag the empty canvas) -----------------------------------------
  const onCanvasDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as Element).closest('[data-bm-item], button, a')) return;
    const start = { px: e.clientX, py: e.clientY, ...viewRef.current };
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-panning');
    const move = (ev: PointerEvent) => setView({ k: start.k, x: start.x + ev.clientX - start.px, y: start.y + ev.clientY - start.py });
    const up = () => {
      el.classList.remove('is-panning');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  // ---- drag a site or folder onto another folder ---------------------------
  const dragRef = useRef<Drag | null>(null);
  const overRef = useRef<{ id: string; ok: boolean } | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const suppressClick = useRef(false);

  const validTarget = useCallback(
    (d: Drag, folderId: string) => {
      if (d.id === folderId) return false;
      if (d.fromParent === folderId) return false; // already there
      if (d.folder && isInside(roots, folderId, d.id)) return false; // into itself / a descendant
      const target = findNode(roots, folderId);
      return !!target && !target.unmodifiable;
    },
    [roots],
  );

  const cancelDrag = () => {
    cancelAnimationFrame(raf.current);
    dragRef.current = null;
    overRef.current = null;
    setDrag(null);
    setOver(null);
  };

  const tick = () => {
    const d = dragRef.current;
    if (!d) return;
    const { x, y } = pointer.current;
    if (ghostRef.current) ghostRef.current.style.transform = `translate3d(${x + 14}px, ${y + 12}px, 0)`;
    // auto-pan while the pointer rests near an edge
    const vp = vpRef.current;
    if (vp) {
      const r = vp.getBoundingClientRect();
      const dx = x < r.left + EDGE ? 1 : x > r.right - EDGE ? -1 : 0;
      const dy = y < r.top + EDGE ? 1 : y > r.bottom - EDGE ? -1 : 0;
      if (dx || dy) setView((v) => ({ ...v, x: v.x + dx * 12, y: v.y + dy * 12 }));
    }
    const hit = (document.elementFromPoint(x, y) as Element | null)?.closest('[data-drop-folder]');
    const id = hit?.getAttribute('data-drop-folder') ?? null;
    const next = id ? { id, ok: validTarget(d, id) } : null;
    if (next?.id !== overRef.current?.id || next?.ok !== overRef.current?.ok) {
      overRef.current = next;
      setOver(next);
    }
    raf.current = requestAnimationFrame(tick);
  };

  const onItemDown = (e: React.PointerEvent, item: Drag) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const el = e.currentTarget as HTMLElement;
    let started = false;
    const move = (ev: PointerEvent) => {
      pointer.current = { x: ev.clientX, y: ev.clientY };
      if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) {
        started = true;
        el.setPointerCapture(ev.pointerId);
        dragRef.current = item;
        setDrag(item);
        raf.current = requestAnimationFrame(tick);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (!started) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      const d = dragRef.current;
      const target = overRef.current;
      cancelDrag();
      if (d && target?.ok) {
        setLastMoved(d.id);
        setCollapsed((c) => {
          if (!c.has(target.id)) return c;
          const n = new Set(c);
          n.delete(target.id);
          return n;
        });
        moveNode(d.id, target.id)
          .then(() => setError(null))
          .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
      }
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (started) cancelDrag();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    if (!lastMoved) return;
    const t = setTimeout(() => setLastMoved(null), 1200);
    return () => clearTimeout(t);
  }, [lastMoved]);

  const toggle = (set: typeof setCollapsed, id: string) =>
    set((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allFolderIds = useMemo(() => layout.boxes.map((b) => b.node.id), [layout.boxes]);

  return createPortal(
    <motion.div
      role="dialog"
      aria-label="Bookmarks tree view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className={`bm-treeview fixed inset-0 z-[95] flex flex-col ${drag ? 'is-dragging' : ''}`}
    >
      <header className="bm-tree-bar relative z-10 flex items-center gap-3 border-b px-5 py-3">
        <TreeIcon />
        <h2 className="font-display text-sm font-semibold tracking-[0.16em] text-white">BOOKMARKS · TREE VIEW</h2>
        <span className="hidden font-mono text-[11px] text-white/45 md:inline">drag a site or a folder onto another folder · drag the background to pan · wheel to zoom</span>
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" className="bm-tool" onClick={() => setCollapsed(new Set())}>
            Expand all
          </button>
          <button type="button" className="bm-tool" onClick={() => setCollapsed(new Set(allFolderIds.filter((id) => !roots.some((r) => r.id === id))))}>
            Collapse all
          </button>
          <span className="mx-1 h-5 w-px bg-white/15" />
          <button type="button" className="bm-tool" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
            −
          </button>
          <span className="w-12 text-center font-mono text-[11px] text-white/60">{Math.round(view.k * 100)}%</span>
          <button type="button" className="bm-tool" aria-label="Zoom in" onClick={() => zoomBy(1.2)}>
            +
          </button>
          <button type="button" className="bm-tool" onClick={fit}>
            Fit
          </button>
          <button type="button" aria-label="Close tree view" onClick={onClose} className="bm-tool ml-1">
            ✕
          </button>
        </span>
      </header>
      {error && <p className="absolute top-16 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-red-500/20 px-3 py-1.5 text-[12px] text-red-200">{error}</p>}
      <div ref={vpRef} onPointerDown={onCanvasDown} className="bm-canvas relative min-h-0 flex-1 overflow-hidden">
        <div
          className="absolute top-0 left-0 origin-top-left will-change-transform"
          style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})`, width: layout.width, height: layout.height }}
        >
          <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width={layout.width} height={layout.height} aria-hidden>
            {layout.edges.map((e) => {
              const mid = (e.y1 + e.y2) / 2;
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={`M${e.x1},${e.y1} V${mid - 8} Q${e.x1},${mid} ${e.x1 + Math.sign(e.x2 - e.x1) * 8},${mid} H${e.x2 - Math.sign(e.x2 - e.x1) * 8} Q${e.x2},${mid} ${e.x2},${mid + 8} V${e.y2}`}
                  className="bm-edge"
                  fill="none"
                />
              );
            })}
          </svg>
          {layout.boxes.map((b) => {
            const root = isRootContainer(b.node);
            const hover = over?.id === b.node.id;
            const locked = !!b.node.unmodifiable;
            return (
              <div
                key={b.node.id}
                data-drop-folder={b.node.id}
                className={`bm-box absolute flex flex-col rounded-2xl border ${root ? 'is-root' : ''} ${hover ? (over!.ok ? 'is-over' : 'is-blocked') : ''} ${
                  lastMoved && b.node.children?.some((c) => c.id === lastMoved) ? 'is-landed' : ''
                } ${drag?.id === b.node.id ? 'is-source' : ''}`}
                style={{ transform: `translate(${b.x}px, ${b.y}px)`, width: BOX_W, height: b.h }}
              >
                <div
                  data-bm-item={root || locked ? undefined : b.node.id}
                  onPointerDown={root || locked ? undefined : (e) => onItemDown(e, { id: b.node.id, title: b.node.title, folder: true, fromParent: b.node.parentId })}
                  className={`flex shrink-0 items-center gap-2 px-3 ${root || locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
                  style={{ height: HEADER_H }}
                  title={root ? b.node.title : `${b.node.title} — drag to move this folder`}
                >
                  <FolderIcon root={root} open={!b.collapsed} />
                  <span className={`min-w-0 flex-1 truncate text-[12.5px] ${root ? 'font-semibold tracking-wide text-white' : 'font-semibold text-white/90'}`}>{b.node.title || 'Untitled folder'}</span>
                  {b.folders > 0 && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => toggle(setCollapsed, b.node.id)}
                      className="bm-fold rounded-md px-1.5 font-mono text-[10px]"
                      title={b.collapsed ? `Show ${b.folders} sub folders` : 'Hide sub folders'}
                    >
                      {b.collapsed ? `+${b.folders}` : '−'}
                    </button>
                  )}
                </div>
                {b.sites.length > 0 && <div className="bm-box-rule mx-3" />}
                <div className="flex flex-col px-1.5 pb-1">
                  {b.sites.map((s) => (
                    <a
                      key={s.id}
                      href={s.url}
                      draggable={false}
                      data-bm-item={s.id}
                      onClick={(e) => suppressClick.current && e.preventDefault()}
                      onPointerDown={s.unmodifiable ? undefined : (e) => onItemDown(e, { id: s.id, title: s.title, url: s.url, folder: false, fromParent: s.parentId })}
                      title={`${s.title}\n${s.url}`}
                      className={`bm-site flex items-center gap-2 rounded-lg px-1.5 text-[12px] text-white/80 ${drag?.id === s.id ? 'is-source' : ''} ${lastMoved === s.id ? 'is-landed' : ''}`}
                      style={{ height: SITE_H }}
                    >
                      <Favicon url={s.url!} name={s.title || s.url!} className="size-3.5 shrink-0" />
                      <span className="truncate">{s.title || s.url}</span>
                    </a>
                  ))}
                  {b.hiddenSites > 0 && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => toggle(setMoreSites, b.node.id)}
                      className="bm-more rounded-lg px-1.5 text-left font-mono text-[10.5px]"
                      style={{ height: SITE_H }}
                    >
                      +{b.hiddenSites} more
                    </button>
                  )}
                  {moreSites.has(b.node.id) && b.hiddenSites === 0 && b.sites.length > MAX_SITES && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => toggle(setMoreSites, b.node.id)}
                      className="bm-more rounded-lg px-1.5 text-left font-mono text-[10.5px]"
                      style={{ height: SITE_H }}
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {drag && (
        <div ref={ghostRef} className="bm-ghost pointer-events-none fixed top-0 left-0 z-[96] flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[12.5px] font-medium text-white" style={{ transform: `translate3d(${pointer.current.x + 14}px, ${pointer.current.y + 12}px, 0)` }}>
          {drag.folder ? <FolderIcon /> : <Favicon url={drag.url!} name={drag.title} className="size-4" />}
          <span className="max-w-[240px] truncate">{drag.title || drag.url}</span>
          {over && <span className={`ml-1 font-mono text-[10px] ${over.ok ? 'text-[var(--color-accent)]' : 'text-red-300'}`}>{over.ok ? 'drop to move here' : "can't move here"}</span>}
        </div>
      )}
    </motion.div>,
    document.body,
  );
}

// Big trees open with the third level and deeper folded, so the first view is readable.
function initialCollapsed(roots: readonly BmNode[]) {
  const out = new Set<string>();
  const walk = (n: BmNode, depth: number) => {
    if (!isFolder(n)) return;
    if (depth >= 2 && (n.children ?? []).some(isFolder)) out.add(n.id);
    (n.children ?? []).forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  return out;
}
