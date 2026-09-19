'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Ban,
  FileDown,
  GitCompareArrows,
  Link2,
  RefreshCw,
  Share2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FindingTable } from '@/components/findings/finding-table';
import { Badge, ScanStateBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { DetailList, DetailRow, DistributionBar, ProgressBar } from '@/components/ui/metric';
import { EmptyState, ErrorState, LoadingRegion, SkeletonTable, SkeletonText } from '@/components/ui/states';
import { OutcomeSummary } from '@/components/ui/charts';
import { useFindings } from '@/hooks/use-findings';
import { useRepositories } from '@/hooks/use-repositories';
import {
  useCancelScan,
  useCreateShare,
  useRevokeShare,
  useScan,
  useScanDedup,
  useScanShares,
  useScanSummary,
} from '@/hooks/use-scans';
import { ConfirmDialog } from '@/components/ui/dialog';
import { SCAN_CONFIGURATIONS, SCAN_STATUS_LABEL, SCAN_STATUS_NOTE } from '@/lib/domain';
import { absoluteTime, duration, relativeTime } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { API_BASE, downloadArtifact, toApiFailure } from '@/services/api';

/**
 * Scan detail.
 *
 * A scan is the unit of provenance in this product, so the page answers: what
 * ran, against which snapshot, what it produced, and whether it is still
 * running. Stages come from the analysis runs the backend recorded, the finding
 * counts come from the scan summary endpoint, and every number states its
 * source — nothing here is inferred from a spinner.
 *
 * The report and SARIF buttons download through the authenticated client, since
 * the export endpoints require the same bearer token as the rest of the API.
 */
export default function ScanDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : undefined;

  const scan = useScan(id);
  const summary = useScanSummary(id);
  const dedup = useScanDedup(id);
  const shares = useScanShares(id);
  const findings = useFindings({ scan_id: id, limit: 200 });
  const repositories = useRepositories();

  const cancel = useCancelScan();
  const createShare = useCreateShare(id);
  const revokeShare = useRevokeShare(id);

  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [busyArtifact, setBusyArtifact] = React.useState<string | null>(null);

  const data = scan.data;
  const repository = React.useMemo(
    () => (data ? (repositories.data ?? []).find((item) => item.id === data.repository_id) : undefined),
    [data, repositories.data],
  );

  const running = data?.status === 'pending' || data?.status === 'running';
  const configuration = SCAN_CONFIGURATIONS.find((item) => item.value === data?.configuration);

  const severitySegments = React.useMemo(() => {
    const bySeverity = summary.data?.by_severity ?? {};
    return [
      { label: 'Critical', value: bySeverity.critical ?? 0, tone: 'critical' as const },
      { label: 'High', value: bySeverity.high ?? 0, tone: 'high' as const },
      { label: 'Medium', value: bySeverity.medium ?? 0, tone: 'medium' as const },
      { label: 'Low', value: bySeverity.low ?? 0, tone: 'low' as const },
      { label: 'Info', value: bySeverity.info ?? 0, tone: 'info' as const },
    ];
  }, [summary.data]);

  const onCancel = async () => {
    if (!id) return;
    try {
      await cancel.mutateAsync(id);
      setConfirmCancel(false);
      toast.success('Cancellation requested', {
        description: 'The worker stops after the current stage. Findings already recorded stay.',
      });
    } catch (cause) {
      toast.error('Could not cancel the scan', { description: toApiFailure(cause).message });
    }
  };

  const onDownload = async (kind: 'markdown' | 'sarif') => {
    if (!id) return;
    setBusyArtifact(kind);
    try {
      const url = kind === 'markdown' ? `${API_BASE}/scans/${id}/report?format=markdown` : `${API_BASE}/scans/${id}/sarif`;
      await downloadArtifact(url, `scan-${id.slice(0, 8)}.${kind === 'markdown' ? 'md' : 'sarif.json'}`);
    } catch (cause) {
      toast.error('Download failed', { description: toApiFailure(cause).message });
    } finally {
      setBusyArtifact(null);
    }
  };

  const onShare = async () => {
    try {
      const share = await createShare.mutateAsync(7);
      const url = share.url ? new URL(share.url, window.location.origin).toString() : share.token;
      await navigator.clipboard.writeText(url);
      toast.success('Share link created and copied', {
        description: 'The link expires in 7 days and shows the report without an account.',
      });
    } catch (cause) {
      toast.error('Could not create a share link', { description: toApiFailure(cause).message });
    }
  };

  if (scan.isLoading) {
    return (
      <AppPage>
        <LoadingRegion label="Loading scan">
          <div className="space-y-4">
            <SkeletonText lines={3} />
            <SkeletonTable rows={6} columns={5} />
          </div>
        </LoadingRegion>
      </AppPage>
    );
  }

  if (scan.isError || !data) {
    const failure = scan.error ? toApiFailure(scan.error) : null;
    return (
      <AppPage>
        <ErrorState
          title={failure?.status === 404 ? 'That scan no longer exists' : 'Could not load this scan'}
          body={
            failure?.status === 404
              ? 'Scans stay with their repository; this one was removed. The scan history has the rest.'
              : 'The scans endpoint did not answer for this id. Try again, or return to the history.'
          }
          detail={failure?.message}
          onRetry={() => void scan.refetch()}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/scans">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Scan history
              </Link>
            </Button>
          }
        />
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageHeader
        crumbs={[{ href: '/scans', label: 'Scans' }, { label: data.id.slice(0, 8) }]}
        title={
          <>
            Scan of {repository ? repository.name : 'an unknown repository'}
            {configuration ? (
              <span className="text-muted"> · {configuration.label}</span>
            ) : null}
          </>
        }
        description={
          <span className="text-muted">
            {configuration?.detail ?? 'The analysis configuration this scan ran with.'}
          </span>
        }
        meta={
          <>
            <ScanStateBadge status={data.status} />
            <span className="text-[12.5px] text-muted">
              Started{' '}
              <span title={absoluteTime(data.started_at)}>{relativeTime(data.started_at)}</span>
            </span>
            <span className="text-[12.5px] text-muted">
              Took {running ? 'so far ' : ''}
              {duration(data.started_at, data.finished_at)}
            </span>
            {summary.data ? (
              <Badge tone="neutral">{formatNumber(summary.data.total)} findings</Badge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void scan.refetch()}
              loading={scan.isFetching}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </Button>
            {running ? (
              <Button size="sm" variant="danger" onClick={() => setConfirmCancel(true)}>
                <Ban className="size-3.5" aria-hidden="true" />
                Cancel scan
              </Button>
            ) : null}
          </>
        }
      />

      {data.status === 'failed' || data.error ? (
        <Callout tone="critical" title="This scan did not finish">
          <p className="text-[13px] leading-relaxed">
            {data.error ??
              'The worker reported a failure without a message. Anything recorded before the failure is still listed below.'}
          </p>
          <p className="mt-1 text-[12.5px] opacity-90">
            Rerun it from the scan history once the cause is understood; a second attempt writes a
            new scan rather than editing this one.
          </p>
        </Callout>
      ) : null}

      {running ? (
        <Panel>
          <PanelHeader
            title="Running"
            hint={SCAN_STATUS_NOTE[data.status]}
            icon={<Activity className="size-4" aria-hidden="true" />}
          />
          <div className="space-y-3 px-5 py-5 sm:px-6">
            {typeof data.progress === 'number' ? (
              <ProgressBar
                label="Stages completed"
                value={Math.round(data.progress)}
                max={100}
                showValue
              />
            ) : (
              <p className="text-[13px] text-muted">
                The API has not reported a progress figure for this scan, so none is shown. This
                page refreshes every few seconds until it finishes.
              </p>
            )}
          </div>
        </Panel>
      ) : null}

      {summary.data ? (
        <Panel>
          <PanelHeader
            title="What this scan produced"
            hint="Counts as the API aggregated them across the scan's findings."
          />
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <DistributionBar
              segments={severitySegments}
              total={summary.data.total}
              label="Findings by severity"
            />
            <OutcomeSummary
              verified={summary.data.by_status.verified ?? 0}
              probable={summary.data.by_status.probable ?? 0}
              rejected={summary.data.by_status.rejected ?? 0}
            />
            <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-muted">
              A rejected finding is one whose evidence did not survive validation. It stays in the
              record rather than disappearing, which is why the total is not a defect count.
            </p>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Findings"
          hint="Every claim this scan recorded, with its verdict."
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link href={`/findings?scan=${data.id}`}>Open in findings</Link>
            </Button>
          }
        />
        <div className="px-5 py-5 sm:px-6">
          {findings.isLoading ? <SkeletonTable rows={5} columns={5} /> : null}
          {findings.isError ? (
            <ErrorState
              title="Could not load this scan's findings"
              body="The findings endpoint did not answer for this scan."
              onRetry={() => void findings.refetch()}
            />
          ) : null}
          {!findings.isLoading && !findings.isError && (findings.data ?? []).length === 0 ? (
            <EmptyState
              title={running ? 'Findings arrive as stages complete' : 'This scan recorded no findings'}
              body={
                running
                  ? 'Detection runs before validation, so rows appear while the scan is still working.'
                  : summary.data && summary.data.total > 0
                    ? 'The summary reports findings that the list endpoint did not return. Reload the page to reconcile the two.'
                    : 'Nothing in this snapshot matched a detector or survived model review. That is a real outcome, not an error.'
              }
            />
          ) : null}
          {!findings.isLoading && !findings.isError && (findings.data ?? []).length > 0 ? (
            <FindingTable findings={findings.data ?? []} compact />
          ) : null}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Stage record"
            hint="The stages this scan executed, in the order the worker ran them."
            icon={<GitCompareArrows className="size-4" aria-hidden="true" />}
          />
          <div className="px-5 py-5 sm:px-6">
            {(data.analysis_runs ?? []).length === 0 ? (
              <p className="text-[13px] leading-relaxed text-muted">
                No stage output was returned with this scan. Stages are recorded by the worker as it
                runs; a scan that failed before the first stage has none.
              </p>
            ) : (
              <ol className="space-y-3">
                {(data.analysis_runs ?? []).map((run) => (
                  <li key={run.id} className="border-t border-hairline pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-[13.5px] font-medium text-ink">
                        {run.stage.replace(/_/g, ' ')}
                      </span>
                      <Badge
                        tone={
                          run.status === 'completed'
                            ? 'verified'
                            : run.status === 'failed'
                              ? 'critical'
                              : 'neutral'
                        }
                      >
                        {run.status}
                      </Badge>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-[12.5px] text-muted">
                      {run.tool_name ? <span className="font-mono">{run.tool_name}</span> : null}
                      <span>{duration(run.started_at, run.finished_at)}</span>
                      {run.started_at ? (
                        <span title={absoluteTime(run.started_at)}>
                          {relativeTime(run.started_at)}
                        </span>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Export and share"
            hint="The report and SARIF export carry the same records this page shows."
            icon={<Link2 className="size-4" aria-hidden="true" />}
          />
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void onDownload('markdown')}
                loading={busyArtifact === 'markdown'}
              >
                <FileDown className="size-3.5" aria-hidden="true" />
                Markdown report
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void onDownload('sarif')}
                loading={busyArtifact === 'sarif'}
              >
                <FileDown className="size-3.5" aria-hidden="true" />
                SARIF 2.1.0
              </Button>
              <Button size="sm" onClick={() => void onShare()} loading={createShare.isPending}>
                <Share2 className="size-3.5" aria-hidden="true" />
                Create share link
              </Button>
            </div>

            <p className="text-[12.5px] leading-relaxed text-muted">
              A share link is read-only and expires. Anyone holding it can read the report without
              an account, so treat it like a credential.
            </p>

            {shares.data && shares.data.length > 0 ? (
              <DetailList className="border-t border-hairline">
                {shares.data.map((share) => (
                  <DetailRow key={share.id} label={relativeTime(share.created_at)}>
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      <span className="font-mono text-[11.5px] text-muted">
                        {share.token.slice(0, 10)}…
                      </span>
                      <span className="text-[12px] text-muted">
                        {share.expires_at ? `expires ${relativeTime(share.expires_at)}` : 'no expiry'}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Revoke this share link"
                        onClick={async () => {
                          try {
                            await revokeShare.mutateAsync(share.id);
                            toast.success('Share link revoked');
                          } catch (cause) {
                            toast.error('Could not revoke the link', {
                              description: toApiFailure(cause).message,
                            });
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </span>
                  </DetailRow>
                ))}
              </DetailList>
            ) : (
              <p className="text-[12.5px] text-muted">No share links exist for this scan.</p>
            )}

            {dedup.data ? (
              <div className="border-t border-hairline pt-3">
                <h3 className="text-[12.5px] font-medium text-ink">
                  Duplicates collapsed: {dedup.data.duplicates.length}
                </h3>
                {dedup.data.duplicates.length === 0 ? (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                    No two detectors described the same location, so no finding was merged.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {dedup.data.duplicates.map((entry) => (
                      <li key={entry.kept} className="text-[12.5px] leading-relaxed text-body">
                        <span className="font-mono text-[11.5px] text-muted">{entry.kept}</span>{' '}
                        kept against {entry.dropped.length} duplicate
                        {entry.dropped.length === 1 ? '' : 's'} — {entry.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this scan?"
        description="The worker stops after the stage it is running. Findings already recorded are kept, and the scan is marked cancelled rather than failed."
        confirmLabel="Cancel the scan"
        destructive
        pending={cancel.isPending}
        onConfirm={() => void onCancel()}
      />
    </AppPage>
  );
}
