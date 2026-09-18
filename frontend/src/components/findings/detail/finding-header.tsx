import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { FindingStateChip, SeverityChip } from '@/components/evidence';
import { formatConfidence } from '@/lib/evidence';
import type { Finding } from '@/types/api';
import { ArrowUpRight, Clipboard } from 'lucide-react';

/**
 * FindingHeader — the claim, stated once, with its provenance.
 *
 * The identity of a finding is: how bad (severity), how sure (confidence, from
 * what detector), where it is (file:line), and whether it was ever confirmed
 * (state). Everything else on the page is support for this line.
 */
export function FindingHeader({
  finding,
  onCopyLink,
}: {
  finding: Finding;
  onCopyLink: () => void;
}) {
  const location = `${finding.file_path}${finding.line_start ? `:${finding.line_start}` : ''}`;

  return (
    <header className="border-b border-border/70 pb-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityChip severity={finding.severity} />
        <FindingStateChip state={finding.status} />
        <span className="chip state-insufficient normal-case tracking-normal">
          detector · {finding.source}
        </span>
        <span className="mono-label">confidence {formatConfidence(finding.confidence)}</span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onCopyLink}
            aria-label="Copy link to this finding"
          >
            <Clipboard className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/scans/${finding.scan_id}`}>
              <ArrowUpRight className="mr-1.5 h-4 w-4" />
              Scan evidence
            </Link>
          </Button>
        </div>
      </div>

      <h1 className="type-page-title mt-3.5">{finding.title}</h1>

      <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs text-muted-foreground">
        <span className="text-foreground/80">{location}</span>
        {finding.function_name && (
          <>
            <span aria-hidden="true" className="text-muted-foreground/40">
              /
            </span>
            <span>{finding.function_name}()</span>
          </>
        )}
        <span aria-hidden="true" className="text-muted-foreground/40">
          /
        </span>
        <span>{finding.category.replaceAll('_', ' ')}</span>
        <span aria-hidden="true" className="text-muted-foreground/40">
          /
        </span>
        <span>{finding.external_id}</span>
      </p>
    </header>
  );
}
