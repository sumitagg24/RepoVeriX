'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  Download,
  FileCode2,
  FileJson,
  Link2,
  Share2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FindingTable, SeverityTally } from '@/components/findings/finding-table';
import { Badge, ScanStateBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeExcerpt } from '@/components/ui/code';
import { DetailList, DetailRow, ProgressBar } from '@/components/ui/metric';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { CopyableValue, PathValue } from '@/components/ui/misc';
import { EmptyState, ErrorState, LoadingRegion, SkeletonTable } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';
import { ConfirmDialog } from '@/components/ui/dialog';
import { absoluteTime, duration, relativeTime } from '@/lib/dates';
import { SCAN_STATUS_NOTE, SEVERITY_LABEL, SOURCE_TYPE_LABEL } from '@/lib/domain';
import { formatNumber, shortSha } from '@/lib/format';
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
import { useFindings } from '@/hooks/use-findings';
import { scanService } from '@/services/api';
import type { Finding } from '@/types/api';

/**
 * Scan detail.
 *
 * The page a person lands on straight after starting a scan, so it has to work
 * in three states: queued, running and finished. While a scan is pending or
 * running the hook polls, the pipeline panel shows which stages reported, and
 * the findings tab explains that results arrive as stages complete.
 *
 * Exports are plain browser downloads: the endpoints set their own headers, so
 * there is no client-side file handling to get wrong.
 */
