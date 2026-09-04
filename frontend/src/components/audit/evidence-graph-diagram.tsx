'use client';

import type { EvidenceGraph } from '@/types/api';

const FINDING_W = 168;
const EVIDENCE_W = 168;
const FILE_W = 168;
const NODE_H = 36;
const COL_GAP = 96;
const ROW_GAP = 14;

const KIND_COLORS: Record<string, string> = {
  source_input: '#22c55e',
  transformation: '#eab308',
  sink: '#ef4444',
  static_analysis: '#8b5cf6',
  dependency: '#f97316',
  test: '#06b6d4',
  llm_reasoning: '#ec4899',
  call_relationship: '#3b82f6',
};

/**
 * Evidence graph in three columns: finding -> evidence chain -> file.
 * Pure SVG, layered like the architecture diagram. Each finding's evidence
 * nodes stack vertically and flow left-to-right ("flows" edges), then link
 * to the file they live in.
 */
export function EvidenceGraphDiagram({ graph }: { graph: EvidenceGraph }) {
  const findings = graph.nodes.filter((n) => n.kind === 'finding');
  const evidence = graph.nodes.filter((n) => n.kind === 'evidence');
  const files = graph.nodes.filter((n) => n.kind === 'file');

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No findings yet — the evidence graph appears after a scan with findings.
      </div>
    );
  }

  const pos = new Map<string, { x: number; y: number }>();
  const colWidths = [FINDING_W, EVIDENCE_W, FILE_W];
  const cols: { list: typeof findings; x: number; kind: 'finding' | 'evidence' | 'file' }[] = [
    { list: findings.slice(0, 8), x: 0, kind: 'finding' },
    { list: evidence.slice(0, 40), x: FINDING_W + COL_GAP, kind: 'evidence' },
    { list: files.slice(0, 12), x: FINDING_W + COL_GAP + EVIDENCE_W + COL_GAP, kind: 'file' },
  ];

  let maxRows = 1;
  for (const col of cols) {
    col.list.forEach((node, i) => {
      pos.set(node.id, { x: col.x, y: i * (NODE_H + ROW_GAP) });
    });
    maxRows = Math.max(maxRows, col.list.length);
  }

  const width = colWidths[0] + COL_GAP + colWidths[1] + COL_GAP + colWidths[2];
  const height = Math.max(160, maxRows * (NODE_H + ROW_GAP) + 30);
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const drawnEdges = graph.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`-8 -12 ${width + 16} ${height + 24}`}
        className="min-w-[720px]"
        role="img"
        aria-label="Evidence graph: findings, evidence chains and files"
      >
        <defs>
          <marker id="ev-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="hsl(var(--muted-foreground) / 0.7)" />
          </marker>
        </defs>

        {/* column labels */}
        {(['Findings', 'Evidence chain', 'Files'] as const).map((label, i) => (
          <text
            key={label}
            x={colWidths[i] / 2 + (i > 0 ? colWidths[i - 1] + COL_GAP : 0)}
            y={-4}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="hsl(var(--muted-foreground))"
            letterSpacing={1}
          >
            {label.toUpperCase()}
          </text>
        ))}

        {drawnEdges.map((edge, i) => {
          const from = pos.get(edge.from);
          const to = pos.get(edge.to);
          if (!from || !to) return null;
          const fromNode = graph.nodes.find((n) => n.id === edge.from);
          const fromWidth = fromNode?.kind === 'evidence' ? EVIDENCE_W : FINDING_W;
          const x1 = from.x + fromWidth;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const mid = (x1 + x2) / 2;
          const stroke =
            edge.kind === 'flows' ? 'hsl(var(--muted-foreground) / 0.55)' : 'hsl(var(--muted-foreground) / 0.35)';
          return (
            <path
              key={`${edge.from}-${edge.to}-${i}`}
              d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={edge.kind === 'flows' ? 1.6 : 1.2}
              markerEnd="url(#ev-arrowhead)"
            />
          );
        })}

        {findings.slice(0, 8).map((node) => {
          const p = pos.get(node.id);
          if (!p) return null;
          const severityColor =
            node.severity === 'critical' || node.severity === 'high'
              ? '#ef4444'
              : node.severity === 'medium'
                ? '#eab308'
                : '#3b82f6';
          return (
            <g key={node.id}>
              <rect
                x={p.x}
                y={p.y}
                width={FINDING_W}
                height={NODE_H}
                rx={9}
                fill={`${severityColor}14`}
                stroke={`${severityColor}55`}
                strokeWidth={1.1}
              />
              <text x={p.x + 10} y={p.y + 15} fontSize={11.5} fontWeight={600} fill="hsl(var(--foreground))">
                {node.label.slice(0, 30)}
              </text>
              <text x={p.x + 10} y={p.y + 28} fontSize={9.5} fill="hsl(var(--muted-foreground))">
                {node.file ? `${node.file}:${node.line ?? '?'}` : ''} · {node.status}
              </text>
            </g>
          );
        })}

        {evidence.slice(0, 40).map((node) => {
          const p = pos.get(node.id);
          if (!p) return null;
          const accent = KIND_COLORS[node.subkind ?? ''] ?? '#94a3b8';
          return (
            <g key={node.id}>
              <rect
                x={p.x}
                y={p.y}
                width={EVIDENCE_W}
                height={NODE_H}
                rx={9}
                fill={`${accent}12`}
                stroke={`${accent}50`}
                strokeWidth={1}
              />
              <text x={p.x + 10} y={p.y + 15} fontSize={11} fontWeight={600} fill="hsl(var(--foreground))">
                {node.subkind?.replace('_', ' ')}
              </text>
              <text x={p.x + 10} y={p.y + 28} fontSize={9.5} fill="hsl(var(--muted-foreground))">
                {node.label.slice(0, 34)}
              </text>
            </g>
          );
        })}

        {files.slice(0, 12).map((node) => {
          const p = pos.get(node.id);
          if (!p) return null;
          return (
            <g key={node.id}>
              <rect
                x={p.x}
                y={p.y}
                width={FILE_W}
                height={NODE_H}
                rx={9}
                fill="hsl(var(--primary) / 0.08)"
                stroke="hsl(var(--primary) / 0.3)"
                strokeWidth={1}
              />
              <text x={p.x + 10} y={p.y + 22} fontSize={10.5} fontWeight={500} fill="hsl(var(--foreground))">
                {node.label.slice(0, 36)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}