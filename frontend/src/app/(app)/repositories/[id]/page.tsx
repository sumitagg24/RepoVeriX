'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Boxes,
  GitBranch,
  History,
  Network,
  Play,
  RefreshCw,
  Route,
  ShieldAlert,
  Wrench,
} from 'lucide-react';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FindingTable, SeverityTally } from '@/components/findings/finding-table';
import { ScanTable } from '@/components/scans/scan-table';
import { Badge, ProviderBadge, RepoStateBadge, SeverityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { DetailList, DetailRow, Metric, MetricStrip } from '@/components/ui/metric';
import { PathValue } from '@/components/ui/misc';
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  SkeletonTable,
  SkeletonText,
} from '@/components/ui/states';
import { useFindings } from '@/hooks/use-findings';
import {
  useAttackPaths,
  useDependencyReachability,
  useRepository,
  useRepositoryIntelligence,
} from '@/hooks/use-repositories';
import { useScans } from '@/hooks/use-scans';
import { REPOSITORY_STATUS_LABEL, languageList, repositoryStatusTone } from '@/lib/domain';
import { absoluteTime, relativeTime } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { toApiFailure } from '@/services/api';

/**
 * Repository detail.
 *
 * The repository is where a security lead actually works, so this page is the
 * repository's security posture in one screen: how it was imported, what the
 * latest scan said, what is outstanding, and what the analyser has learned about
 * its structure. Analysis sections that the backend has not produced yet are
 * labelled as such rather than hidden, because "not computed" and "nothing found"
 * are different answers.
 */
