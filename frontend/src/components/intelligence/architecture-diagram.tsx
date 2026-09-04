'use client';

import type { ArchitectureGraph } from '@/types/api';

const NODE_W = 132;
const NODE_H = 40;
const LAYER_GAP = 110;
const ROW_GAP = 22;

/**
 * Layered dependency diagram: nodes are grouped by longest-path layer
 * (computed server-side) and rendered left -> right, with dependency edges
 * drawn as curved links. Pure SVG — no diagram library needed.
 */
export function ArchitectureDiagram({ graph }: { graph: ArchitectureGraph }) {
  const nodes = graph.nodes.slice(0, 16);
  const edges = graph.edges.slice(0, 28);
  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No architecture to draw yet — scan a repository with source files first.
      </div>
    );
  }

  const byLayer: Record<number, typeof nodes> = {};
  for (const node of nodes) {
    (byLayer[node.layer] ??= []).push(node);
  }
  const layers = Object.keys(byLayer)
    .map(Number)
    .sort((a, b) => a - b);

  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, li) => {
    const layerNodes = byLayer[layer];
    layerNodes.forEach((node, i) => {
      pos.set(node.id, {
        x: li * LAYER_GAP,
        y: i * (NODE_H + ROW_GAP) - ((layerNodes.length - 1) * (NODE_H + ROW_GAP)) / 2,
      });
    });
  });

  const width = layers.length * LAYER_GAP + NODE_W;
  const maxRows = Math.max(...layers.map((l) => byLayer[l].length));
  const height = Math.max(180, maxRows * (NODE_H + ROW_GAP) + 40);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const drawnEdges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`${-LAYER_GAP / 2} ${-height / 2 - 10} ${width + LAYER_GAP} ${height + 20}`}
        className="min-w-[640px]"
        role="img"
        aria-label="Repository dependency architecture diagram"
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="hsl(var(--primary) / 0.45)" />
          </marker>
        </defs>

        {drawnEdges.map((edge, i) => {
          const from = pos.get(edge.from);
          const to = pos.get(edge.to);
          if (!from || !to) return null;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const mid = (x1 + x2) / 2;
          return (
            <path
              key={`${edge.from}-${edge.to}-${i}`}
              d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="hsl(var(--primary) / 0.45)"
              strokeWidth={Math.min(2.5, 1 + edge.weight * 0.25)}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {nodes.map((node) => {
          const p = pos.get(node.id);
          if (!p) return null;
          const maxFiles = Math.max(...nodes.map((n) => n.files), 1);
          const intensity = 0.12 + (node.files / maxFiles) * 0.22;
          return (
            <g key={node.id}>
              <rect
                x={p.x}
                y={p.y}
                width={NODE_W}
                height={NODE_H}
                rx={10}
                fill={`hsl(var(--primary) / ${intensity})`}
                stroke="hsl(var(--primary) / 0.35)"
                strokeWidth={1}
              />
              <text
                x={p.x + 12}
                y={p.y + 17}
                fontSize={12}
                fontWeight={600}
                fill="hsl(var(--foreground))"
              >
                {node.label}
              </text>
              <text
                x={p.x + 12}
                y={p.y + 31}
                fontSize={10}
                fill="hsl(var(--muted-foreground))"
              >
                {node.files} files · {node.symbols} symbols
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}