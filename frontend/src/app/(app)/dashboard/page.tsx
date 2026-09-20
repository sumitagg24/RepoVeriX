'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Database,
  FileSearch,
  Plus,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import { SeverityBadge, ScanStateBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Metric, MetricStrip } from '@/components/ui/metric';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState, ErrorState, LoadingRegion } from '@/components/ui/states';
import { PathValue } from '@/components/ui/misc';
import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { DistributionBar } from '@/components/ui/metric';
import { useFindings } from '@/hooks/use-findings';
import { useBilling, useDashboardSummary, useOnboarding } from '@/hooks/use-platform';
import { useRepositories } from '@/hooks/use-repositories';
import { useScans } from '@/hooks/use-scans';
import { absoluteTime, relativeTime } from '@/lib/dates';
import { formatNumber } from '@/lib/format';

/**
 * Overview.
 *
 * The dashboard answers three questions in order: what is the posture, what
 * needs a decision today, and what changed recently. Charts are not decoration
 * here: the distribution bar is the only visualisation, and it always prints
 * the counts beside it so the numbers are readable without seeing colour.
 */
export default function DashboardPage() {
  const summary = useDashboardSummary();
  const repositories = useRepositories();
  const scans = useScans();
  const critical = useFindings({ severity: 'critical', limit: 5 });
  const high = useFindings({ severity: 'high', limit: 5 });
  const billing = useBilling();
  const onboarding = useOnboarding();

  const repositoryNames = React.useMemo(() => {
    const map = new Map<string, string>();
    (repositories.data ?? []).forEach((repository) => map.set(repository.id, repository.name));
    return map;
  }, [repositories.data]);

  const scanToRepository = React.useMemo(() => {
    const map = new Map<string, string>();
    (scans.data ?? []).forEach((scan) => map.set(scan.id, scan.repository_id));
    return map;
  }, [scans.data]);

  const attention = React.useMemo(() => {
    const rows = [...(critical.data ?? []), ...(high.data ?? [])];
    return rows
      .filter((finding) => finding.status !== 'rejected')
      .sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1))
      .slice(0, 6);
  }, [critical.data, high.data]);

  const recentScans = React.useMemo(
    () => [...(scans.data ?? [])].slice(0, 5),
    [scans.data],
  );

  const loading = summary.isLoading;
  const failed = summary.isError;

  return (
    <AppPage>
      <PageHeader
        title="Overview"
        description="Posture across every connected repository, what needs a decision, and what changed since the last scan."
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link href="/repositories/new">
                <Plus className="size-3.5" aria-hidden="true" />
                Import repository
              </Link>
            </Button>
            <Button asChild size="sm" variant="primary">
              <Link href="/scans/new">
                <ScanSearch className="size-3.5" aria-hidden="true" />
                Start a scan
              </Link>
            </Button>
          </>
        }
      />

      {failed ? (
        <ErrorState
          title="Could not load the overview"
          body="The summary endpoint did not answer. Your repositories and findings are unaffected."
          onRetry={() => void summary.refetch()}
        />
      ) : null}

      {loading ? (
        <LoadingRegion label="Loading workspace summary">
          <MetricStrip>
            <Metric label="Repositories" value="-" />
            <Metric label="Scans" value="-" />
            <Metric label="Findings" value="-" />
            <Metric label="Verified" value="-" />
          </MetricStrip>
        </LoadingRegion>
      ) : null}

      {!loading && !failed && summary.data ? (
        <MetricStrip>
          <Metric
            label="Repositories"
            value={formatNumber(summary.data.total_repositories)}
            hint={
              repositories.data && repositories.data.length > 0
                ? `Most recent: ${repositories.data[0].name}`
                : 'Nothing connected yet'
            }
            icon={<Database className="size-3.5" />}
          />
          <Metric
            label="Scans run"
            value={formatNumber(summary.data.total_scans)}
            hint={
              scans.data && scans.data.length > 0
                ? `Last started ${relativeTime(scans.data[0].created_at)}`
                : 'No scans yet'
            }
            icon={<ScanSearch className="size-3.5" />}
          />
          <Metric
            label="Findings"
            value={formatNumber(summary.data.findings.total)}
            hint={`${summary.data.findings.by_severity?.critical ?? 0} critical, ${summary.data.findings.by_severity?.high ?? 0} high`}
            tone="critical"
            icon={<ShieldAlert className="size-3.5" />}
          />
          <Metric
            label="Verified or probable"
            value={formatNumber(
              (summary.data.findings.by_status?.verified ?? 0) +
                (summary.data.findings.by_status?.probable ?? 0),
            )}
            hint={`${summary.data.findings.by_status?.rejected ?? 0} rejected by validation`}
            tone="verified"
            icon={<ShieldCheck className="size-3.5" />}
          />
        </MetricStrip>
      ) : null}

      {!loading && !failed && summary.data && summary.data.findings.total > 0 ? (
        <Panel>
          <PanelHeader
            title="Where the findings sit"
            hint="Recorded severities across every scan. Rejected findings are counted: a refutation is a result."
          />
          <div className="px-5 py-5 sm:px-6">
            <DistributionBar
              label="Findings by severity"
              segments={[
                { label: 'Critical', value: summary.data.findings.by_severity?.critical ?? 0, tone: 'critical' },
                { label: 'High', value: summary.data.findings.by_severity?.high ?? 0, tone: 'high' },
                { label: 'Medium', value: summary.data.findings.by_severity?.medium ?? 0, tone: 'medium' },
                { label: 'Low', value: summary.data.findings.by_severity?.low ?? 0, tone: 'low' },
                { label: 'Info', value: summary.data.findings.by_severity?.info ?? 0, tone: 'info' },
              ]}
            />
          </div>
        </Panel>
      ) : null}

      {onboarding.data && !onboarding.data.completed ? (
        <Callout
          tone="accent"
          title="Finish setting up your workspace"
          action={
            <Button asChild size="sm" variant="primary">
              <Link href="/onboarding">
                Continue setup
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          }
        >
          Setup is a short sequence: connect a source, pick a repository, run the first scan, then
          read the first finding. You can leave and come back at any point.
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Needs a decision"
            hint="Critical and high findings that validation did not reject."
            icon={<ShieldAlert className="size-4" />}
            actions={
              <Button asChild size="sm" variant="secondary">
                <Link href="/findings?severity=critical">
                  All findings
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            }
          />

          <div className="px-5 py-5 sm:px-6">
            {critical.isLoading || high.isLoading ? (
              <LoadingRegion label="Loading findings" />
            ) : null}

            {!critical.isLoading && !high.isLoading && attention.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="size-4" aria-hidden="true" />}
                title="Nothing critical or high is open"
                body="Either no scan has produced a critical or high finding, or every one of them was rejected by validation. Both are worth checking in the findings list."
                action={
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/findings">Review all findings</Link>
                  </Button>
                }
              />
            ) : null}

            {attention.length > 0 ? (
              <ul className="divide-y divide-hairline">
                {attention.map((finding) => {
                  const repository = repositoryNames.get(
                    scanToRepository.get(finding.scan_id) ?? '',
                  );
                  return (
                    <li key={finding.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <SeverityBadge severity={finding.severity} compact />
                        <span className="font-mono text-[11.5px] text-muted">{finding.external_id}</span>
                        <span className="text-[11.5px] text-faint" title={absoluteTime(finding.created_at)}>
                          {relativeTime(finding.created_at)}
                        </span>
                      </div>
                      <Link
                        href={`/findings/${finding.id}`}
                        className="mt-2 block text-[14px] font-medium leading-snug text-ink transition-colors hover:text-accent"
                      >
                        {finding.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted">
                        {repository ? <span>{repository}</span> : null}
                        <PathValue path={finding.file_path} />
                        {finding.line_start ? (
                          <span className="font-mono text-[11.5px]">line {finding.line_start}</span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Recent scans"
              hint="The five most recent runs, whatever their outcome."
              icon={<FileSearch className="size-4" />}
            />
            <div className="px-5 py-5 sm:px-6">
              {scans.isLoading ? <LoadingRegion label="Loading scans" /> : null}
              {!scans.isLoading && recentScans.length === 0 ? (
                <EmptyState
                  icon={<ScanSearch className="size-4" aria-hidden="true" />}
                  title="No scans yet"
                  body="A scan reads a stored snapshot of a repository and records what it found, with the evidence behind each claim."
                  action={
                    <Button asChild size="sm" variant="primary">
                      <Link href="/scans/new">Start the first scan</Link>
                    </Button>
                  }
                />
              ) : null}
              {recentScans.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {recentScans.map((scan) => (
                    <li key={scan.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link
                          href={`/scans/${scan.id}`}
                          className="text-[13.5px] font-medium text-ink transition-colors hover:text-accent"
                        >
                          {repositoryNames.get(scan.repository_id) ?? 'Repository removed'}
                        </Link>
                        <p className="mt-1 font-mono text-[11.5px] text-faint">
                          {scan.configuration} · {relativeTime(scan.created_at)}
                        </p>
                      </div>
                      <ScanStateBadge status={scan.status} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Panel>

          {billing.data ? (
            <Panel>
              <PanelHeader
                title="Plan usage"
                hint={`Period ends ${absoluteTime(billing.data.usage.period_ends_at)}.`}
              />
              <div className="px-5 py-5 sm:px-6">
                <dl className="space-y-3">
                  {[
                    {
                      label: 'Repositories',
                      used: billing.data.usage.repositories,
                      limit: billing.data.plan.max_repositories,
                    },
                    {
                      label: 'Scans this period',
                      used: billing.data.usage.scans_used,
                      limit: billing.data.plan.scans_per_month,
                    },
                    {
                      label: 'Fix generations',
                      used: billing.data.usage.fixes_used,
                      limit: billing.data.plan.fixes_per_month,
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-4">
                      <dt className="text-[13px] text-body">{row.label}</dt>
                      <dd data-numeric className="font-mono text-[12.5px] text-ink">
                        {formatNumber(row.used)} / {formatNumber(row.limit)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 border-t border-hairline pt-4">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/billing">
                      Review plan and limits
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </AppPage>
  );
}
