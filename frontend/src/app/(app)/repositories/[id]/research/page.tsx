'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRepository } from '@/hooks/useRepositories';
import {
  useLearningPatterns,
  useMultiAgent,
  useRiskModel,
  useSelfImprovement,
  useVulnMining,
} from '@/hooks/useResearch';
import type {
  AgentReport,
  MultiAgentResult,
  RiskModelResult,
  SelfImprovementResult,
  VulnMiningResult,
} from '@/types/api';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Bug,
  FlaskConical,
  Gauge,
  History,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function verdictStyles(verdict: string) {
  return {
    ok: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    attention: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  }[verdict] ?? 'bg-muted text-muted-foreground';
}

function QueryError({ error }: { error: unknown }) {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return <p className="text-sm text-destructive">{detail || 'Request failed'}</p>;
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Computing from repository evidence…
    </div>
  );
}

// --------------------------------------------------------------------------- 18. multi-agent

function AgentCard({ report }: { report: AgentReport }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold capitalize">
            <Bot className="h-4 w-4 text-primary" /> {report.agent}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold tabular-nums">{report.score.toFixed(1)}</span>
            <Badge variant="outline" className={verdictStyles(report.verdict)}>
              {report.verdict}
            </Badge>
          </div>
        </div>
        <ul className="space-y-1.5">
          {report.signals.map((s, i) => (
            <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        {report.flagged_files && report.flagged_files.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {report.flagged_files.slice(0, 6).map((f) => (
              <code key={f} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{f}</code>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MultiAgentSection({ repositoryId }: { repositoryId: string }) {
  const { data, isLoading, isError, error } = useMultiAgent(repositoryId);
  if (isLoading) return <Loading />;
  if (isError || !data) return <QueryError error={error} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" /> Consensus verdict
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <span className={cn('font-display text-4xl font-semibold', data.overall_risk >= 7 ? 'text-red-500' : data.overall_risk >= 4 ? 'text-amber-500' : 'text-green-600 dark:text-green-400')}>
                {data.overall_risk.toFixed(1)}
              </span>
              <span className="pb-1 text-sm text-muted-foreground">/ 10 overall risk</span>
              <Badge variant="outline" className={cn('mb-1', verdictStyles(data.overall_verdict))}>
                {data.overall_verdict}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{data.method}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Specialized analysts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {data.agents.map((a) => (
              <Badge key={a.agent} variant="outline" className={cn('capitalize', verdictStyles(a.verdict))}>
                {a.agent} · {a.score.toFixed(1)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.agents.map((a) => (
          <AgentCard key={a.agent} report={a} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="h-4 w-4 text-primary" /> Converging evidence
          </CardTitle>
          <CardDescription>Files flagged by more than one lens — the multi-agent signal.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.converging_evidence.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No file is flagged by more than one analyst.
            </p>
          ) : (
            <div className="space-y-2">
              {data.converging_evidence.map((c) => (
                <div key={c.file} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <code className="min-w-0 flex-1 truncate font-medium">{c.file}</code>
                  <span className="text-xs text-muted-foreground">{c.agents.length} agents:</span>
                  {c.agents.map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------- 19. rule learning

function SelfImprovementSection({ repositoryId }: { repositoryId: string }) {
  const { data, isLoading, isError, error } = useSelfImprovement(repositoryId);
  if (isLoading) return <Loading />;
  if (isError || !data) return <QueryError error={error} />;
  const rec = data.recommendation;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Scans analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-semibold">{data.scans_analyzed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Finding samples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-semibold">{data.finding_samples}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Selector mode</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={rec.exploring ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'}>
              {rec.exploring ? 'Exploring' : 'Exploiting'}
            </Badge>
            <p className="mt-1.5 text-xs text-muted-foreground">{rec.mode}</p>
          </CardContent>
        </Card>
      </div>

      {rec.deweighted_rules.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <RefreshCw className="h-4 w-4" /> De-weighted for the next scan
            </CardTitle>
            <CardDescription>Rules whose false-positive rate exceeded the threshold — their detector weight drops automatically.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {rec.deweighted_rules.map((r) => (
              <code key={r} className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">{r}</code>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-primary" /> Detector rule precision
          </CardTitle>
          <CardDescription>Verified vs rejected across completed scans — the training signal for the selector.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.stats.rules.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No rule outcomes recorded yet — run scans to start learning.</p>
          )}
          {data.stats.rules.map((r) => (
            <div key={r.rule} className="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <code className="min-w-0 flex-1 truncate text-xs font-medium">{r.rule}</code>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-green-600 dark:text-green-400">{r.verified} ok</span>
                <span className="text-xs tabular-nums text-red-600 dark:text-red-400">{r.rejected} fp</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(r.precision * 100)}%` }} />
                </div>
                <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">p={r.precision.toFixed(2)}</span>
              </div>
            </div>
          ))}
          {data.stats.rules.length > 0 && (
            <p className="pt-1 text-[11px] text-muted-foreground">
              Recommended LLM context strategy for next run: <code className="rounded bg-muted px-1.5 py-0.5">{rec.recommended_context_strategy}</code>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------- 21. vuln mining

function VulnMiningSection({ repositoryId }: { repositoryId: string }) {
  const { data, isLoading, isError, error } = useVulnMining(repositoryId);
  if (isLoading) return <Loading />;
  if (isError || !data) return <QueryError error={error} />;
  if (!data.available) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="mb-1 font-medium">No git history to mine</h3>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {data.reason === 'no_git_history'
              ? 'Vulnerability history mining blames each finding to the commit that introduced it. Import via a git URL to unlock it.'
              : 'History could not be read for this repository.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Findings blamed', value: data.findings_analyzed },
          { label: 'Introduced from history', value: data.introduced_findings ?? 0 },
          { label: 'Median age (days)', value: data.median_finding_age_days ?? '—' },
          { label: 'Fix commits in window', value: data.fix_commits_in_window ?? 0 },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-semibold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(data.top_introducing_authors ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Landmark className="h-4 w-4 text-primary" /> Who introduces the most findings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.top_introducing_authors?.map((a) => (
              <div key={a.author} className="flex items-center gap-3 text-sm">
                <span className="w-32 truncate font-medium">{a.author}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, a.introduced_findings * 18)}%` }} />
                </div>
                <span className="tabular-nums text-muted-foreground">{a.introduced_findings}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(data.repeated_vulnerable_roles ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Repeated vulnerable roles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {data.repeated_vulnerable_roles?.map((r) => (
              <Badge key={r.file_role} variant="outline" className="font-mono text-xs">
                {r.file_role} · {r.findings} finding{r.findings > 1 ? 's' : ''}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {(data.findings ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bug className="h-4 w-4 text-primary" /> Finding → introducing commit
            </CardTitle>
            <CardDescription>Walked back past fix commits so the reported author actually added the vulnerable code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.findings?.map((f, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <Badge variant="outline" className="capitalize">{f.severity}</Badge>
                <code className="min-w-0 flex-1 truncate text-xs font-medium">{f.file_path}:{f.line_start}</code>
                <span className="text-xs text-muted-foreground">by {f.author}</span>
                <code className="text-xs text-muted-foreground">{f.introducing_commit}</code>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {f.age_days != null ? `${f.age_days}d ago` : ''}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- 22. risk model

function RiskModelSection({ repositoryId }: { repositoryId: string }) {
  const { data, isLoading, isError, error } = useRiskModel(repositoryId);
  if (isLoading) return <Loading />;
  if (isError || !data) return <QueryError error={error} />;
  if (!data.available) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {data.reason || 'No features to model yet — index the repository first.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Files modeled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-semibold">{data.samples}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Verified-finding files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-semibold">{data.positive_files}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Precision@k (LOO)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl font-semibold">{((data.evaluation?.precision_at_k ?? 0) * 100).toFixed(0)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Model</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-snug text-muted-foreground">{data.model}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-primary" /> What predicts defects
            </CardTitle>
            <CardDescription>Standardized coefficient per evidence feature — interpretable, not a black box.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.coefficients?.slice(0, 8).map((c) => (
              <div key={c.feature} className="flex items-center gap-3 text-sm">
                <code className="w-36 truncate">{c.feature}</code>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('absolute top-0 h-full rounded-full', c.weight >= 0 ? 'bg-red-500 left-1/2' : 'bg-green-500 right-1/2')}
                    style={{ width: `${Math.min(50, Math.abs(c.weight) * 5)}%` }}
                  />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                </div>
                <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{c.weight.toFixed(2)}</span>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Positive weight = higher feature value raises predicted risk.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top predicted files</CardTitle>
            <CardDescription>
              {data.evaluation?.method} · precision@{data.evaluation?.k} = {((data.evaluation?.precision_at_k ?? 0) * 100).toFixed(0)}%
              ({data.evaluation?.flagged_in_top_k}/{data.evaluation?.k} were actually flagged)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.predictions?.slice(0, 10).map((p) => (
              <div key={p.path} className="flex items-center gap-3 text-sm">
                <code className="min-w-0 flex-1 truncate">{p.path}</code>
                <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', p.predicted_risk > 0.6 ? 'bg-red-500' : p.predicted_risk > 0.3 ? 'bg-amber-500' : 'bg-green-500')}
                    style={{ width: `${Math.min(100, p.predicted_risk * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{p.predicted_risk.toFixed(2)}</span>
                {p.actual_finding && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[10px]">
                    actual
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-[11px] italic text-muted-foreground">
        {data.evaluation?.caveat} Coefficients are relative — rank files, don&apos;t quote absolute risk.
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------- 20. cross-repo learning

function LearningSection() {
  const { data, isLoading, isError, error } = useLearningPatterns();
  if (isLoading) return <Loading />;
  if (isError || !data) return <QueryError error={error} />;
  if (!data.repositories_analyzed) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FlaskConical className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="mb-1 font-medium">Nothing to learn from yet</h3>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {data.message || 'Import and scan repositories first.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FlaskConical className="h-4 w-4 text-primary" /> What generalizes across your repositories
          </CardTitle>
          <CardDescription>
            Learned from {data.repositories_analyzed} scanned repos ({data.total_findings ?? 0} findings) — every pattern is a real count.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {(data.recurring_patterns ?? []).slice(0, 12).map((p) => (
            <Badge key={`${p.rule}-${p.language}`} variant="outline" className="font-mono text-xs">
              {p.rule} · {p.language} · {p.occurrences}×
            </Badge>
          ))}
          {(data.recurring_patterns ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No recurring defect patterns across repos yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Repeatedly risky file roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.risky_file_roles ?? []).map((r) => (
              <div key={`${r.file_role}-${r.category}`} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
                <code>{r.file_role}</code>
                <span className="text-muted-foreground">{r.category} · {r.hits}</span>
              </div>
            ))}
            {(data.risky_file_roles ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No repeated risky file roles.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rules that travel together</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.rule_co_occurrence ?? []).slice(0, 6).map((c) => (
              <div key={c.rules.join('|')} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
                <code className="min-w-0 flex-1 truncate">{c.rules[0]}</code>
                <span className="text-muted-foreground">⇄</span>
                <code className="min-w-0 flex-1 truncate text-right">{c.rules[1]}</code>
                <Badge variant="outline" className="text-[10px]">{c.repositories}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Transfer suggestions</CardTitle>
            <CardDescription>Where a verified rule elsewhere suggests you should look.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data.transfer_suggestions ?? []).map((t) => (
              <div key={t.rule} className="rounded-lg border px-3 py-2 text-xs">
                <code className="font-medium">{t.rule}</code>
                <p className="mt-1 text-muted-foreground">
                  verified in <span className="font-medium">{t.verified_in.join(', ')}</span> — check also:{' '}
                  <span className="font-medium">{t.check_also.join(', ')}</span>
                </p>
              </div>
            ))}
            {(data.transfer_suggestions ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No rule has verified in two repositories yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- page

export default function ResearchPage() {
  const params = useParams();
  const repositoryId = params.id as string;
  const { data: repository } = useRepository(repositoryId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/repositories/${repositoryId}`}
          className="mb-2 inline-block text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="mr-1 inline h-3.5 w-3.5" /> Back to {repository?.name ?? 'repository'}
        </Link>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-3">
            <FlaskConical className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Research extensions</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Multi-agent consensus, self-improving detection, cross-repo learning, vulnerability history and defect-risk modeling — all deterministic, no LLM required.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="multi-agent">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="multi-agent">Multi-agent</TabsTrigger>
          <TabsTrigger value="rule-learning">Rule learning</TabsTrigger>
          <TabsTrigger value="vuln-mining">Vuln mining</TabsTrigger>
          <TabsTrigger value="risk-model">Risk model</TabsTrigger>
          <TabsTrigger value="learning">Across repos</TabsTrigger>
        </TabsList>

        <TabsContent value="multi-agent" className="mt-4">
          <MultiAgentSection repositoryId={repositoryId} />
        </TabsContent>
        <TabsContent value="rule-learning" className="mt-4">
          <SelfImprovementSection repositoryId={repositoryId} />
        </TabsContent>
        <TabsContent value="vuln-mining" className="mt-4">
          <VulnMiningSection repositoryId={repositoryId} />
        </TabsContent>
        <TabsContent value="risk-model" className="mt-4">
          <RiskModelSection repositoryId={repositoryId} />
        </TabsContent>
        <TabsContent value="learning" className="mt-4">
          <LearningSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
