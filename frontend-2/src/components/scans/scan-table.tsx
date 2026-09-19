import * as React from 'react';
import Link from 'next/link';
import { Ban, ExternalLink } from 'lucide-react';

import { ScanStateBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableFrame, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { SCAN_STATUS_NOTE } from '@/lib/domain';
import { absoluteTime, duration, relativeTime } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import type { Scan } from '@/types/api';

/**
 * Scan history.
 *
 * Status, configuration, timing and outcome read left to right in the order a
 * person checks them: is it done, what ran, how long did it take, what came out.
 * A running scan also gets a cancel action, because a scan that is stuck on a
 * huge repository should not require the API docs to stop.
 */
export function ScanTable({
  scans,
  repositoryName,
  findingCounts,
  onCancel,
  cancelPendingId,
}: {
  scans: Scan[];
  repositoryName?: (repositoryId: string) => string | undefined;
  /** Findings per scan id, when the caller already knows them. */
  findingCounts?: Record<string, number>;
  onCancel?: (id: string) => void;
  cancelPendingId?: string | null;
}) {
  return (
    <TableFrame label="Scan history">
      <Table minWidth="min-w-[900px]">
        <THead>
          <TR>
            <TH width="11rem">Status</TH>
            <TH width="14rem">Repository</TH>
            <TH width="12rem">Configuration</TH>
            <TH width="10rem">Started</TH>
            <TH width="8rem" align="right">
              Duration
            </TH>
            <TH width="9rem" align="right">
              Findings
            </TH>
            <TH width="10rem">Opened</TH>
            <TH width="6rem" align="right">
              <span className="sr-only">Actions</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {scans.map((scan) => {
            const repository = repositoryName?.(scan.repository_id);
            const live = scan.status === 'pending' || scan.status === 'running';
            return (
              <TR key={scan.id} className="align-top">
                <TD>
                  <ScanStateBadge status={scan.status} />
                  <p className="mt-1.5 text-[11.5px] leading-snug text-faint">
                    {SCAN_STATUS_NOTE[scan.status]}
                  </p>
                </TD>
                <TD>
                  {repository ? (
                    <Link
                      href={`/repositories/${scan.repository_id}`}
                      className="text-[13.5px] text-ink transition-colors hover:text-accent"
                    >
                      {repository}
                    </Link>
                  ) : (
                    <span className="font-mono text-[12px] text-faint">
                      {scan.repository_id.slice(0, 8)}
                    </span>
                  )}
                </TD>
                <TD>
                  <span className="font-mono text-[12px] text-body">{scan.configuration}</span>
                </TD>
                <TD>
                  <span className="text-[12.5px] text-body" title={absoluteTime(scan.started_at)}>
                    {scan.started_at ? relativeTime(scan.started_at) : 'Not started'}
                  </span>
                </TD>
                <TD align="right">
                  <span data-numeric className="font-mono text-[12px] text-body">
                    {duration(scan.started_at, scan.finished_at)}
                  </span>
                </TD>
                <TD align="right">
                  {findingCounts && findingCounts[scan.id] != null ? (
                    <Link
                      href={`/findings?scan=${scan.id}`}
                      className="font-mono text-[12.5px] text-ink transition-colors hover:text-accent"
                    >
                      {formatNumber(findingCounts[scan.id])}
                    </Link>
                  ) : (
                    <span className="font-mono text-[12.5px] text-faint">Open scan</span>
                  )}
                </TD>
                <TD>
                  <span className="text-[12.5px] text-muted">
                    {scan.created_at ? relativeTime(scan.created_at) : 'None'}
                  </span>
                </TD>
                <TD align="right">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/scans/${scan.id}`}>
                        Open
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                    {live && onCancel ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCancel(scan.id)}
                        loading={cancelPendingId === scan.id}
                      >
                        <Ban className="size-3.5" aria-hidden="true" />
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
  );
}
