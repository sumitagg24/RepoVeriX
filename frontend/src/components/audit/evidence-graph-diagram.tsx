'use client';

import type { EvidenceGraph } from '@/types/api';
import { asSeverity } from '@/lib/evidence';

const FINDING_W = 168;
const EVIDENCE_W = 168;
const FILE_W = 168;
const NODE_H = 36;
const COL_GAP = 96;
const ROW_GAP = 14;

/**
 * Evidence-node kind → design token.
 *
 * This used to be eight hardcoded hex values, which meant the graph ignored the
 * theme completely (its nodes stayed dark-palette on a light page) and had a
 * second colour language alongside the severity tokens. Mapping to token *names*
 * lets the attributes below compose `hsl(var(--token))` — still an inline SVG
 * value, but one that resolves from the same tokens as everything else.
 *
 * `call_relationship` is intentionally the muted hue: it is graph structure,
 * not evidence, and should not compete with the evidence nodes for attention.
 */
const KIND_TOKEN: Record<string, string> = {
  source_input: '--rvx-source',
  transformation: '--rvx-transform',
  sink: '--rvx-sink',
  static_analysis: '--rvx-patch',
  dependency: '--sev-high',
  test: '--rvx-verified',
  llm_reasoning: '--chain-node',
  call_relationship: '--sev-info',
};

const FALLBACK_TOKEN = '--muted-foreground';

function kindToken(subkind: string | null | undefined): string {
  return KIND_TOKEN[subkind ?? ''] ?? FALLBACK_TOKEN;
}

/** `hsl(var(--rvx-sink))` — a paintable colour for an SVG attribute. */
export function kindColor(subkind: string | null | undefined): string {
  return `hsl(var(${kindToken(subkind)}))`;
}

/** `hsl(var(--rvx-sink) / 0.08)` — a tinted fill or hairline stroke. */
function kindColorWithAlpha(subkind: string | null | undefined, alpha: number): string {
  return `hsl(var(${kindToken(subkind)} / ${alpha}))`;
}

/** Finding severity → its own token hue (critical/high/medium/low/info). */
function severityColor(severity: string | null | undefined): string {
  return `hsl(var(--sev-${asSeverity(severity)}))`;
}

/**
 * The legend, derived from the same map the nodes paint from. The graph page
 * renders this instead of its own hand-written key, which is how the legend and
 * the diagram previously drifted apart (the key listed six kinds; the diagram
 * painted eight).
 */
export const EVIDENCE_LEGEND: { kind: string; label: string }[] = [
  { kind: 'source_input', label: 'source input' },
  { kind: 'transformation', label: 'transformation' },
  { kind: 'sink', label: 'sink' },
  { kind: 'static_analysis', label: 'static analysis' },
  { kind: 'llm_reasoning', label: 'llm reasoning' },
  { kind: 'call_relationship', label: 'call relationship' },
  { kind: 'unknown', label: 'other evidence' },
];

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
          const accent = severityColor(node.severity);
          return (
            <g key={node.id}>
              <rect
                x={p.x}
                y={p.y}
                width={FINDING_W}
                height={NODE_H}
                rx={9}
                fill={`hsl(var(--sev-${asSeverity(node.severity)}) / 0.08)`}
                stroke={accent}
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
          return (
            <g key={node.id}>
              <rect
                x={p.x}
                y={p.y}
                width={EVIDENCE_W}
                height={NODE_H}
                rx={9}
                fill={kindColorWithAlpha(node.subkind, 0.08)}
                stroke={kindColorWithAlpha(node.subkind, 0.4)}
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