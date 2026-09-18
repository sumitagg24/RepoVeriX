import Link from 'next/link';

import { FindingStateChip, SeverityChip } from '@/components/evidence';
import { formatConfidence } from '@/lib/evidence';
import { cn } from '@/lib/utils';
import type { Finding } from '@/types/api';

/**
 * FindingSummary — the sticky context rail.
 *
 * This is deliberately *not* four stat cards. A security finding's context is a
 * fixed set of attributes you scan once and then ignore, so it belongs in one
 * dense, scannable key/value block that stays in view while you read the
 * evidence on the left.
 */

function Row({
  label,
  children,
  mono = false,
  title,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-right text-xs text-foreground',
          mono && 'truncate font-mono',
        )}
        title={title}
      >
        {children}
      </dd>
    </div>
  );
}

export function FindingSummary({ finding }: { finding: Finding }) {
  const confidence = Math.round(finding.confidence * 100);
  const location = `${finding.file_path}${finding.line_start ? `:${finding.line_start}` : ''}`;

  return (
    <aside aria-label="Finding context" className="lg:sticky lg:top-20">
      <div className="rounded-xl border border-border/70 bg-card/40">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="mono-label">Context</p>
        </div>

        <dl className="divide-y divide-border/50 px-4 py-1">
          <Row label="Severity">
            <SeverityChip severity={finding.severity} />
          </Row>
          <Row label="State">
            <FindingStateChip state={finding.status} />
          </Row>
          <Row label="Detector" mono title={finding.source}>
            {finding.source}
          </Row>
          <Row label="Rule" mono>
            {finding.external_id}
          </Row>
          <Row label="File" mono title={location}>
            {location}
          </Row>
          <Row label="Function" mono title={finding.function_name ?? undefined}>
            {finding.function_name ? `${finding.function_name}()` : '—'}
          </Row>
          <Row label="Lines">
            {finding.line_start
              ? `${finding.line_start}${finding.line_end && finding.line_end !== finding.line_start ? `–${finding.line_end}` : ''}`
              : '—'}
          </Row>
          <Row label="First detected">
            {new Date(finding.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Row>
          <Row label="Last analyzed">
            {new Date(finding.updated_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Row>
        </dl>

        {/* Confidence is a bounded quantity, so it gets a scale rather than a
            bare number — the number alone reads as precision that may not be
            there. */}
        <div className="border-t border-border/60 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <p className="mono-label">Confidence</p>
            <p className="font-mono text-xs tabular-nums">{formatConfidence(finding.confidence)}</p>
          </div>
          <div
            className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Detector confidence ${confidence} percent`}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${confidence}%` }} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Reported by the detector. The verdict below comes from evidence, not this number.
          </p>
        </div>

        <div className="border-t border-border/60 px-4 py-3">
          <Link
            href={`/scans/${finding.scan_id}`}
            className="font-mono text-[11px] text-muted-foreground underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
          >
            scan {finding.scan_id.slice(0, 8)}
          </Link>
        </div>
      </div>
    </aside>
  );
}
