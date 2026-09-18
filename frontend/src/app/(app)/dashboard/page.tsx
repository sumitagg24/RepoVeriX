'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Bug, GitBranch, Radar, ScanSearch, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { SEVERITIES } from '@/lib/evidence';
import { useDashboardSummary } from '@/hooks/useDashboard';
import { useRepositories } from '@/hooks/useRepositories';
import { useScans } from '@/hooks/useScans';
import { useFindings } from '@/hooks/useFindings';
import { Button } from '@/components/ui/button';
import { SeverityBadge } from '@/components/system/severity-badge';
import { VerdictBadge } from '@/components/system/verdict-badge';
import { OnboardingChecklistCard } from '@/components/app/onboarding-checklist';
import {
  ConsoleEmpty,
  ConsoleSkeleton,
  Figure,
  LedgerRow,
  Panel,
  Rule,
  StageMeter,
  StageTag,
} from '@/components/rvx/primitives';
import type { Finding, Repository, Scan } from '@/types/api';

/**
 * Overview.
 *
 * Answers five questions, in this order, with nothing between the reader and the
 * answer:
 *
 *   what is my exposure          → the figures + severity distribution
 *   what needs me right now      → the investigation queue
 *   what is the platform doing   → active analysis + verification ledger
 *   what changed                 → repository activity with last-scan recency
 *   what should I do next        → the single import/analyse action
 *
 * Deliberately absent: a grid of bordered statistic cards. The figures are
 * typographic, the queue is a ledger, and hierarchy comes from rules rather than
 * containers.
 */

