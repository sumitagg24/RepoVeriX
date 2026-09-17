'use client';

import { cn } from '@/lib/utils';
import { FileCode2, ArrowDown } from 'lucide-react';

/**
 * RVX EvidenceChain — the flagship product spine.
 * Source → transformation → sink → evidence → finding, rendered as one
 * inspectable vertical chain reusing the `.chain-node` token language.
 * Every node is textual (no invented graph) and pairs position + label.
 */

export type EvidenceNode = {
  kind: string;
  label: string;
  detail?: string;
  active?: boolean;
};

export function EvidenceChain({ nodes, className }: { nodes: EvidenceNode[]; className?: string }) {
  return (
    <ol className={cn('relative space-y-0', className)} aria-label="Evidence chain">
      {nodes.map((node, i) => (
        <li key={`${node.kind}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
          {i < nodes.length - 1 && (
            <span aria-hidden="true" className="chain-line absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-px" />
          )}
          <span className={cn('chain-node', node.active && 'chain-node-active')} aria-hidden="true">
            <FileCode2 className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="mono-label">{node.kind}</p>
            <p className="mt-0.5 truncate text-sm font-medium">{node.label}</p>
            {node.detail && (
              <p className="mt-0.5 break-words font-mono text-xs text-muted-foreground">{node.detail}</p>
            )}
          </div>
          <span className="mono-label hidden shrink-0 pt-1 tabular-nums sm:block">
            {String(i + 1).padStart(2, '0')}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function EvidenceLoopStrip({ className }: { className?: string }) {
  const steps = ['Analyze', 'Evidence', 'Repair', 'Verify'];
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} aria-label="RepoVeriX loop: analyze, evidence, repair, verify">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider',
              i === 1 || i === 3
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground'
            )}
          >
            {step}
          </span>
          {i < steps.length - 1 && <ArrowDown className="h-3 w-3 rotate-[-90deg] text-muted-foreground/50" aria-hidden="true" />}
        </span>
      ))}
    </div>
  );
}
