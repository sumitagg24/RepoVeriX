'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardSummary } from '@/hooks/useDashboard';
import { OnboardingChecklistCard } from '@/components/app/onboarding-checklist';
import { useRepositories } from '@/hooks/useRepositories';
import { useScans } from '@/hooks/useScans';
import { useFindings } from '@/hooks/useFindings';
import {
  GitBranch,
  ScanSearch,
  Bug,
  ArrowUpRight,
  Loader2,
  Plus,
  ShieldCheck,
  ShieldAlert,
  FileSearch,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  FlaskConical,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Finding, Repository, Scan } from '@/types/api';
import { cn } from '@/lib/utils';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;
const SEVERITY_BAR: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
  info: 'bg-muted-foreground/50',
};
const SEVERITY_CHIP: Record<string, string> = {
  critical: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  high: 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  medium: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  info: 'bg-muted text-muted-foreground border-border',
};
const STATUS_CHIP: Record<string, string> = {
  verified: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  probable: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rejected: 'bg-muted text-muted-foreground border-border',
};
const SCAN_CHIP: Record<string, string> = {
  completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  running: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  pending: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  failed: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
};

function durationText(scan: Scan): string {
  if (!scan.started_at || !scan.finished_at) return scan.status === 'completed' ? '—' : 'in progress';
  const ms = new Date(scan.finished_at).getTime() - new Date(scan.started_at).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export default function DashboardPage() {
  const { data: dashboard } = useDashboardSummary();
  const { data: repositories } = useRepositories();
  const { data: scans } = useScans();
  const { data: findings } = useFindings({ limit: 15 });

  const loading = !dashboard || !repositories || !scans || !findings;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-muted/70 animate-pulse" />
            <div className="h-8 w-72 rounded bg-muted/70 animate-pulse" />
          </div>
          <div className="h-9 w-28 rounded-xl bg-muted/70 animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl bg-muted/70 animate-pulse" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="h-72 rounded-2xl bg-muted/70 animate-pulse lg:col-span-3" />
          <div className="h-72 rounded-2xl bg-muted/70 animate-pulse lg:col-span-2" />
        </div>
      </div>
    );
  }

  const fs = dashboard.findings;
  const total = fs.total ?? 0;
  const critical = fs.by_severity.critical ?? 0;
  const high = fs.by_severity.high ?? 0;
  const verified = fs.by_status.verified ?? 0;
  const probable = fs.by_status.probable ?? 0;
  const rejected = fs.by_status.rejected ?? 0;
  const hasData = total > 0;

  const repoName = new Map((repositories ?? []).map((r) => [r.id, r.name]));
  const scanMeta = new Map((scans ?? []).map((s) => [s.id, s]));
  // newest scan timestamp per repository
  const lastScanAt = new Map<string, string>();
  for (const s of [...(scans ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )) {
    if (!lastScanAt.has(s.repository_id)) lastScanAt.set(s.repository_id, s.created_at);
  }

  const attention = (findings ?? [])
    .filter((f) => f.status !== 'rejected')
    .sort((a, b) => {
      const sev = (x: Finding) => SEVERITY_ORDER.indexOf(x.severity);
      const st = (x: Finding) => (x.status === 'verified' ? 0 : 1);
      return sev(a) - sev(b) || st(a) - st(b);
    })
    .slice(0, 8);

  // Triage queue: critical + high first; if none exist fall back to any open findings.
  const queue = attention.filter((f) => f.severity === 'critical' || f.severity === 'high');
  const queueItems = (queue.length > 0 ? queue : attention).slice(0, 8);
  const criticalAttention = queueItems.filter((f) => f.severity === 'critical').length;
  const recentScans = [...(scans ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  const runningCount = scans?.filter((s) => s.status === 'running' || s.status === 'pending').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Toolbar header (product-app style) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">
              Dashboard <span className="mx-1 text-border">/</span>{' '}
              <span className="font-medium text-foreground">
                {hasData && critical > 0
                  ? `${critical} critical finding${critical === 1 ? '' : 's'} need${critical === 1 ? 's' : ''} attention`
                  : hasData && high > 0
                    ? `${high} high-severity issue${high === 1 ? '' : 's'} to review`
                    : hasData
                      ? 'No critical issues — evidence looks clean'
                      : 'Your audit workspace'}
              </span>
            </p>
            <p className="text-[13px] text-muted-foreground/80">
              {repositories.length} {repositories.length === 1 ? 'repository' : 'repositories'} · {scans.length} scans ·{' '}
              {verified} verified finding{verified === 1 ? '' : 's'}
              {runningCount > 0 ? ` · ${runningCount} scan${runningCount === 1 ? '' : 's'} running` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 rounded-lg text-xs">
            <Link href="/repositories?import=1">
              <Plus className="h-3.5 w-3.5" /> Import
            </Link>
          </Button>
          <Button size="sm" asChild className="h-8 gap-1.5 rounded-lg text-xs shadow-sm">
            <Link href="/scans/new">
              <ScanSearch className="h-3.5 w-3.5" /> New scan
            </Link>
          </Button>
        </div>
      </div>

      <OnboardingChecklistCard />

      {/* KPI row */}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Repositories', value: repositories.length, sub: 'under audit', icon: FolderGit2, tone: 'text-primary bg-primary/10' },
          { label: 'Scans', value: scans.length, sub: 'analysis runs', icon: ScanSearch, tone: 'text-sky-600 bg-sky-500/10 dark:text-sky-400' },
          { label: 'Findings', value: total, sub: `${verified} verified · ${probable} probable`, icon: Bug, tone: 'text-amber-600 bg-amber-500/10 dark:text-amber-400' },
          { label: 'Critical', value: critical, sub: `${rejected} claims rejected`, icon: ShieldAlert, tone: 'text-red-600 bg-red-500/10 dark:text-red-400' },
        ].map((k) => (
          <Card key={k.label} className="transition-colors hover:border-border">
            <CardContent className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="mt-0.5 font-display text-3xl font-semibold tracking-tight tabular-nums">{k.value}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{k.sub}</p>
              </div>
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', k.tone)}>
                <k.icon className="h-4.5 w-4.5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Group-style status pills (visual state, real counts) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Group: Status
        </span>
        {hasData && (
          <>
            <Link
              href="/findings?status=verified"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/15 dark:text-emerald-400"
            >
              <ShieldCheck className="h-3 w-3" /> Verified · {verified}
            </Link>
            <Link
              href="/findings?status=probable"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/15 dark:text-amber-400"
            >
              <AlertTriangle className="h-3 w-3" /> Probable · {probable}
            </Link>
            <Link
              href="/findings"
              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/15 dark:text-red-400"
            >
              <XCircle className="h-3 w-3" /> Critical · {critical}
            </Link>
            {runningCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400">
                <Loader2 className="h-3 w-3 animate-spin" /> {runningCount} running
              </span>
            )}
          </>
        )}
        {!hasData && (
          <span className="text-xs text-muted-foreground">
            No findings yet — run a scan to populate status groups.
          </span>
        )}
      </div>

      {/* Posture + attention */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Evidence posture */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Evidence posture
            </CardTitle>
            {hasData && (
              <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
                <Link href="/findings">
                  All findings <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {!hasData ? (
              <EmptyPanel
                icon={FileSearch}
                title="No findings yet"
                body="Verified, probable and rejected counts appear once a scan completes."
                ctaHref="/scans/new"
                ctaLabel="Run a scan"
              />
            ) : (
              <>
                {/* Status split — the core claim: verified evidence is what matters */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Validation status</p>
                  {(
                    [
                      ['verified', verified, 'VERIFIED', 'evidence-backed'],
                      ['probable', probable, 'PROBABLE', 'needs confirmation'],
                      ['rejected', rejected, 'REJECTED', 'refuted by counterexample'],
                    ] as const
                  ).map(([key, value, label, note]) => (
                    <div key={key} className="flex items-center gap-3 py-1">
                      <span className="w-24 text-xs font-medium capitalize text-foreground/80">{label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', key === 'verified' ? 'bg-emerald-500' : key === 'probable' ? 'bg-amber-500' : 'bg-muted-foreground/40')}
                          style={{ width: `${total ? Math.round((value / total) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-xs font-semibold tabular-nums">{value}</span>
                    </div>
                  ))}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {rejected > 0
                      ? `${rejected} rejected — the validator refuted those claims with counterexamples`
                      : 'Every finding here carries evidence, validation and confidence.'}
                  </p>
                </div>
                <div className="border-t border-border/60 pt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Severity</p>
                  {SEVERITY_ORDER.map((sev) => {
                    const count = fs.by_severity[sev] ?? 0;
                    const pct = total ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={sev} className="flex items-center gap-3 py-0.5">
                        <span className="w-16 text-xs capitalize text-muted-foreground">{sev}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className={cn('h-full rounded-full', SEVERITY_BAR[sev])} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right font-mono text-xs tabular-nums text-foreground/80">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Needs attention */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              {criticalAttention > 0 ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              Needs attention
            </CardTitle>
            <Badge variant="outline" className="gap-1 font-normal">
              <Activity className="h-3 w-3" />
              {queueItems.length} shown
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {queueItems.length === 0 ? (
              <div className="p-6">
                <EmptyPanel
                  icon={CheckCircle2}
                  title={hasData ? 'No open critical or high findings' : 'Nothing to triage yet'}
                  body={
                    hasData
                      ? 'When a critical or high finding is VERIFIED or PROBABLE it is triaged here first.'
                      : 'Import a repository and run a scan to surface issues with evidence.'
                  }
                  ctaHref={hasData ? '/findings' : '/repositories?import=1'}
                  ctaLabel={hasData ? 'Review all findings' : 'Import a repository'}
                />
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {queueItems.map((f) => {
                  const scan = scanMeta.get(f.scan_id);
                  const repoId = scan?.repository_id;
                  const repo = repoId ? repoName.get(repoId) : null;
                  return (
                    <div key={f.id} className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Badge variant="outline" className={cn('w-16 justify-center font-semibold', SEVERITY_CHIP[f.severity])}>
                          {f.severity}
                        </Badge>
                        <div className="min-w-0">
                          <Link href={`/findings/${f.id}`} className="block truncate text-sm font-medium hover:text-primary">
                            {f.title}
                          </Link>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {f.file_path}
                            {f.line_start ? `:${f.line_start}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs">
                        {repo && (
                          <Link href={repoId ? `/repositories/${repoId}` : '#'} className="hidden items-center gap-1 font-medium text-muted-foreground hover:text-foreground md:flex">
                            <GitBranch className="h-3 w-3" />
                            {repo}
                          </Link>
                        )}
                        <Badge variant="outline" className={cn('gap-1', STATUS_CHIP[f.status])}>
                          {f.status === 'verified' ? <ShieldCheck className="h-3 w-3" /> : f.status === 'probable' ? <AlertTriangle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {f.status} · {f.confidence}%
                        </Badge>
                        <Link href={repo ? (scan ? `/scans/${scan.id}` : '#') : '#'} className="text-muted-foreground hover:text-foreground" title="Open the scan that found this">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent scans + repositories */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4 text-primary" />
              Recent scans
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
              <Link href="/scans">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentScans.length === 0 ? (
              <div className="p-6">
                <EmptyPanel
                  icon={ScanSearch}
                  title="No scans yet"
                  body="A scan runs the full pipeline: parse → static analysis → knowledge graph → evidence validation."
                  ctaHref="/scans/new"
                  ctaLabel="Start your first scan"
                />
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentScans.map((scan) => {
                  const repoId = scan.repository_id;
                  const repo = repoName.get(repoId);
                  return (
                    <Link key={scan.id} href={`/scans/${scan.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/40">
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          scan.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : scan.status === 'failed'
                              ? 'bg-red-500/10 text-red-600'
                              : 'bg-sky-500/10 text-sky-600'
                        )}
                      >
                        {scan.status === 'running' || scan.status === 'pending' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : scan.status === 'failed' ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <ScanSearch className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{repo ?? 'Repository'}</span>
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            {scan.configuration.replaceAll('_', ' · ').toUpperCase()}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })} · ran {durationText(scan)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {scan.status === 'failed' && scan.error && (
                          <span title={scan.error} className="hidden max-w-[180px] truncate text-xs text-red-600/80 lg:block">
                            {scan.error}
                          </span>
                        )}
                        <Badge variant="outline" className={cn('gap-1', SCAN_CHIP[scan.status])}>
                          {scan.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                          {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FolderGit2 className="h-4 w-4 text-primary" />
              Repositories
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
              <Link href="/repositories">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {repositories.length === 0 ? (
              <EmptyPanel
                icon={FolderGit2}
                title="Nothing imported yet"
                body="Bring code in from GitHub, GitLab, an S3 archive link or a zip, then scan it."
                ctaHref="/repositories?import=1"
                ctaLabel="Import your first repository"
              />
            ) : (
              (repositories.slice(0, 6) as Repository[]).map((repo) => {
                const lastScan = lastScanAt.get(repo.id);
                return (
                  <div key={repo.id}>
                    <Link href={`/repositories/${repo.id}`} className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-accent/60">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <GitBranch className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium group-hover:text-primary">{repo.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {repo.source_type.toUpperCase()} · {repo.default_branch}
                          {lastScan ? ` · scanned ${formatDistanceToNow(new Date(lastScan), { addSuffix: true })}` : ' · not scanned yet'}
                        </span>
                      </span>
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', repo.status === 'active' || repo.status === 'ingested' ? 'bg-emerald-500' : 'bg-muted-foreground/50')} title={repo.status} />
                    </Link>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick path strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Audit a change', hint: 'Impact & risk of a diff or branch', href: repositories[0] ? `/repositories/${repositories[0].id}/audit` : '/repositories', icon: FlaskConical },
          { label: 'Analyze a PR', hint: 'Evidence-based PR review', href: '/pull-requests', icon: ExternalLink },
          { label: 'Ask RepoVeriX', hint: 'Grounded answers from the index', href: repositories[0] ? `/repositories/${repositories[0].id}/intelligence?tab=ask` : '/repositories', icon: Bug },
          { label: 'Open docs', hint: 'Guides, configuration, API', href: '/docs', icon: FileSearch },
        ].map((q) => (
          <Link key={q.label} href={q.href} className="group rounded-2xl border border-border/70 bg-card/60 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{q.label}</p>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{q.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  icon: typeof Bug;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground/70">
        <Icon className="h-5 w-5" />
      </span>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
      <Button asChild variant="outline" size="sm" className="mt-4 gap-1.5">
        <Link href={ctaHref}>
          <Plus className="h-3.5 w-3.5" /> {ctaLabel}
        </Link>
      </Button>
    </div>
  );
}