export default function ScanDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const scan = useScan(id);
  const summary = useScanSummary(id);
  const findings = useFindings({ scan_id: id, limit: 200 });
  const dedup = useScanDedup(id);
  const shares = useScanShares(id);
  const repositories = useRepositories();
  const cancelScan = useCancelScan();
  const createShare = useCreateShare(id);
  const revokeShare = useRevokeShare(id);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [pendingRevoke, setPendingRevoke] = React.useState<string | null>(null);

  const repository = repositories.data?.find((item) => item.id === scan.data?.repository_id);
  const live = scan.data?.status === 'pending' || scan.data?.status === 'running';

  const severityCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    (findings.data ?? []).forEach((finding) => {
      counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
    });
    return counts;
  }, [findings.data]);

  if (scan.isError) {
    return (
      <AppPage>
        <PageHeader title="Scan" crumbs={[{ href: '/scans', label: 'Scans' }]} />
        <ErrorState
          title="This scan could not be loaded"
          body="It may have been deleted, or the id in the URL does not belong to this workspace."
          onRetry={() => void scan.refetch()}
        />
      </AppPage>
    );
  }

  if (scan.isLoading || !scan.data) {
    return (
      <AppPage>
        <PageHeader title="Scan" crumbs={[{ href: '/scans', label: 'Scans' }]} />
        <LoadingRegion label="Loading scan">
          <SkeletonTable rows={4} columns={4} />
        </LoadingRegion>
      </AppPage>
    );
  }

  const data = scan.data;
  const runs = data.analysis_runs ?? [];
  const finishedRuns = runs.filter((run) => run.status === 'completed' || run.status === 'failed').length;

  return (
    <AppPage>
      <PageHeader
        title={repository ? `Scan of ${repository.name}` : 'Scan'}
        crumbs={[
          { href: '/scans', label: 'Scans' },
          { label: data.id.slice(0, 8) },
        ]}
        description={SCAN_STATUS_NOTE[data.status]}
        actions={
          <>
            {live ? (
              <Button
                size="sm"
                variant="secondary"
                loading={cancelScan.isPending}
                onClick={async () => {
                  try {
                    await cancelScan.mutateAsync(data.id);
                    toast.success('Scan cancelled');
                  } catch {
                    toast.error('The scan could not be cancelled.');
                  }
                }}
              >
                <Ban className="size-3.5" aria-hidden="true" />
                Cancel scan
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}>
              <Share2 className="size-3.5" aria-hidden="true" />
              Share report
            </Button>
          </>
        }
        meta={
          <>
            <ScanStateBadge status={data.status} />
            <span className="font-mono text-[12px] text-muted">{data.configuration}</span>
            <span className="text-[12px] text-muted" title={absoluteTime(data.created_at)}>
              queued {relativeTime(data.created_at)}
            </span>
            <span className="text-[12px] text-muted">
              ran for {duration(data.started_at, data.finished_at)}
            </span>
          </>
        }
      />

      {data.error ? (
        <Callout tone="critical" title="The scan reported an error">
          <span className="break-words font-mono text-[12.5px]">{data.error}</span>
        </Callout>
      ) : null}

      {live ? (
        <Panel>
          <PanelHeader
            title="In progress"
            hint="The page polls every few seconds while the scan is queued or running."
          />
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <ProgressBar
              value={finishedRuns}
              max={Math.max(runs.length, 1)}
              label={`Pipeline stages reported (${finishedRuns} of ${runs.length})`}
              showValue={false}
            />
            <p className="text-[13px] leading-relaxed text-muted">
              Findings appear as stages finish. Evidence validation runs after detection, which is
              why a claim can change verdict while the scan is still going.
            </p>
          </div>
        </Panel>
      ) : null}

      <Tabs defaultValue="findings" className="space-y-6">
        <TabsList label="Scan sections">
          <TabsTrigger value="findings" count={findings.data?.length}>
            Findings
          </TabsTrigger>
          <TabsTrigger value="pipeline" count={runs.length}>
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="duplicates" count={dedup.data?.cluster_count}>
            Duplicates
          </TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="space-y-4">
          {summary.data ? (
            <SeverityTally bySeverity={summary.data.by_severity} />
          ) : null}

          {findings.isLoading ? <SkeletonTable rows={6} columns={6} /> : null}

          {findings.isError ? (
            <ErrorState
              title="Findings could not be listed"
              body="The scan itself loaded, so this is likely a transient failure on the findings endpoint."
              onRetry={() => void findings.refetch()}
            />
          ) : null}

          {!findings.isLoading && (findings.data ?? []).length === 0 ? (
            <EmptyState
              icon={<FileCode2 className="size-4" aria-hidden="true" />}
              title={live ? 'No findings recorded yet' : 'This scan recorded no findings'}
              body={
                live
                  ? 'Detection stages are still running. Findings appear here as each one finishes.'
                  : 'For the configurations that ran, the detectors produced no chains. That is a result for this snapshot, not a statement about the repository over time.'
              }
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link href="/findings">All findings in this workspace</Link>
                </Button>
              }
            />
          ) : (
            <FindingTable
              findings={findings.data ?? []}
              repositoryFor={() => repository?.name}
            />
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          {runs.length === 0 ? (
            <EmptyState
              title="No pipeline stages recorded"
              body="Stage records are written as each analyzer starts and finishes. A scan that never started has none."
            />
          ) : (
            <ul className="space-y-4">
              {runs.map((run) => (
                <li key={run.id}>
                  <Panel>
                    <PanelHeader
                      title={run.stage}
                      hint={run.tool_name ? `Tool: ${run.tool_name}` : 'Recorded stage'}
                      actions={
                        <div className="flex items-center gap-2.5">
                          <Badge tone={run.status === 'completed' ? 'verified' : run.status === 'failed' ? 'critical' : 'info'}>
                            {run.status}
                          </Badge>
                          <span className="font-mono text-[11.5px] text-muted">
                            {duration(run.started_at, run.finished_at)}
                          </span>
                        </div>
                      }
                    />
                    <div className="px-5 py-5 sm:px-6">
                      <DetailList className="border-t border-hairline">
                        <DetailRow label="Started">{absoluteTime(run.started_at)}</DetailRow>
                        <DetailRow label="Finished">{absoluteTime(run.finished_at)}</DetailRow>
                      </DetailList>
                      {run.output ? (
                        <div className="mt-4">
                          <CodeExcerpt
                            code={JSON.stringify(run.output, null, 2)}
                            label="Stage output"
                            maxHeight="max-h-64"
                          />
                        </div>
                      ) : null}
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-4">
          {dedup.isError ? (
            <Callout tone="info" title="No duplicate report for this scan">
              Deduplication runs after detection. Static-only scans may not produce a cluster report.
            </Callout>
          ) : null}

          {dedup.data && dedup.data.cluster_count === 0 ? (
            <EmptyState
              title="No duplicate clusters"
              body={`${formatNumber(dedup.data.total_findings)} findings were compared and each one describes a distinct location.`}
            />
          ) : null}

          {dedup.data && dedup.data.cluster_count > 0 ? (
            <>
              <Callout tone="info" title={`${dedup.data.cluster_count} clusters`}>
                {formatNumber(dedup.data.duplicated_findings)} of{' '}
                {formatNumber(dedup.data.total_findings)} findings sit in a cluster that points at
                overlapping code. Fixing the primary finding in each cluster is usually the shortest
                path.
              </Callout>
              <ul className="space-y-4">
                {dedup.data.clusters.map((cluster) => (
                  <li key={`${cluster.file_path}-${cluster.line_start}`}>
                    <Panel>
                      <PanelHeader
                        title={<span className="font-mono text-[13px]">{cluster.file_path}</span>}
                        hint={`${cluster.size} findings overlap near line ${cluster.line_start ?? 'unknown'}`}
                      />
                      <div className="px-5 py-5 sm:px-6">
                        <p className="text-[13.5px] text-ink">{cluster.primary_title}</p>
                        <ul className="mt-3 divide-y divide-hairline border-t border-hairline">
                          {cluster.members.map((member) => (
                            <li key={member.id} className="py-2.5">
                              <Link
                                href={`/findings/${member.id}`}
                                className="text-[13px] text-ink transition-colors hover:text-accent"
                              >
                                {member.title}
                              </Link>
                              <p className="mt-1 font-mono text-[11.5px] text-muted">
                                {member.rule ?? 'no rule id'} · {SEVERITY_LABEL[member.severity as keyof typeof SEVERITY_LABEL] ?? member.severity}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Panel>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="exports" className="space-y-4">
          <Panel>
            <PanelHeader
              title="Download this scan"
              hint="Each export is produced by the backend from the same records this page renders."
            />
            <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 lg:grid-cols-3">
              <div>
                <Button asChild variant="secondary" className="w-full justify-start">
                  <a href={scanService.sarifUrl(data.id)}>
                    <Download className="size-4" aria-hidden="true" />
                    SARIF 2.1.0
                  </a>
                </Button>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  For code scanning dashboards that ingest SARIF.
                </p>
              </div>
              <div>
                <Button asChild variant="secondary" className="w-full justify-start">
                  <a href={scanService.reportUrl(data.id, 'markdown')}>
                    <Download className="size-4" aria-hidden="true" />
                    Markdown report
                  </a>
                </Button>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  A written report you can attach to a review or a ticket.
                </p>
              </div>
              <div>
                <Button asChild variant="secondary" className="w-full justify-start">
                  <a href={scanService.reportUrl(data.id, 'json')}>
                    <FileJson className="size-4" aria-hidden="true" />
                    JSON
                  </a>
                </Button>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  The raw finding records, for your own tooling.
                </p>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Share links"
              hint="A share link renders the report read-only for someone without an account. Revoke it when the review is over."
              actions={
                <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}>
                  <Link2 className="size-3.5" aria-hidden="true" />
                  New link
                </Button>
              }
            />
            <div className="px-5 py-5 sm:px-6">
              {(shares.data ?? []).length === 0 ? (
                <p className="text-[13px] text-muted">
                  No share links have been created for this scan.
                </p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {(shares.data ?? []).map((share) => (
                    <li key={share.share_id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <CopyableValue value={share.url} label="share link" display={share.url} />
                        <p className="mt-1.5 text-[12px] text-muted">
                          {share.view_count} view{share.view_count === 1 ? '' : 's'} ·{' '}
                          {share.expires_at ? `expires ${absoluteTime(share.expires_at)}` : 'no expiry'} ·{' '}
                          {share.revoked_at ? 'revoked' : 'active'}
                        </p>
                      </div>
                      {!share.revoked_at ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingRevoke(share.share_id)}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          Revoke
                        </Button>
                      ) : (
                        <Badge tone="rejected">Revoked</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          {repository ? (
            <Panel>
              <PanelHeader title="Scan context" hint="What the snapshot was, and what it was built from." />
              <div className="px-5 py-5 sm:px-6">
                <DetailList className="border-t border-hairline">
                  <DetailRow label="Repository">
                    <Link href={`/repositories/${repository.id}`} className="text-accent">
                      {repository.name}
                    </Link>
                  </DetailRow>
                  <DetailRow label="Provider">
                    {SOURCE_TYPE_LABEL[repository.source_type] ?? repository.source_type}
                  </DetailRow>
                  <DetailRow label="Default branch">
                    <span className="font-mono text-[12px]">{repository.default_branch}</span>
                  </DetailRow>
                  <DetailRow label="Snapshot">
                    <span className="font-mono text-[12px]">
                      {repository.storage_path ? <PathValue path={repository.storage_path} /> : 'not recorded'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Scan id">
                    <span className="font-mono text-[12px]">{shortSha(data.id, 12)}</span>
                  </DetailRow>
                </DetailList>
              </div>
            </Panel>
          ) : null}
        </TabsContent>
      </Tabs>

      <div>
        <Button asChild size="sm" variant="secondary">
          <Link href="/scans">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            All scans
          </Link>
        </Button>
      </div>

      <ConfirmDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Create a share link"
        description="The link renders this scan's report read-only for 30 days, and can be revoked at any time."
        confirmLabel="Create link"
        pending={createShare.isPending}
        onConfirm={async () => {
          try {
            const share = await createShare.mutateAsync(30);
            await navigator.clipboard?.writeText(share.url).catch(() => undefined);
            toast.success('Share link created and copied');
            setShareOpen(false);
          } catch {
            toast.error('The share link could not be created.');
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingRevoke)}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        title="Revoke this share link"
        description="Anyone holding the link loses access immediately. Existing page loads are not affected."
        confirmLabel="Revoke link"
        destructive
        pending={revokeShare.isPending}
        onConfirm={async () => {
          if (!pendingRevoke) return;
          try {
            await revokeShare.mutateAsync(pendingRevoke);
            toast.success('Share link revoked');
            setPendingRevoke(null);
          } catch {
            toast.error('The share link could not be revoked.');
          }
        }}
      />
    </AppPage>
  );
}
