import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../../store';
import { Favicon } from '../Favicon';
import { UNCATEGORIZED_COLOR, UNCATEGORIZED_NAME } from '../../lib/categories';

// --- Custom Node Components --------------------------------------------------

function RootNodeView({ data }: NodeProps) {
  return (
    <div className="glass-inner flex items-center gap-2.5 rounded-full border border-white/20 bg-[var(--color-base-elevated)] px-4 py-2 shadow-xl">
      <span className="size-2.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_10px_var(--color-accent)]" />
      <span className="font-display text-xs font-bold uppercase tracking-wider text-white">
        {data.label as string}
      </span>
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70 tabular-nums">
        {data.count as number}
      </span>
      <Handle type="source" position={Position.Right} className="!bg-white/40 !size-2" />
    </div>
  );
}

function CategoryNodeView({ id, data }: NodeProps) {
  const isCollapsed = Boolean(data.isCollapsed);
  const color = (data.color as string) || '#a78bfa';

  return (
    <div
      className="glass-inner group relative flex items-center gap-2.5 rounded-full border px-4 py-2 shadow-lg transition-transform hover:scale-102"
      style={{
        borderColor: `${color}60`,
        backgroundColor: 'var(--color-base-elevated)',
        boxShadow: `0 0 15px ${color}20`,
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-white/40 !size-2" />
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-display text-xs font-bold uppercase tracking-wider text-white">
        {data.label as string}
      </span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
        style={{ backgroundColor: `${color}25`, color }}
      >
        {data.count as number}
      </span>

      {/* Collapse/Expand chevron */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          (data.onToggleCollapse as (nodeId: string) => void)?.(id);
        }}
        className="ml-1 rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white"
        title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
      >
        <svg
          className={`size-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <Handle type="source" position={Position.Right} className="!bg-white/40 !size-2" />
    </div>
  );
}

function SubcategoryNodeView({ id, data }: NodeProps) {
  const isCollapsed = Boolean(data.isCollapsed);
  const color = (data.color as string) || '#a78bfa';

  return (
    <div
      className="glass-inner flex items-center gap-2 rounded-full border bg-[var(--color-base-elevated)] px-3.5 py-1.5 shadow-md hover:border-white/30"
      style={{ borderColor: `${color}40` }}
    >
      <Handle type="target" position={Position.Left} className="!bg-white/40 !size-2" />
      <span className="text-xs font-semibold text-white/90">{data.label as string}</span>
      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60 tabular-nums">
        {data.count as number}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          (data.onToggleCollapse as (nodeId: string) => void)?.(id);
        }}
        className="ml-1 rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white"
        title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
      >
        <svg
          className={`size-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <Handle type="source" position={Position.Right} className="!bg-white/40 !size-2" />
    </div>
  );
}

function SiteLeafNodeView({ data }: NodeProps) {
  return (
    <div className="glass-inner group flex items-center gap-2 rounded-xl border border-white/10 bg-[var(--color-base-elevated)]/90 px-3 py-1.5 shadow-sm transition-all hover:scale-105 hover:border-white/30 hover:bg-[color-mix(in_srgb,var(--color-accent)_14%,var(--color-base-elevated))]">
      <Handle type="target" position={Position.Left} className="!bg-white/40 !size-1.5" />
      <Favicon
        url={data.url as string}
        name={data.name as string}
        categoryColor={data.color as string}
        className="size-4"
      />
      <div className="flex flex-col min-w-0">
        <span className="truncate text-[11px] font-medium text-white/90">{data.name as string}</span>
      </div>
    </div>
  );
}

const nodeTypes = {
  root: RootNodeView,
  category: CategoryNodeView,
  subcategory: SubcategoryNodeView,
  site: SiteLeafNodeView,
};

// --- Flow Canvas Inner Component ---------------------------------------------

function SitemapFlow() {
  const categories = useStore((s) => s.categories);
  const subcategories = useStore((s) => s.subcategories);
  const sites = useStore((s) => s.sites);
  const moveSite = useStore((s) => s.moveSite);

  const { getIntersectingNodes, fitView } = useReactFlow();
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Toast state for undo
  const [toast, setToast] = useState<{
    message: string;
    undo: () => void;
  } | null>(null);

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Compute Left-to-Right Tree Layout
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Root node
    nodes.push({
      id: 'root',
      type: 'root',
      position: { x: 50, y: 300 },
      data: {
        label: 'All Sites',
        count: sites.length,
      },
    });

    let currentY = 50;

    const sortedCats = [...categories].sort((a, b) => a.order - b.order);

    for (const cat of sortedCats) {
      const catSites = sites.filter((s) => s.categoryId === cat.id);
      const catSubcategories = subcategories
        .filter((sc) => sc.categoryId === cat.id)
        .sort((a, b) => a.order - b.order);

      const generalSites = catSites.filter((s) => s.subcategoryId === null);
      const isCatCollapsed = collapsedIds.has(`cat-${cat.id}`);

      const catStartY = currentY;

      // Category Node
      nodes.push({
        id: `cat-${cat.id}`,
        type: 'category',
        position: { x: 300, y: catStartY },
        data: {
          label: cat.name,
          color: cat.color,
          count: catSites.length,
          isCollapsed: isCatCollapsed,
          onToggleCollapse: toggleCollapse,
        },
      });

      edges.push({
        id: `e-root-cat-${cat.id}`,
        source: 'root',
        target: `cat-${cat.id}`,
        type: 'smoothstep',
        style: { stroke: `${cat.color}80`, strokeWidth: 2 },
      });

      if (!isCatCollapsed) {
        let subY = catStartY;

        // General Group if exists
        if (generalSites.length > 0) {
          const generalNodeId = `sub-general-${cat.id}`;
          const isGenCollapsed = collapsedIds.has(generalNodeId);

          nodes.push({
            id: generalNodeId,
            type: 'subcategory',
            position: { x: 580, y: subY },
            data: {
              label: 'General',
              color: cat.color,
              count: generalSites.length,
              isCollapsed: isGenCollapsed,
              onToggleCollapse: toggleCollapse,
            },
          });

          edges.push({
            id: `e-cat-${cat.id}-gen`,
            source: `cat-${cat.id}`,
            target: generalNodeId,
            type: 'smoothstep',
            style: { stroke: `${cat.color}60`, strokeWidth: 1.5 },
          });

          if (!isGenCollapsed) {
            let siteY = subY;
            for (const site of generalSites) {
              nodes.push({
                id: `site-${site.id}`,
                type: 'site',
                position: { x: 840, y: siteY },
                data: {
                  siteId: site.id,
                  name: site.name,
                  url: site.url,
                  color: cat.color,
                },
              });

              edges.push({
                id: `e-gen-site-${site.id}`,
                source: generalNodeId,
                target: `site-${site.id}`,
                type: 'smoothstep',
                style: { stroke: `${cat.color}40`, strokeWidth: 1 },
              });
              siteY += 46;
            }
            subY = Math.max(subY + 54, siteY + 12);
          } else {
            subY += 54;
          }
        }

        // Subcategories
        for (const sub of catSubcategories) {
          const subSites = catSites.filter((s) => s.subcategoryId === sub.id);
          const subNodeId = `sub-${sub.id}`;
          const isSubCollapsed = collapsedIds.has(subNodeId);

          nodes.push({
            id: subNodeId,
            type: 'subcategory',
            position: { x: 580, y: subY },
            data: {
              subcategoryId: sub.id,
              categoryId: cat.id,
              label: sub.name,
              color: cat.color,
              count: subSites.length,
              isCollapsed: isSubCollapsed,
              onToggleCollapse: toggleCollapse,
            },
          });

          edges.push({
            id: `e-cat-${cat.id}-sub-${sub.id}`,
            source: `cat-${cat.id}`,
            target: subNodeId,
            type: 'smoothstep',
            style: { stroke: `${cat.color}60`, strokeWidth: 1.5 },
          });

          if (!isSubCollapsed) {
            let siteY = subY;
            for (const site of subSites) {
              nodes.push({
                id: `site-${site.id}`,
                type: 'site',
                position: { x: 840, y: siteY },
                data: {
                  siteId: site.id,
                  name: site.name,
                  url: site.url,
                  color: cat.color,
                },
              });

              edges.push({
                id: `e-sub-${sub.id}-site-${site.id}`,
                source: subNodeId,
                target: `site-${site.id}`,
                type: 'smoothstep',
                style: { stroke: `${cat.color}40`, strokeWidth: 1 },
              });
              siteY += 46;
            }
            subY = Math.max(subY + 54, siteY + 12);
          } else {
            subY += 54;
          }
        }

        currentY = Math.max(catStartY + 70, subY + 20);
      } else {
        currentY += 70;
      }
    }

    // Sites with no category hang straight off an "Uncategorized / None" node.
    const loose = sites.filter((s) => s.categoryId === '');
    if (loose.length) {
      const nodeId = 'cat-uncategorized';
      nodes.push({
        id: nodeId,
        type: 'category',
        position: { x: 300, y: currentY },
        data: { label: `${UNCATEGORIZED_NAME} / None`, color: UNCATEGORIZED_COLOR, count: loose.length, isCollapsed: collapsedIds.has(nodeId), onToggleCollapse: toggleCollapse },
      });
      edges.push({ id: 'e-root-uncat', source: 'root', target: nodeId, type: 'smoothstep', style: { stroke: `${UNCATEGORIZED_COLOR}80`, strokeWidth: 2 } });
      let siteY = currentY;
      if (!collapsedIds.has(nodeId)) {
        for (const site of loose) {
          nodes.push({
            id: `site-${site.id}`,
            type: 'site',
            position: { x: 580, y: siteY },
            data: { siteId: site.id, name: site.name, url: site.url, color: UNCATEGORIZED_COLOR },
          });
          edges.push({ id: `e-uncat-site-${site.id}`, source: nodeId, target: `site-${site.id}`, type: 'smoothstep', style: { stroke: `${UNCATEGORIZED_COLOR}40`, strokeWidth: 1 } });
          siteY += 46;
        }
      }
      currentY = Math.max(currentY + 70, siteY + 20);
    }

    // Center root vertically relative to tree
    const rootNode = nodes.find((n) => n.id === 'root');
    if (rootNode) {
      rootNode.position.y = Math.max(100, currentY / 2 - 20);
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [categories, subcategories, sites, collapsedIds, toggleCollapse]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle Drag-to-Reparent
  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (node.type !== 'site') return;

      const rawSiteId = (node.data?.siteId as string) || node.id.replace('site-', '');
      const site = sites.find((s) => s.id === rawSiteId);
      if (!site) return;

      const intersections = getIntersectingNodes(node);
      const targetNode = intersections.find(
        (n) => n.type === 'subcategory' || n.type === 'category',
      );

      if (!targetNode) {
        // Snap back to layout
        setNodes(initialNodes);
        return;
      }

      const prevCategory = site.categoryId;
      const prevSubcategory = site.subcategoryId;

      if (targetNode.type === 'subcategory') {
        const isGeneral = targetNode.id.startsWith('sub-general-');
        const targetCatId = isGeneral
          ? targetNode.id.replace('sub-general-', '')
          : (targetNode.data.categoryId as string);
        const targetSubcatId = isGeneral
          ? null
          : (targetNode.data.subcategoryId as string) || targetNode.id.replace('sub-', '');

        moveSite(site.id, targetCatId, targetSubcatId);

        setToast({
          message: `Moved "${site.name}" to ${targetNode.data.label as string}`,
          undo: () => moveSite(site.id, prevCategory, prevSubcategory),
        });
      } else if (targetNode.type === 'category') {
        const targetCatId = targetNode.id.replace('cat-', '');
        moveSite(site.id, targetCatId, null);

        setToast({
          message: `Moved "${site.name}" to ${targetNode.data.label as string} (General)`,
          undo: () => moveSite(site.id, prevCategory, prevSubcategory),
        });
      }
    },
    [sites, getIntersectingNodes, initialNodes, setNodes, moveSite],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[var(--color-base)]"
      >
        <Background color="rgba(255,255,255,0.06)" gap={24} />
        <Controls className="!bg-[var(--color-base-elevated)] !border-white/10 !fill-white" />
        <MiniMap
          bgColor="var(--color-base-elevated)"
          maskColor="rgba(0, 0, 0, 0.5)"
          nodeColor={(node) => {
            if (node.type === 'root') return '#ff2e9a';
            if (node.type === 'category') return (node.data?.color as string) || '#a78bfa';
            return 'rgba(255,255,255,0.2)';
          }}
          className="!bg-[var(--color-base-elevated)]/90 !border-white/10"
        />
      </ReactFlow>

      {/* Floating Instructions / Controls Bar */}
      <div className="pointer-events-none absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="glass-inner pointer-events-auto rounded-xl border border-white/10 bg-[var(--color-base)]/90 px-3.5 py-2 text-xs text-white/70 shadow-lg">
          Drag site leaves onto any category or subcategory pill to reparent.
        </div>
        <button
          type="button"
          onClick={() => fitView({ padding: 0.2, duration: 400 })}
          className="glass-inner pointer-events-auto rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
        >
          Reset View
        </button>
      </div>

      {/* Toast Notification with Undo */}
      {toast && (
        <div className="absolute bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-white/20 bg-[var(--color-base-elevated)] px-4 py-3 shadow-2xl backdrop-blur-xl">
          <span className="text-xs text-white">{toast.message}</span>
          <button
            type="button"
            onClick={() => {
              toast.undo();
              setToast(null);
            }}
            className="rounded-lg bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs text-white/40 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export function SitemapTab() {
  return (
    <ReactFlowProvider>
      <div className="h-full w-full min-h-[500px]">
        <SitemapFlow />
      </div>
    </ReactFlowProvider>
  );
}
