import * as React from 'react';
import { FileCode2, GitCommitHorizontal, Layers, ShieldCheck, Sparkles } from 'lucide-react';

import { SeverityBadge, VerdictBadge } from '@/components/ui/badge';
import { CodeExcerpt } from '@/components/ui/code';
import { DetailList, DetailRow } from '@/components/ui/metric';

/**
 * Product previews.
 *
 * These are not mock screenshots drawn with rectangles: they are the real
 * components the workspace renders (severity badges, code excerpts, evidence
 * rows), composed here with one clearly labelled sample finding. The label
 * matters — nothing in this file claims to be a customer's data.
 */
function FrameLabel({ children }: { children: React.ReactNode }) {
  return <span className="chip">{children}</span>;
}

export function ProductFrame({
  children,
  className,
  label = 'Sample finding',
  title = 'payments-api · scan 41',
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
  title?: string;
}) {
  return (
    <div className={className}>
      <div className="panel overflow-hidden shadow-raised">
        <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full bg-critical" aria-hidden="true" />
            <span className="truncate font-mono text-[11.5px] text-muted">{title}</span>
          </div>
          <FrameLabel>{label}</FrameLabel>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * A finding as the product renders it: claim, verdict, evidence chain, and the
 * flagged lines. This is the single most important thing to show, because it is
 * what "proof instead of guesswork" means in practice.
 */
export function SampleFindingPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className="px-3.5 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity="critical" />
        <VerdictBadge status="verified" />
        <span className="chip font-mono">RVX-SQLI-001</span>
        <span className="chip">Security</span>
      </div>

      <h3 className="mt-3 text-[15.5px] font-semibold leading-snug text-ink">
        Request value reaches a database execution sink
      </h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-body">
        The term comes from the query string, is interpolated into the statement, and the statement is
        executed. The chain below is the reason to believe it, not the severity label.
      </p>

      <DetailList className="mt-4 border-t border-hairline">
        <DetailRow label="Source">
          <span className="font-mono text-[12px]">request.args.get(&quot;q&quot;)</span>
        </DetailRow>
        <DetailRow label="Transformation">
          <span className="font-mono text-[12px]">f-string interpolation</span>
        </DetailRow>
        <DetailRow label="Sink">
          <span className="font-mono text-[12px]">cursor.execute(query)</span>
        </DetailRow>
        <DetailRow label="Reachability">Route handler, entry-point reachable</DetailRow>
        <DetailRow label="Confidence">
          <span data-numeric className="font-mono text-[12px]">
            0.92
          </span>
        </DetailRow>
      </DetailList>

      {!compact ? (
        <div className="mt-4">
          <CodeExcerpt
            label="app/search.py · lines 41 to 44"
            startLine={41}
            highlight={{ start: 42, end: 43 }}
            tone="critical"
            maxHeight="max-h-52"
            code={`41  def search_users(request):
42      term = request.args.get("q")
43      query = f"SELECT * FROM users WHERE name = '{term}'"
44      cursor.execute(query)`}
          />
        </div>
      ) : null}
    </div>
  );
}

const STAGES = [
  {
    label: 'Ingest',
    detail: 'Source snapshot stored, never your working copy',
    icon: Layers,
  },
  {
    label: 'Static analysis',
    detail: 'Deterministic detectors run with no provider needed',
    icon: FileCode2,
  },
  {
    label: 'Model reasoning',
    detail: 'Adds candidates and context on paid plans',
    icon: Sparkles,
  },
  {
    label: 'Evidence validation',
    detail: 'Each claim must resolve to source, transform and sink',
    icon: GitCommitHorizontal,
  },
  {
    label: 'Verification',
    detail: 'The candidate patch is executed in a sandbox',
    icon: ShieldCheck,
  },
];

/** The pipeline, shown with the same vocabulary the scan detail page uses. */
export function SamplePipeline({ className }: { className?: string }) {
  return (
    <ol className={className}>
      {STAGES.map((stage, index) => {
        const Icon = stage.icon;
        return (
          <li key={stage.label} className="relative flex gap-3 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <span className="grid size-7 shrink-0 place-items-center rounded-md border border-hairline bg-card text-muted">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              {index < STAGES.length - 1 ? (
                <span className="mt-1 w-px flex-1 bg-hairline" aria-hidden="true" />
              ) : null}
            </div>
            <div className="min-w-0 pb-1">
              <p className="text-[13.5px] font-medium text-ink">{stage.label}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{stage.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Repository row as the table renders it, for the workflow tab surfaces. */
export function SampleRepositoryRow() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="chip font-mono">github</span>
        <span className="truncate text-[13.5px] font-medium text-ink">acme/checkout-service</span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 text-[12.5px] text-muted">
        <span className="font-mono">main</span>
        <span className="text-verified">Ingested</span>
        <span data-numeric className="font-mono">
          3 findings
        </span>
      </div>
    </div>
  );
}