export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : undefined;

  const repository = useRepository(id);
  const scans = useScans(id);
  const findings = useFindings({ repository_id: id, limit: 200 });
  const intelligence = useRepositoryIntelligence(id);
  const attackPaths = useAttackPaths(id);
  const dependencies = useDependencyReachability(id);

  const data = repository.data;
  const languages = languageList(data?.primary_languages ?? []);

  const severityCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    (findings.data ?? []).forEach((finding) => {
      counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
    });
    return counts;
  }, [findings.data]);

  const openFindings = React.useMemo(
    () => (findings.data ?? []).filter((finding) => finding.status !== 'rejected').length,
    [findings.data],
  );

  const latestScan = scans.data?.[0];
  const reachableDependencies = React.useMemo(
    () => (dependencies.data?.vulnerable_packages ?? []).filter((item) => item.reachable),
    [dependencies.data],
  );

  const intelligenceReady = intelligence.data?.status === 'ready';

  if (repository.isLoading) {
    return (
      <AppPage>
        <LoadingRegion label="Loading repository">
          <div className="space-y-4">
            <SkeletonText lines={3} />
            <SkeletonTable rows={5} columns={4} />
          </div>
        </LoadingRegion>
      </AppPage>
    );
  }

  if (repository.isError || !data) {
    const failure = repository.error ? toApiFailure(repository.error) : null;
    return (
      <AppPage>
        <ErrorState
          title={failure?.status === 404 ? 'That repository is not connected' : 'Could not load this repository'}
          body={
            failure?.status === 404
              ? 'It was removed, or it belongs to another account. Connected repositories are listed in one place.'
              : 'The repositories endpoint did not answer for this id. Try again, or return to the list.'
          }
          detail={failure?.message}
          onRetry={() => void repository.refetch()}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/repositories">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                All repositories
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
        crumbs={[{ href: '/repositories', label: 'Repositories' }, { label: data.name }]}
        title={data.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
            <span className="flex items-center gap-1.5">
              <GitBranch className="size-3.5" aria-hidden="true" />
              <span className="font-mono text-[12.5px]">{data.default_branch}</span>
            </span>
            <span>{data.source_url ?? 'Imported without a source URL'}</span>
          </span>
        }
        meta={
          <>
            <RepoStateBadge state={data.status} />
            <ProviderBadge provider={data.source_type} />
            {languages.map((language) => (
              <span key={language} className="chip">
                {language}
              </span>
            ))}
            {data.last_scan_at ? (
              <span className="text-[12.5px] text-muted">
                Last scanned{' '}
                <span title={absoluteTime(data.last_scan_at)}>{relativeTime(data.last_scan_at)}</span>
              </span>
            ) : (
              <span className="text-[12.5px] text-muted">Never scanned</span>
            )}
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void repository.refetch()}
              loading={repository.isFetching}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </Button>
            <Button asChild size="sm" variant="primary">
              <Link href={`/scans/new?repository=${data.id}`}>
                <Play className="size-3.5" aria-hidden="true" />
                New scan
              </Link>
            </Button>
          </>
        }
      />

      {data.status === 'error' ? (
        <Callout tone="critical" title="The last import did not finish">
          <p className="text-[13px] leading-relaxed">
            {REPOSITORY_STATUS_LABEL[data.status]} — the snapshot may be incomplete, so scan results
            from this repository are worth reading with that in mind. Re-importing creates a new
            snapshot without touching anything the engine has already recorded.
          </p>
        </Callout>
      ) : null}

      <MetricStrip>
        <Metric
          label="Open findings"
          value={formatNumber(openFindings)}
          hint="Everything except findings whose evidence was rejected, across all scans."
          tone={severityCounts.critical || severityCounts.high ? 'critical' : 'neutral'}
        />
        <Metric
          label="Critical and high"
          value={formatNumber((severityCounts.critical ?? 0) + (severityCounts.high ?? 0))}
          hint="The rows a reviewer should read first."
          tone={severityCounts.critical ? 'critical' : 'neutral'}
        />
        <Metric
          label="Scans recorded"
          value={formatNumber((scans.data ?? []).length)}
          hint={latestScan ? `Latest ${relativeTime(latestScan.created_at)}` : 'No scan yet'}
        />
        <Metric
          label="Files scored"
          value={intelligenceReady ? formatNumber(intelligence.data?.health.files_scored ?? 0) : '—'}
          hint={
            intelligenceReady
              ? 'Structure analysis completed for this snapshot.'
              : 'Structure analysis has not been computed for this repository yet.'
          }
        />
      </MetricStrip>

      <Panel>
        <PanelHeader
          title="Findings"
          hint="Recorded against this repository, newest scans first."
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link href={`/findings?repository=${data.id}`}>Open in findings</Link>
            </Button>
          }
        />
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <SeverityTally bySeverity={severityCounts} />
          {findings.isLoading ? <SkeletonTable rows={5} columns={6} /> : null}
          {findings.isError ? (
            <ErrorState
              title="Could not load this repository's findings"
              body="The findings endpoint did not answer for this repository."
              onRetry={() => void findings.refetch()}
            />
          ) : null}
          {!findings.isLoading && !findings.isError && (findings.data ?? []).length === 0 ? (
            <EmptyState
              title="No findings recorded for this repository"
              body="Findings appear once a scan completes. If nothing has run yet, start a scan; if something has, this snapshot produced no claims."
              action={
                <Button asChild size="sm" variant="primary">
                  <Link href={`/scans/new?repository=${data.id}`}>Start a scan</Link>
                </Button>
              }
            />
          ) : null}
          {!findings.isLoading && !findings.isError && (findings.data ?? []).length > 0 ? (
            <FindingTable findings={(findings.data ?? []).slice(0, 25)} emptyLabel="findings" />
          ) : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Scan history"
          hint="Every scan run against this repository, most recent first."
          icon={<History className="size-4" aria-hidden="true" />}
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link href={`/scans?repository=${data.id}`}>All scans</Link>
            </Button>
          }
        />
        <div className="px-5 py-5 sm:px-6">
          {scans.isLoading ? <SkeletonTable rows={4} columns={5} /> : null}
          {scans.isError ? (
            <ErrorState
              title="Could not load the scan history"
              body="The scans endpoint did not answer for this repository."
              onRetry={() => void scans.refetch()}
            />
          ) : null}
          {!scans.isLoading && !scans.isError && (scans.data ?? []).length === 0 ? (
            <EmptyState
              title="No scans recorded"
              body="A repository is just a snapshot until a scan runs against it. The first scan writes the baseline everything later is compared to."
              action={
                <Button asChild size="sm" variant="primary">
                  <Link href={`/scans/new?repository=${data.id}`}>Start the first scan</Link>
                </Button>
              }
            />
          ) : null}
          {!scans.isLoading && !scans.isError && (scans.data ?? []).length > 0 ? (
            <ScanTable scans={(scans.data ?? []).slice(0, 8)} />
          ) : null}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Structure and health"
            hint="What the analyser learned about this snapshot beyond individual findings."
            icon={<Boxes className="size-4" aria-hidden="true" />}
          />
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {intelligence.isLoading ? <SkeletonText lines={4} /> : null}
            {intelligence.isError ? (
              <p className="text-[13px] leading-relaxed text-muted">
                Structure analysis could not be read for this repository. It is computed on demand,
                so a repository that has never been analysed returns nothing here.
              </p>
            ) : null}
            {intelligence.data ? (
              intelligenceReady ? (
                <>
                  <DetailList>
                    <DetailRow label="Average file score">
                      <span className="font-mono text-[12.5px]">
                        {intelligence.data.health.average_score ?? 'not scored'}
                      </span>
                    </DetailRow>
                    <DetailRow label="Files scored">
                      {formatNumber(intelligence.data.health.files_scored)}
                    </DetailRow>
                    <DetailRow label="Detectors applied">
                      {formatNumber(intelligence.data.health.detector_count)}
                    </DetailRow>
                    <DetailRow label="Module groups">
                      {formatNumber(intelligence.data.architecture.nodes.length)}
                    </DetailRow>
                    <DetailRow label="Git history">
                      {intelligence.data.git.available
                        ? `${formatNumber(intelligence.data.git.commits_analyzed ?? 0)} commits · ${formatNumber(
                            intelligence.data.git.authors ?? 0,
                          )} authors`
                        : (intelligence.data.git.reason ?? 'not available for this snapshot')}
                    </DetailRow>
                  </DetailList>

                  {intelligence.data.health.refactor_targets.length > 0 ? (
                    <div>
                      <h3 className="mb-2 text-[12.5px] font-medium text-ink">
                        Where the complexity sits
                      </h3>
                      <ul className="space-y-2">
                        {intelligence.data.health.refactor_targets.slice(0, 5).map((target) => (
                          <li key={target.path} className="flex items-baseline justify-between gap-3">
                            <PathValue path={target.path} />
                            <span className="shrink-0 font-mono text-[11.5px] text-muted">
                              score {target.score}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted">
                      No file scored badly enough to be flagged as a refactor target.
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <Badge tone="neutral">{intelligence.data.status}</Badge>
                  <p className="text-[13px] leading-relaxed text-muted">
                    {intelligence.data.error ??
                      'Structure analysis is queued or running for this snapshot. Nothing is claimed until it completes.'}
                  </p>
                  {intelligence.data.generated_at ? (
                    <p className="text-[12.5px] text-muted">
                      Last computed{' '}
                      <span title={absoluteTime(intelligence.data.generated_at)}>
                        {relativeTime(intelligence.data.generated_at)}
                      </span>
                    </p>
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Paths and dependencies"
            hint="Reachability the engine recorded, where it has been computed."
            icon={<Network className="size-4" aria-hidden="true" />}
          />
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-ink">
                <Route className="size-3.5" aria-hidden="true" />
                Attack paths
              </h3>
              {attackPaths.isLoading ? <SkeletonText lines={3} /> : null}
              {attackPaths.isError ? (
                <p className="text-[13px] leading-relaxed text-muted">
                  No path analysis is available for this repository yet.
                </p>
              ) : null}
              {attackPaths.data ? (
                attackPaths.data.paths.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-muted">
                    No entry-to-sink path was recorded. That means the analyser found none in this
                    snapshot, not that the repository is safe.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {attackPaths.data.paths.slice(0, 6).map((path) => (
                      <li key={path.id} className="border-t border-hairline pt-3 first:border-t-0 first:pt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={path.severity} compact />
                          <span className="text-[13px] text-ink">
                            {path.entry_point} → {path.sink}
                          </span>
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                          {path.steps.join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-ink">
                <ShieldAlert className="size-3.5" aria-hidden="true" />
                Vulnerable dependencies reached by code
              </h3>
              {dependencies.isLoading ? <SkeletonText lines={3} /> : null}
              {dependencies.isError ? (
                <p className="text-[13px] leading-relaxed text-muted">
                  Dependency reachability has not been computed for this repository.
                </p>
              ) : null}
              {dependencies.data ? (
                reachableDependencies.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-muted">
                    {dependencies.data.vulnerable_packages.length === 0
                      ? 'No vulnerable package was recorded for this snapshot.'
                      : `${dependencies.data.vulnerable_packages.length} vulnerable package${
                          dependencies.data.vulnerable_packages.length === 1 ? ' was' : 's were'
                        } recorded, but none is reached from application code.`}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {reachableDependencies.map((item) => (
                      <li
                        key={`${item.name}-${item.version}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline pt-2 first:border-t-0 first:pt-0"
                      >
                        <span className="font-mono text-[12.5px] text-body">
                          {item.name}@{item.version}
                        </span>
                        <span className="flex items-center gap-2">
                          <SeverityBadge severity={item.severity} compact />
                          <span className="text-[12px] text-muted">
                            {item.dependents.length} dependent
                            {item.dependents.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Import record"
          hint="How this snapshot entered RepoVeriX, and what the engine holds for it."
          icon={<Wrench className="size-4" aria-hidden="true" />}
        />
        <div className="px-5 py-5 sm:px-6">
          <DetailList>
            <DetailRow label="Source">{data.source_type}</DetailRow>
            <DetailRow label="Source URL">
              {data.source_url ? (
                <span className="break-all font-mono text-[12px]">{data.source_url}</span>
              ) : (
                <span className="text-muted">Not recorded</span>
              )}
            </DetailRow>
            <DetailRow label="Default branch">
              <span className="font-mono text-[12.5px]">{data.default_branch}</span>
            </DetailRow>
            <DetailRow label="Connection">
              <Badge tone={repositoryStatusTone(data.status)}>
                {REPOSITORY_STATUS_LABEL[data.status] ?? data.status}
              </Badge>
            </DetailRow>
            <DetailRow label="Added">
              <span title={absoluteTime(data.created_at)}>{relativeTime(data.created_at)}</span>
            </DetailRow>
            <DetailRow label="Last scan">
              {data.last_scan_at ? (
                <span title={absoluteTime(data.last_scan_at)}>{relativeTime(data.last_scan_at)}</span>
              ) : (
                <span className="text-muted">Never</span>
              )}
            </DetailRow>
            <DetailRow label="Storage">
              <span className="break-all font-mono text-[11.5px] text-muted">
                {data.storage_path ?? 'not reported'}
              </span>
            </DetailRow>
          </DetailList>
        </div>
      </Panel>
    </AppPage>
  );
}
