import * as React from 'react';
import Link from 'next/link';

import { SeverityBadge, VerdictBadge } from '@/components/ui/badge';
import { PathValue } from '@/components/ui/misc';
import { Table, TableFrame, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { CATEGORY_LABEL } from '@/lib/domain';
import { relativeTime } from '@/lib/dates';
import type { Finding } from '@/types/api';

/**
 * The findings table.
 *
 * One row per finding, ordered by what a reviewer needs: how bad it is, what it
 * claims, where it lives, and whether that claim survived validation. The title
 * is the only link in the row, so keyboard and screen-reader navigation has one
 * unambiguous target per record, and the rest of the row is dense detail.
 *
 * Columns collapse by viewport: the location and repository columns are hidden
 * below `md` and re-stated inside the title cell, so nothing is lost on a phone
 * and the table never scrolls sideways for a reader who only has the title.
 */
export function FindingTable({
  findings,
  repositoryFor,
  emptyLabel = 'findings',
  compact = false,
}: {
  findings: Finding[];
  /**
   * Resolves the finding's repository display name. Findings only carry a
   * `scan_id`, so the caller closes over the scan-to-repository map instead of
   * the table inventing a lookup.
   */
  repositoryFor?: (finding: Finding) => string | undefined;
  emptyLabel?: string;
  /** Drops the location and age columns for embedded surfaces. */
  compact?: boolean;
}) {
  return (
    <TableFrame label={`${emptyLabel.charAt(0).toUpperCase()}${emptyLabel.slice(1)}`}>
      <Table minWidth={compact ? 'min-w-[560px]' : 'min-w-[860px]'}>
        <THead>
          <TR>
            <TH width="9.5rem">Severity</TH>
            <TH>Finding</TH>
            {!compact ? <TH width="17rem">Location</TH> : null}
            {!compact ? <TH width="12rem">Repository</TH> : null}
            <TH width="10rem">Verdict</TH>
            {!compact ? (
              <TH width="8rem" align="right">
                Age
              </TH>
            ) : null}
          </TR>
        </THead>
        <TBody>
          {findings.map((finding) => {
            const repository = repositoryFor?.(finding);
            return (
              <TR key={finding.id} className="align-top">
                <TD>
                  <SeverityBadge severity={finding.severity} compact />
                </TD>
                <TD>
                  <Link
                    href={`/findings/${finding.id}`}
                    className="text-[13.5px] font-medium leading-snug text-ink transition-colors hover:text-accent"
                  >
                    {finding.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
                    <span className="font-mono">{finding.external_id}</span>
                    <span>{CATEGORY_LABEL[finding.category] ?? finding.category}</span>
                    {/* Stated here as well as in its own column: on a phone the
                        column is gone and the row still has to make sense. */}
                    <span className="md:hidden">
                      <PathValue path={finding.file_path} />
                    </span>
                  </div>
                </TD>
                {!compact ? (
                  <TD>
                    <div className="flex flex-col gap-1">
                      <PathValue path={finding.file_path} />
                      <span className="font-mono text-[11.5px] text-faint">
                        {finding.line_start
                          ? `line ${finding.line_start}${finding.line_end && finding.line_end !== finding.line_start ? `-${finding.line_end}` : ''}`
                          : 'no line recorded'}
                        {finding.function_name ? ` · ${finding.function_name}()` : ''}
                      </span>
                    </div>
                  </TD>
                ) : null}
                {!compact ? (
                  <TD>
                    {repository ? (
                      <span className="text-[13px] text-body">{repository}</span>
                    ) : (
                      <span className="text-[13px] text-faint">Unknown</span>
                    )}
                  </TD>
                ) : null}
                <TD>
                  <VerdictBadge status={finding.status} />
                </TD>
                {!compact ? (
                  <TD align="right">
                    <span className="text-[12.5px] text-muted" title={finding.created_at}>
                      {relativeTime(finding.created_at)}
                    </span>
                  </TD>
                ) : null}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
  );
}

/**
 * Severity counts as a labelled strip. Colour is carried by the badge dot; the
 * number is always present, so the strip reads in greyscale too.
 */
export function SeverityTally({
  bySeverity,
  className,
}: {
  bySeverity: Record<string, number> | undefined;
  className?: string;
}) {
  const order = ['critical', 'high', 'medium', 'low', 'info'] as const;
  const counts = bySeverity ?? {};
  return (
    <dl className={className}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {order.map((severity) => (
          <div key={severity} className="flex items-center gap-2">
            <dt>
              <SeverityBadge severity={severity} compact />
            </dt>
            <dd data-numeric className="font-mono text-[13px] text-ink">
              {counts[severity] ?? 0}
            </dd>
          </div>
        ))}
      </div>
    </dl>
  );
}
