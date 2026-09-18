'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ScanSearch, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FindingTable, SeverityTally } from '@/components/findings/finding-table';
import { ScanTable } from '@/components/scans/scan-table';
import { ProviderBadge, RepoStateBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, OutcomeSummary } from '@/components/ui/charts';
import { ConfirmDialog } from '@/components/ui/dialog';
import { DetailList, DetailRow, Metric, MetricStrip } from '@/components/ui/metric';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { CopyableValue } from '@/components/ui/misc';
import { EmptyState, ErrorState, LoadingRegion, SkeletonTable } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';
import { useDeleteRepository, useRepositories, useRepository, useRepositoryIntelligence } from '@/hooks/use-repositories';
import { useFindings } from '@/hooks/use-findings';
import { useScans } from '@/hooks/use-scans';
import { absoluteTime, relativeTime } from '@/lib/dates';
import { languageList, SOURCE_TYPE_LABEL } from '@/lib/domain';
import { formatNumber, truncate } from '@/lib/format';

/**
 * Repository detail.
 *
 * One repository, four questions: how bad is it, what ran against it, what is
 * still open in it, and what does the code look like structurally. The
 * intelligence tab reads the repository intelligence endpoint, which is
 * generated analysis rather than a fresh clone, and it says so when the report
 * is not there yet.
 */
