'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useScan } from '@/hooks/useScans';
import { useFindings } from '@/hooks/useFindings';
import { useDedup } from '@/hooks/useAudit';
import { scanAuditService } from '@/services/api';
import { ShareReportButton } from '@/components/app/share-report-button';
import {
  Search,
  Loader2,
  AlertTriangle,
  Clock,
  X,
  Terminal,
  Bug,
  ArrowUpRight,
  Download,
  Layers,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { formatDuration, formatConfidence } from '@/lib/verdict';
import { useCancelScan } from '@/hooks/useScans';
import { Breadcrumbs, PageHeader } from '@/components/system/page-header';
import { ScanStatus } from '@/components/system/status';
import { SeverityChip, FindingStateChip } from '@/components/evidence';
import { CodeViewer } from '@/components/system/code';
import { EmptyState, ListSkeleton } from '@/components/ui/state';

export default function ScanDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: scan, isLoading: scanLoading, refetch: refetchScan } = useScan(id);
  const { data: findings, isLoading: findingsLoading } = useFindings({ scan_id: id, limit: 20 });
  const dedup = useDedup(scan?.status === 'completed' ? id : '');
  const cancelScan = useCancelScan();
  const [sarifBusy, setSarifBusy] = useState(false);

  const handleCancel = async () => {
    if (!confirm('Cancel this scan? Partial results are kept and remain inspectable.')) return;
    try {
      await cancelScan.mutateAsync(id);
      toast.success('Scan cancelled');
      refetchScan();
    } catch {
      toast.error('Could not cancel the scan');
    }
  };

  if (scanLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="h-20 bg-muted animate-pulse rounded" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Scans', href: '/scans' }, { label: 'Not found' }]} />
        <Card>
          <EmptyState
            icon={Terminal}
            title="Scan not found"
            body="It may have been removed, or the link is stale."
            ctaHref="/scans"
            ctaLabel="Back to scans"
          />
        </Card>
      </div>
    );
  }

  const recentFindings = findings?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Scans', href: '/scans' }, { label: scan.configuration.replaceAll('_', ' ') }]} />
      <PageHeader
        eyebrow={`Scan · ${scan.configuration.replaceAll('_', ' ')}`}
        title={scan.configuration.replace('_', ' ').toUpperCase()}
        meta={<ScanStatus status={scan.status} />}
        actions={
          <>
            {(scan.status === 'running' || scan.status === 'pending') && (
              <Button variant="outline" onClick={handleCancel} disabled={cancelScan.isPending}>
                <X className="mr-2 h-4 w-4" />
                Cancel scan
              </Button>
            )}
            {scan.status === 'completed' && (
              <Button
                variant="outline"
                disabled={sarifBusy}
                onClick={async () => {
                  setSarifBusy(true);
                  try {
                    const doc = await scanAuditService.sarif(scan.id);
                    const blob = new Blob([JSON.stringify(doc, null, 2)], {
                      type: 'application/sarif+json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `repoverix-${scan.configuration}-${scan.id.slice(0, 8)}.sarif.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('SARIF report downloaded');
                  } catch (e) {
                    toast.error('SARIF export failed');
                  } finally {
                    setSarifBusy(false);
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export SARIF
              </Button>
            )}
            {scan.status === 'completed' && <ShareReportButton scanId={scan.id} />}
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{formatDuration(scan.started_at, scan.finished_at)}</div>
            <p className="text-xs text-muted-foreground">Total scan time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Analysis Runs</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scan.analysis_runs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Pipeline stages</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Findings</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{findings?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Issues discovered</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Started</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">{scan.started_at ? formatDistanceToNow(new Date(scan.started_at), { addSuffix: true }) : 'Not started'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {scan.error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 bg-destructive/5 text-destructive">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Scan Error</p>
                <p className="text-sm mt-1">{scan.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="findings">Findings ({findings?.length || 0})</TabsTrigger>
          <TabsTrigger value="runs">Analysis Runs ({scan.analysis_runs?.length || 0})</TabsTrigger>
          <TabsTrigger value="dedup">Duplicates</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Scan Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">Scan ID</dt>
                    <dd className="font-mono text-sm break-all">{scan.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Repository ID</dt>
                    <dd className="font-mono text-sm break-all">{scan.repository_id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Configuration</dt>
                    <dd className="capitalize">{scan.configuration.replace('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Status</dt>
                    <dd>
                      <ScanStatus status={scan.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Created</dt>
                    <dd>{new Date(scan.created_at).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Started</dt>
                    <dd>{scan.started_at ? new Date(scan.started_at).toLocaleString() : 'Not started'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Finished</dt>
                    <dd>{scan.finished_at ? new Date(scan.finished_at).toLocaleString() : 'Not finished'}</dd>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <dt className="text-sm text-muted-foreground">Summary</dt>
                    <dd>
                      {scan.summary ? (
                        <CodeViewer code={JSON.stringify(scan.summary, null, 2)} language="json" maxHeight={240} />
                      ) : (
                        <p className="text-sm text-muted-foreground">No summary available</p>
                      )}
                    </dd>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <dt className="text-sm text-muted-foreground">LLM Token Usage</dt>
                    <dd>
                      {scan.llm_token_usage ? (
                        <CodeViewer code={JSON.stringify(scan.llm_token_usage, null, 2)} language="json" maxHeight={240} />
                      ) : (
                        <p className="text-sm text-muted-foreground">Not available</p>
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Button variant="outline" className="h-24 flex-col gap-2" asChild>
                  <Link href={`/findings?scan_id=${scan.id}`}>
                    <Bug className="h-8 w-8" />
                    <span>View All Findings</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" asChild>
                  <Link href={`/scans/new?repo=${scan.repository_id}`}>
                    <Search className="h-8 w-8" />
                    <span>Rescan Repository</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-24 flex-col gap-2" asChild>
                  <Link href={`/repositories/${scan.repository_id}`}>
                    <Terminal className="h-8 w-8" />
                    <span>View Repository</span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="findings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Findings</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/findings?scan_id=${scan.id}`}>View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {findingsLoading ? (
                <ListSkeleton rows={3} />
              ) : recentFindings.length === 0 ? (
                <EmptyState
                  icon={Bug}
                  title="No findings yet"
                  body={
                    scan.status === 'completed'
                      ? 'This scan completed without discovering issues — a clean run, not missing data.'
                      : 'Findings appear here as the pipeline reports them.'
                  }
                />
              ) : (
                <div className="divide-y divide-border/60">
                  {recentFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className="data-row flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <SeverityChip severity={finding.severity} />
                        <div className="min-w-0">
                          <Link href={`/findings/${finding.id}`} className="block truncate text-sm font-medium hover:text-primary">
                            {finding.title}
                          </Link>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                            {finding.file_path}:{finding.line_start || '?'} · {finding.category.replace('_', ' ')} · confidence {formatConfidence(finding.confidence)}
                          </p>
                        </div>
                      </div>
                      <FindingStateChip state={finding.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {scan.analysis_runs?.length === 0 ? (
                <EmptyState
                  icon={Terminal}
                  title="No analysis runs recorded"
                  body="Pipeline stages appear here once the scan starts executing."
                />
              ) : (
                <div className="space-y-3">
                  {scan.analysis_runs
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((run) => (
                      <div key={run.id} className="p-4 rounded-lg border">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <Terminal className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div>
                              <p className="font-medium capitalize">{run.stage.replace('_', ' ')}</p>
                              <p className="text-sm text-muted-foreground">{run.tool_name || 'No tool specified'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <ScanStatus status={run.status} />
                            <span>{run.started_at ? formatDistanceToNow(new Date(run.started_at), { addSuffix: true }) : 'Not started'}</span>
                            {run.finished_at && <span>Finished {formatDistanceToNow(new Date(run.finished_at), { addSuffix: true })}</span>}
                          </div>
                        </div>
                        {run.output && (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">View output</summary>
                            <div className="mt-2">
                              <CodeViewer code={JSON.stringify(run.output, null, 2)} language="json" maxHeight={260} />
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="dedup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-4 w-4" /> Duplicate-finding clusters
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dedup.isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Grouping findings…
                </div>
              ) : dedup.isError || !dedup.data ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Deduplication needs a completed scan with findings.
                </p>
              ) : dedup.data.cluster_count === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No duplicate clusters — every finding is unique.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {dedup.data.cluster_count} cluster(s) covering {dedup.data.duplicated_findings} of{' '}
                    {dedup.data.total_findings} findings — same location, multiple tools/rules.
                  </p>
                  {dedup.data.clusters.map((cluster, i) => (
                    <div key={i} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="outline">{cluster.size} findings</Badge>
                        <Badge variant="outline" className="font-mono text-xs">
                          {cluster.file_path}:{cluster.line_start ?? '?'}
                        </Badge>
                        <Link
                          href={`/findings/${cluster.primary_finding_id}`}
                          className="text-sm font-medium hover:text-primary ml-auto"
                        >
                          {cluster.primary_title} <ArrowUpRight className="ml-0.5 h-3.5 w-3.5 inline" />
                        </Link>
                      </div>
                        <div className="flex flex-wrap gap-2">
                          {cluster.members.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
                              <span className="font-medium">{m.title}</span>
                              {m.rule && <code className="text-muted-foreground">{m.rule}</code>}
                              <SeverityChip severity={m.severity} />
                            </div>
                          ))}
                        </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}