function scanDuration(scan: Scan): string {
  if (!scan.started_at || !scan.finished_at) return scan.status === 'completed' ? '—' : 'in progress';
  const ms = new Date(scan.finished_at).getTime() - new Date(scan.started_at).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export default function OverviewPage() {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: reposRaw, isLoading: reposLoading } = useRepositories();
  const { data: scansRaw, isLoading: scansLoading } = useScans();
  const { data: findingsRaw, isLoading: findingsLoading } = useFindings({ limit: 60 });

  // Normalise every list-shaped payload once — a malformed response degrades to
  // an empty console instead of an error page. Memoised so the derived maps
  // below keep a stable dependency identity between renders.
  const repos = useMemo<Repository[]>(() => (Array.isArray(reposRaw) ? reposRaw : []), [reposRaw]);
  const scans = useMemo<Scan[]>(() => (Array.isArray(scansRaw) ? scansRaw : []), [scansRaw]);
  const findings = useMemo<Finding[]>(
    () => (Array.isArray(findingsRaw) ? findingsRaw : []),
    [findingsRaw]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loading = summaryLoading || reposLoading || scansLoading || findingsLoading;

  const repoName = useMemo(
    () => new Map(repos.map((repo) => [repo.id, repo.name])),
    [repos]
  );
  const scanToRepo = useMemo(
    () => new Map(scans.map((scan) => [scan.id, scan.repository_id])),
    [scans]
  );

  const activeScans = scans.filter((s) => s.status === 'running' || s.status === 'pending');

  const lastScanByRepo = useMemo(() => {
    const map = new Map<string, Scan>();
    for (const scan of scans) {
      if (!map.has(scan.repository_id)) map.set(scan.repository_id, scan);
    }
    return map;
  }, [scans]);

  const findingsByStatus = summary?.findings?.by_status ?? ({} as Record<string, number>);
  const findingsBySeverity = summary?.findings?.by_severity ?? ({} as Record<string, number>);
  const total = summary?.findings?.total ?? 0;
  const critical = findingsBySeverity.critical ?? 0;
  const high = findingsBySeverity.high ?? 0;
  const verified = findingsByStatus.verified ?? 0;
  const probable = findingsByStatus.probable ?? 0;
  const rejected = findingsByStatus.rejected ?? 0;

  // The queue is the point of this screen: open, high-consequence, not refuted.
  const queue = useMemo(
    () =>
      findings
        .filter((f) => (f.severity === 'critical' || f.severity === 'high') && f.status !== 'rejected')
        .sort((a, b) => {
          const bySeverity =
            SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
          if (bySeverity !== 0) return bySeverity;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
    [findings]
  );

  const selected = queue.find((f) => f.id === selectedId) ?? queue[0] ?? null;

  if (loading) {
    return (
      <div className="space-y-8">
        <ConsoleSkeleton rows={3} />
        <ConsoleSkeleton rows={6} />
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <p className="rvx-eyebrow">Overview</p>
          <h1 className="rvx-statement mt-2 text-3xl sm:text-4xl">
            No code under analysis yet.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            RepoVeriX works on a repository: it indexes the tree, runs the deterministic detectors,
            then traces each hit from its source through to the sink before it shows you anything.
          </p>
        </header>
        <OnboardingChecklistCard />
        <ConsoleEmpty
          title="Import your first repository"
          body="Connect GitHub or GitLab, paste a clone URL, or upload an archive. The first analysis runs server-side while you keep working."
          action={
            <Button asChild>
              <Link href="/repositories?import=1">
                Import repository
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          }
          hint="Three repositories are included on the free plan."
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ---------------------------------------------------- risk landscape */}
      <section>
        <Rule
          label="Risk landscape"
          right={
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link href="/scans/new">
                <ScanSearch className="mr-1.5 h-3 w-3" aria-hidden="true" />
                Analyze a repository
              </Link>
            </Button>
          }
        />

        <div className="mt-6 grid gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
          <div className="grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Figure value={repos.length} label="Repositories" tone="muted" />
            <Figure value={total} label="Findings" />
            <Figure
              value={critical}
              label="Critical"
              tone={critical > 0 ? 'critical' : 'muted'}
              sub={high > 0 ? `${high} high` : undefined}
            />
            <Figure value={verified} label="Verified" tone={verified > 0 ? 'verified' : 'muted'} />
          </div>

          <div className="min-w-0 lg:border-l lg:pl-12 rvx-hairline">
            <p className="rvx-eyebrow">Distribution</p>
            <div className="mt-3">
              <StageMeter counts={findingsBySeverity} />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {total === 0
                ? 'No findings recorded yet. Run an analysis to populate the queue.'
                : `${probable} awaiting confirmation, ${rejected} refuted by counter-evidence. Refuted candidates are kept — they are how detection quality is measured.`}
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- attention */}
      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Rule
            label="01 · Investigation queue"
            right={
              <span className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {queue.length} open
              </span>
            }
          />

          {queue.length === 0 ? (
            <div className="mt-4">
              <ConsoleEmpty
                title="Nothing critical is open"
                body="No unresolved critical or high findings. Run a new analysis after your next merge to keep it that way."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/findings">Browse all findings</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border rvx-hairline">
                {queue.slice(0, 8).map((finding) => {
                  const isSelected = selected?.id === finding.id;
                  return (
                    <LedgerRow
                      key={finding.id}
                      as="div"
                      columns="auto minmax(0,1fr) auto auto"
                      selected={isSelected}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(finding.id)}
                    >
                      <SeverityBadge severity={finding.severity} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">
                          {finding.title}
                        </span>
                        <span className="rvx-mono block truncate text-[10px] text-muted-foreground">
                          {finding.file_path}
                          {finding.line_start ? `:${finding.line_start}` : ''}
                          {finding.function_name ? ` · ${finding.function_name}()` : ''}
                        </span>
                      </span>
                      <span className="rvx-mono hidden truncate text-[10px] text-muted-foreground sm:block">
                        {repoName.get(scanToRepo.get(finding.scan_id) ?? '') ?? '—'}
                      </span>
                      <Link
                        href={`/findings/${finding.id}`}
                        className="rvx-mono shrink-0 text-[10px] uppercase tracking-wider text-[hsl(var(--rvx-source))] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        open
                      </Link>
                    </LedgerRow>
                  );
                })}
              </div>

              {queue.length > 8 && (
                <Link
                  href="/findings"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {queue.length - 8} more in the queue
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              )}

              {/* Inline evidence preview for the selected queue item. */}
              {selected && (
                <Panel className="mt-4 p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <SeverityBadge severity={selected.severity} variant="solid" />
                    <VerdictBadge status={selected.status} />
                    <span className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {selected.category}
                    </span>
                  </div>
                  <h3 className="rvx-title mt-3 text-base">{selected.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {selected.impact || selected.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <StageTag stage="source" />
                    <span aria-hidden="true" className="rvx-mono text-muted-foreground">
                      →
                    </span>
                    <StageTag stage="sink" />
                    <Button asChild size="sm" variant="outline" className="ml-auto h-7 text-xs">
                      <Link href={`/findings/${selected.id}`}>
                        Trace the evidence
                        <ArrowRight className="ml-1.5 h-3 w-3" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </Panel>
              )}
            </>
          )}
        </div>

        {/* ------------------------------------------- platform activity */}
        <div className="min-w-0">
          <Rule
            label="02 · Analysis & verification"
            right={
              <span className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {activeScans.length} live
              </span>
            }
          />

          <div className="mt-3 space-y-4">
            {activeScans.length > 0 ? (
              <Panel className="p-3">
                <p className="rvx-eyebrow">Running now</p>
                <div className="mt-2 space-y-2">
                  {activeScans.slice(0, 4).map((scan) => (
                    <Link
                      key={scan.id}
                      href={`/scans/${scan.id}`}
                      className="flex items-center gap-2 text-xs transition-colors hover:text-foreground"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[hsl(var(--rvx-source))]"
                        aria-hidden="true"
                      />
                      <span className="rvx-mono min-w-0 flex-1 truncate">
                        {repoName.get(scan.repository_id) ?? 'repository'}
                      </span>
                      <span className="rvx-mono shrink-0 text-[10px] uppercase text-muted-foreground">
                        {scan.configuration.replace(/_/g, ' ')}
                      </span>
                    </Link>
                  ))}
                </div>
              </Panel>
            ) : null}

            <Panel className="p-3">
              <p className="rvx-eyebrow">Verification ledger</p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Every candidate is graded by evidence, not by how plausible the patch looked.
              </p>
              <div className="mt-3 divide-y rvx-hairline">
                {(
                  [
                    { key: 'verified', count: verified, note: 'chain complete and patch survived tests' },
                    { key: 'probable', count: probable, note: 'chain partial — needs a human verdict' },
                    { key: 'rejected', count: rejected, note: 'counter-evidence found' },
                  ] as const
                ).map((row) => (
                  <div key={row.key} className="flex items-start gap-3 py-2.5">
                    <VerdictBadge status={row.key} />
                    <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                      {row.note}
                    </span>
                    <span className="rvx-num shrink-0 text-sm">{row.count}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/findings"
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Review the ledger
              </Link>
            </Panel>

            <Panel className="p-3">
              <p className="rvx-eyebrow">Recent analysis runs</p>
              <div className="mt-2 space-y-1.5">
                {scans.slice(0, 5).map((scan) => (
                  <Link
                    key={scan.id}
                    href={`/scans/${scan.id}`}
                    className="flex items-center gap-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className="rvx-mono w-14 shrink-0 uppercase">{scan.status}</span>
                    <span className="rvx-mono min-w-0 flex-1 truncate">
                      {repoName.get(scan.repository_id) ?? 'repository'}
                    </span>
                    <span className="rvx-mono shrink-0 tabular-nums">
                      {scanDuration(scan)}
                    </span>
                  </Link>
                ))}
                {scans.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No analysis runs yet.</p>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- repo activity */}
      <section>
        <Rule
          label="03 · Repository activity"
          right={
            <Link
              href="/repositories"
              className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              all {repos.length} →
            </Link>
          }
        />
        <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border rvx-hairline">
          <div
            className="rvx-row rvx-eyebrow bg-[hsl(var(--rvx-surface-2)/0.5)]"
            style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto auto' }}
          >
            <span>Repository</span>
            <span className="hidden sm:block">Languages</span>
            <span>Last run</span>
            <span className="text-right">Findings</span>
          </div>
          {repos.map((repo) => {
            const lastScan = lastScanByRepo.get(repo.id);
            const repoFindings = findings.filter(
              (f) => scanToRepo.get(f.scan_id) === repo.id
            ).length;
            return (
              <Link
                key={repo.id}
                href={`/repositories/${repo.id}`}
                className="rvx-row group"
                style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto auto' }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <GitBranch
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="truncate text-[13px] font-medium group-hover:underline">
                    {repo.name}
                  </span>
                  <span className="rvx-mono hidden shrink-0 text-[10px] uppercase text-muted-foreground md:inline">
                    {repo.source_type}
                  </span>
                </span>
                <span className="rvx-mono hidden truncate text-[10px] text-muted-foreground sm:block">
                  {repo.primary_languages?.length
                    ? repo.primary_languages.slice(0, 2).join(' · ')
                    : '—'}
                </span>
                <span className="rvx-mono text-[10px] text-muted-foreground">
                  {lastScan
                    ? formatDistanceToNow(new Date(lastScan.created_at), { addSuffix: true })
                    : 'never analysed'}
                </span>
                <span
                  className={cn(
                    'rvx-num text-right text-[13px]',
                    repoFindings === 0 && 'text-muted-foreground'
                  )}
                >
                  {repoFindings}
                </span>
              </Link>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Radar className="h-3 w-3" aria-hidden="true" />
          Findings counts here reflect the most recent {findings.length} records loaded; open a
          repository for its full history.
        </p>
      </section>

      <section className="border-t pt-6 rvx-hairline">
        <Rule label="Next step" />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/scans/new">
              <ScanSearch className="mr-2 h-4 w-4" aria-hidden="true" />
              Analyze a repository
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/findings">
              <Bug className="mr-2 h-4 w-4" aria-hidden="true" />
              Open the findings explorer
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