export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const repository = useRepository(id);
  const intelligence = useRepositoryIntelligence(id);
  const scans = useScans(id);
  const findings = useFindings({ repository_id: id, limit: 200 });
  const deleteRepository = useDeleteRepository();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const severityCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    (findings.data ?? []).forEach((finding) => {
      counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
    });
    return counts;
  }, [findings.data]);

  const statusCounts = React.useMemo(() => {
    const counts = { verified: 0, probable: 0, rejected: 0 };
    (findings.data ?? []).forEach((finding) => {
      if (finding.status in counts) counts[finding.status as keyof typeof counts] += 1;
    });
    return counts;
  }, [findings.data]);

  if (repository.isError) {
    return (
      <AppPage>
        <PageHeader title="Repository" crumbs={[{ href: '/repositories', label: 'Repositories' }]} />
        <ErrorState
          title="This repository could not be loaded"
          body="It may have been deleted, or the id belongs to another workspace."
          onRetry={() => void repository.refetch()}
        />
      </AppPage>
    );
  }

  if (repository.isLoading || !repository.data) {
    return (
      <AppPage>
        <PageHeader title="Repository" crumbs={[{ href: '/repositories', label: 'Repositories' }]} />
        <LoadingRegion label="Loading repository">
          <SkeletonTable rows={4} columns={4} />
        </LoadingRegion>
      </AppPage>
    );
  }

  const repo = repository.data;
  const languages = languageList(repo.primary_languages);

  return (
    <AppPage>
      <PageHeader
        title={repo.name}
        crumbs={[
          { href: '/repositories', label: 'Repositories' },
          { label: repo.name },
        ]}
        description={`Imported from ${SOURCE_TYPE_LABEL[repo.source_type] ?? repo.source_type} on the ${repo.default_branch} branch.`}
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remove
            </Button>
            <Button asChild size="sm" variant="primary">
              <Link href="/scans/new">
                <ScanSearch className="size-3.5" aria-hidden="true" />
                Scan this repository
              </Link>
            </Button>
          </>
        }
        meta={
          <>
            <RepoStateBadge state={repo.status} />
            <ProviderBadge provider={repo.source_type} />
            <span className="font-mono text-[12px] text-muted">{repo.default_branch}</span>
            {languages.length > 0 ? <span className="text-[12px] text-muted">{languages.join(', ')}</span> : null}
            <span className="text-[12px] text-muted" title={absoluteTime(repo.updated_at)}>
              updated {relativeTime(repo.updated_at)}
            </span>
          </>
        }
      />

      <MetricStrip>
        <Metric
          label="Scans run"
          value={formatNumber((scans.data ?? []).length)}
          hint={
            scans.data && scans.data.length > 0
              ? `Most recent ${relativeTime(scans.data[0].created_at)}`
              : 'Never scanned'
          }
        />
        <Metric
          label="Findings"
          value={formatNumber((findings.data ?? []).length)}
          hint={`${severityCounts.critical ?? 0} critical, ${severityCounts.high ?? 0} high`}
          tone="critical"
        />
        <Metric
          label="Verified or probable"
          value={formatNumber(statusCounts.verified + statusCounts.probable)}
          hint={`${statusCounts.rejected} rejected by validation`}
          tone="verified"
        />
        <Metric
          label="Files scored"
          value={
            intelligence.data ? formatNumber(intelligence.data.health.files_scored) : 'Not yet'
          }
          hint={
            intelligence.data?.health.average_score != null
              ? `Average health ${intelligence.data.health.average_score.toFixed(1)}`
              : 'Repository intelligence has not been generated'
          }
        />
      </MetricStrip>

      <Tabs defaultValue="posture" className="space-y-6">
        <TabsList label="Repository sections">
          <TabsTrigger value="posture">Posture</TabsTrigger>
          <TabsTrigger value="scans" count={scans.data?.length}>
            Scans
          </TabsTrigger>
          <TabsTrigger value="findings" count={findings.data?.length}>
            Findings
          </TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="posture" className="space-y-6">
          {(findings.data ?? []).length === 0 ? (
            <EmptyState
              icon={<ScanSearch className="size-4" aria-hidden="true" />}
              title="No findings for this repository yet"
              body="Posture is assembled from completed scans. Run one to see severity distribution and verdict counts here."
              action={
                <Button asChild size="sm" variant="primary">
                  <Link href="/scans/new">Start a scan</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel>
                <PanelHeader title="Severity distribution" hint="Across every scan of this repository." />
                <div className="px-5 py-5 sm:px-6">
                  <SeverityTally bySeverity={severityCounts} />
                </div>
              </Panel>
              <Panel>
                <PanelHeader
                  title="Validation outcome"
                  hint="What evidence validation recorded for each claim."
                />
                <div className="px-5 py-5 sm:px-6">
                  <OutcomeSummary
                    verified={statusCounts.verified}
                    probable={statusCounts.probable}
                    rejected={statusCounts.rejected}
                  />
                </div>
              </Panel>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scans" className="space-y-4">
          {scans.isLoading ? <SkeletonTable rows={4} columns={5} /> : null}
          {!scans.isLoading && (scans.data ?? []).length === 0 ? (
            <EmptyState
              title="This repository has not been scanned"
              body="A scan reads the stored snapshot, so a large repository does not need to be cloned again."
              action={
                <Button asChild size="sm" variant="primary">
                  <Link href="/scans/new">Start a scan</Link>
                </Button>
              }
            />
          ) : (
            <ScanTable scans={scans.data ?? []} repositoryName={() => repo.name} />
          )}
        </TabsContent>

        <TabsContent value="findings" className="space-y-4">
          {findings.isLoading ? <SkeletonTable rows={6} columns={6} /> : null}
          {!findings.isLoading && (findings.data ?? []).length === 0 ? (
            <EmptyState
              title="No findings recorded in this repository"
              body="Either no scan has run, or the scans that did produced no claims for this snapshot."
            />
          ) : (
            <FindingTable findings={findings.data ?? []} repositoryFor={() => repo.name} />
          )}
        </TabsContent>

        <TabsContent value="intelligence" className="space-y-6">
          {intelligence.isLoading ? <LoadingRegion label="Loading repository intelligence" /> : null}

          {intelligence.isError || intelligence.data?.status === 'failed' ? (
            <Callout tone="info" title="Repository intelligence is not available">
              It is generated by a background pass over the parsed repository.{' '}
              {intelligence.data?.error
                ? `The last attempt reported: ${truncate(intelligence.data.error, 160)}`
                : 'Run a scan first, then reload this page.'}
            </Callout>
          ) : null}

          {intelligence.data && intelligence.data.status !== 'failed' ? (
            <>
              <Panel>
                <PanelHeader
                  title="File health"
                  hint={`${formatNumber(intelligence.data.health.files_scored)} files scored by ${formatNumber(
                    intelligence.data.health.detector_count,
                  )} detectors.`}
                />
                <div className="px-5 py-5 sm:px-6">
                  {intelligence.data.health.worst_files.length > 0 ? (
                    <BarChart
                      label="Files with the lowest health score"
                      data={intelligence.data.health.worst_files.map((path) => ({
                        label: truncate(path.split('/').pop() ?? path, 18),
                        value:
                          intelligence.data?.health.files.find((file) => file.path === path)?.score ?? 0,
                        tone: 'critical',
                      }))}
                    />
                  ) : (
                    <p className="text-[13px] text-muted">No file scored low enough to list.</p>
                  )}

                  {intelligence.data.health.refactor_targets.length > 0 ? (
                    <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
                      {intelligence.data.health.refactor_targets.map((target) => (
                        <li key={target.path} className="py-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="font-mono text-[12.5px] text-ink">{target.path}</span>
                            <span data-numeric className="font-mono text-[12px] text-muted">
                              score {target.score}
                            </span>
                          </div>
                          {target.issues.length > 0 ? (
                            <ul className="mt-2 space-y-1.5">
                              {target.issues.map((issue) => (
                                <li key={`${target.path}-${issue.detector}-${issue.title}`} className="text-[12.5px] leading-relaxed text-body">
                                  <span className="text-muted">{issue.lens.replace(/_/g, ' ')}: </span>
                                  {issue.title}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Panel>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel>
                  <PanelHeader
                    title="Git insights"
                    hint="Churn, hotspots and bus factor from the repository history."
                  />
                  <div className="px-5 py-5 sm:px-6">
                    {intelligence.data.git.available === false ? (
                      <p className="text-[13px] leading-relaxed text-muted">
                        {intelligence.data.git.reason ??
                          'History analysis is not available for this repository.'}
                      </p>
                    ) : (
                      <>
                        <DetailList className="border-t border-hairline">
                          <DetailRow label="Commits analysed">
                            {formatNumber(intelligence.data.git.commits_analyzed ?? 0)}
                          </DetailRow>
                          <DetailRow label="Authors">
                            {formatNumber(intelligence.data.git.authors ?? 0)}
                          </DetailRow>
                          <DetailRow label="Commits in 30 days">
                            {formatNumber(intelligence.data.git.commits_last_30d ?? 0)}
                          </DetailRow>
                        </DetailList>
                        {(intelligence.data.git.hotspots ?? []).length > 0 ? (
                          <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
                            {(intelligence.data.git.hotspots ?? []).slice(0, 6).map((file) => (
                              <li key={file.path} className="flex items-center justify-between gap-3 py-2.5">
                                <span className="min-w-0 truncate font-mono text-[12px] text-ink">
                                  {file.path}
                                </span>
                                <span data-numeric className="shrink-0 font-mono text-[11.5px] text-muted">
                                  {file.hotspot_score.toFixed(1)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    )}
                  </div>
                </Panel>

                <Panel>
                  <PanelHeader
                    title="Structure"
                    hint="Modules, the files they hold and how they depend on each other."
                  />
                  <div className="px-5 py-5 sm:px-6">
                    {intelligence.data.architecture.nodes.length === 0 ? (
                      <p className="text-[13px] text-muted">
                        No module graph was produced for this repository.
                      </p>
                    ) : (
                      <>
                        <ul className="divide-y divide-hairline border-t border-hairline">
                          {intelligence.data.architecture.nodes.slice(0, 8).map((node) => (
                            <li key={node.id} className="flex items-center justify-between gap-3 py-2.5">
                              <span className="min-w-0 truncate font-mono text-[12.5px] text-ink">
                                {node.label}
                              </span>
                              <span className="shrink-0 font-mono text-[11.5px] text-muted">
                                {node.files} files · {node.symbols} symbols
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 text-[12.5px] text-muted">
                          {formatNumber(intelligence.data.architecture.edges.length)} dependency edges
                          recorded between {formatNumber(intelligence.data.architecture.nodes.length)} modules.
                        </p>
                      </>
                    )}
                  </div>
                </Panel>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="configuration">
          <Panel>
            <PanelHeader
              title="Import configuration"
              hint="What was recorded when this repository was imported. Editing is not supported: remove it and import again if the source changed."
            />
            <div className="px-5 py-5 sm:px-6">
              <DetailList className="border-t border-hairline">
                <DetailRow label="Source">
                  {SOURCE_TYPE_LABEL[repo.source_type] ?? repo.source_type}
                </DetailRow>
                <DetailRow label="URL">
                  {repo.source_url ? (
                    <span className="break-all font-mono text-[12px]">{repo.source_url}</span>
                  ) : (
                    'Uploaded archive'
                  )}
                </DetailRow>
                <DetailRow label="Default branch">
                  <span className="font-mono text-[12px]">{repo.default_branch}</span>
                </DetailRow>
                <DetailRow label="Snapshot path">
                  <span className="font-mono text-[12px]">{repo.storage_path ?? 'Not recorded'}</span>
                </DetailRow>
                <DetailRow label="Repository id">
                  <CopyableValue value={repo.id} label="repository id" display={repo.id.slice(0, 8)} />
                </DetailRow>
                <DetailRow label="Imported">{absoluteTime(repo.created_at)}</DetailRow>
              </DetailList>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      <div>
        <Button asChild size="sm" variant="secondary">
          <Link href="/repositories">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            All repositories
          </Link>
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remove ${repo.name}`}
        description="The repository record, its scans and its findings are removed from this workspace. The source repository is not touched."
        confirmLabel="Remove repository"
        destructive
        pending={deleteRepository.isPending}
        onConfirm={async () => {
          try {
            await deleteRepository.mutateAsync(repo.id);
            toast.success('Repository removed');
            router.push('/repositories');
          } catch {
            toast.error('The repository could not be removed.');
          }
        }}
      />
    </AppPage>
  );
}
