'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardSummary } from '@/hooks/useDashboard';
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
  Flame,
  FileSearch,
  FolderGit2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Finding, Repository, Scan } from '@/types/api';

const severityStyles: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  info: 'bg-muted text-muted-foreground border-border',
};

const statusStyles: Record<string, string> = {
  verified: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  probable: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  rejected: 'bg-muted text-muted-foreground border-border',
};

const scanStatusStyles: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  running: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  failed: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;
const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
  info: 'bg-muted-foreground/50',
};

const kpis = [
  {
    label: 'Repositories',
    hint: 'under audit',
    icon: FolderGit2,
    tile: 'bg-primary/10 text-primary ring-primary/15',
  },
  {
    label: 'Scans',
    hint: 'analysis runs',
    icon: ScanSearch,
    tile: 'bg-violet-500/10 text-violet-600 ring-violet-500/15',
  },
  {
    label: 'Findings',
    hint: 'total issues',
    icon: Bug,
    tile: 'bg-amber-500/10 text-amber-600 ring-amber-500/15',
  },
  {
    label: 'Critical',
    hint: 'need attention now',
    icon: Flame,
    tile: 'bg-red-500/10 text-red-600 ring-red-500/15',
  },
] as const;

function ListRow({
  href,
  icon: Icon,
  iconClass,
  title,
  subtitle,
  trailing,
  delay,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
  delay: number;
}) {
  return (
    <Link
      href={href}
      className="group animate-rise flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-accent/70"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      {trailing}
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
    </Link>
  );
}

export default function DashboardPage() {
  const { data: dashboard } = useDashboardSummary();
  const { data: repositories } = useRepositories();
  const { data: scans } = useScans();
  const { data: findings } = useFindings({ limit: 5 });

  const loading = !dashboard || !repositories || !scans || !findings;

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="skeleton h-80 rounded-2xl" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const total = dashboard.findings.total || 0;
  const critical = dashboard.findings.by_severity.critical || 0;
  const hasData = total > 0;

  const values = [repositories.length, scans.length, total, critical];

  const kpiCard = (idx: number) => {
    const kpi = kpis[idx];
    const Icon = kpi.icon;
    return (
      <Card
        key={kpi.label}
        className="animate-rise group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
        style={{ animationDelay: `${idx * 60}ms` }}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 font-display text-4xl font-semibold tracking-tight tabular-nums">
                {values[idx]}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
            </div>
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110 ${kpi.tile}`}
            >
              <Icon className="h-5 w-5" />
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  const severityRow = (sev: (typeof SEVERITY_ORDER)[number], delay: number) => {
    const count = dashboard.findings.by_severity[sev] || 0;
    const pct = hasData ? Math.round((count / total) * 100) : 0;
    const label = sev.charAt(0).toUpperCase() + sev.slice(1);
    return (
      <div className="animate-rise" style={{ animationDelay: `${delay}ms` }}>
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${SEVERITY_DOT[sev]}`} />
          <span className="w-16 text-sm">{label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-700 ${SEVERITY_DOT[sev]}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-sm font-semibold tabular-nums">{count}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-rise flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" />
            Workspace overview
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Good day — here&apos;s your audit posture</h1>
          <p className="mt-1 text-muted-foreground">
            {repositories.length} repositories · {scans.length} scans ·{' '}
            {critical > 0 ? `${critical} critical finding${critical === 1 ? '' : 's'} need attention` : 'no critical findings'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link href="/repositories?import=1">
              <Plus className="h-4 w-4" /> Import
            </Link>
          </Button>
          <Button asChild className="gap-2 shadow-sm">
            <Link href="/scans/new">
              <ScanSearch className="h-4 w-4" /> New scan
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map(kpiCard)}</div>

      {/* Recent scans + severity */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Recent scans</CardTitle>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
              <Link href="/scans">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {scans.length === 0 ? (
              <EmptyState
                icon={ScanSearch}
                title="No scans yet"
                body="Analyze a repository to surface evidence-backed findings."
                ctaHref="/scans/new"
                ctaLabel="Start your first scan"
              />
            ) : (
              (scans.slice(0, 5) as Scan[]).map((scan, i) => (
                <ListRow
                  key={scan.id}
                  href={`/scans/${scan.id}`}
                  icon={scan.status === 'completed' ? ShieldCheck : ScanSearch}
                  iconClass={
                    scan.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-primary/10 text-primary'
                  }
                  title={scan.configuration.replaceAll('_', ' ').toUpperCase()}
                  subtitle={`${formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })} · ${scan.status}`}
                  delay={i * 40}
                  trailing={
                    <Badge variant="outline" className={scanStatusStyles[scan.status]}>
                      {scan.status === 'running' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                    </Badge>
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Findings by severity</CardTitle>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
              <Link href="/findings">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasData ? (
              <EmptyState
                icon={FileSearch}
                title="No findings yet"
                body="Once you scan a repository, severity distribution shows up here."
                ctaHref="/scans/new"
                ctaLabel="Run a scan"
              />
            ) : (
              <>
                {SEVERITY_ORDER.map((sev, i) => severityRow(sev, i * 50))}
                <div className="flex items-center justify-between border-t border-border/70 pt-3 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono text-base font-semibold tabular-nums">{total}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Repos + findings */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Repositories</CardTitle>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
              <Link href="/repositories">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {repositories.length === 0 ? (
              <EmptyState
                icon={FolderGit2}
                title="No repositories yet"
                body="Bring code in from GitHub, GitLab, an S3 link or a zip."
                ctaHref="/repositories?import=1"
                ctaLabel="Import your first repository"
              />
            ) : (
              (repositories.slice(0, 5) as Repository[]).map((repo, i) => (
                <ListRow
                  key={repo.id}
                  href={`/repositories/${repo.id}`}
                  icon={GitBranch}
                  iconClass="bg-primary/10 text-primary"
                  title={repo.name}
                  subtitle={`${repo.source_type.toUpperCase()} · ${formatDistanceToNow(new Date(repo.created_at), { addSuffix: true })}`}
                  delay={i * 40}
                  trailing={
                    repo.status === 'ingested' ? (
                      <Badge variant="outline" className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline">{repo.status}</Badge>
                    )
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Latest findings</CardTitle>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
              <Link href="/findings">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {findings.length === 0 ? (
              <EmptyState
                icon={Bug}
                title="Nothing found yet"
                body="Findings with evidence chains land here after a scan."
                ctaHref="/scans/new"
                ctaLabel="Run a scan"
              />
            ) : (
              (findings.slice(0, 5) as Finding[]).map((f, i) => (
                <ListRow
                  key={f.id}
                  href={`/findings/${f.id}`}
                  icon={Bug}
                  iconClass={severityStyles[f.severity]}
                  title={f.title}
                  subtitle={`${f.file_path}:${f.line_start ?? '?'} · ${f.source}`}
                  delay={i * 40}
                  trailing={
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={severityStyles[f.severity]}>
                        {f.severity}
                      </Badge>
                      <Badge variant="outline" className={statusStyles[f.status]}>
                        {f.status}
                      </Badge>
                    </div>
                  }
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
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
