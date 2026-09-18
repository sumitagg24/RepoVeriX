'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useAttackPaths,
  useChangeAudit,
  useDependencyReachability,
  useExplainChange,
  useRegression,
} from '@/hooks/useAudit';
import type { AttackPath, ChangeExplanation } from '@/types/api';
import { RiskGauge } from '@/components/audit/risk-gauge';
import {
  AlertTriangle,
  ArrowRight,
  Bug,
  FileText,
  FileWarning,
  FlaskConical,
  GitCompare,
  Loader2,
  PackageSearch,
  ShieldAlert,
  Sparkles,
  TestTube,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  reachabilityTone,
  riskTone,
  toneBorder,
  toneCallout,
  toneHue,
  toneInk,
  toneSoft,
  type Tone,
} from '@/lib/tone';

function ExplanationCard({ explanation }: { explanation: ChangeExplanation }) {
  // The score is 0–100; `riskTone` owns the thresholds so this card and the
  // risk gauge above it cannot disagree about what "high" means.
  const riskColor = `${toneSoft(riskTone(explanation.risk_score))} ${toneInk(riskTone(explanation.risk_score))}`;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> What this change does
          </CardTitle>
        </div>
        <Badge variant="outline" className={riskColor}>
          {explanation.risk_label} · {explanation.risk_score.toFixed(0)}/100
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {explanation.llm_narrative && (
          <div className="rounded-xl border bg-card/60 p-4 text-sm leading-relaxed">
            {explanation.llm_narrative}
            {explanation.model && (
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                LLM narrative · {explanation.model}
              </p>
            )}
          </div>
        )}
        <p className="text-sm font-medium">{explanation.summary}</p>
        <ul className="space-y-1.5">
          {explanation.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="divide-y rounded-xl border">
          {explanation.per_file.map((f) => (
            <div key={f.path} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <code className="min-w-0 flex-1 truncate text-xs font-medium">{f.path}</code>
              <div className="flex flex-wrap items-center gap-1.5">
                {f.symbols_changed.map((s) => (
                  <Badge key={s} variant="outline" className="font-mono text-[10px]">
                    {s.split(':').pop()}
                  </Badge>
                ))}
                {f.note && <span className={cn('text-[11px]', toneHue('probable'))}>{f.note}</span>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const DIRECTIVE_LABELS: Record<string, string> = {
  may_break: '⚠ May break callers',
  missing_cochanges: 'Missing companion files',
  missing_tests: 'Missing tests',
  tests_to_run: 'Tests to run',
  security_sensitive: 'Security-sensitive code',
  api_surface: 'API surface changed',
};

/** Attack-path risk level chip face (the API returns the level already). */
function riskFace(level: string): string {
  const key = (level ?? '').toLowerCase();
  if (key === 'critical' || key === 'high' || key === 'medium' || key === 'low') {
    return toneSoft(key as Tone);
  }
  return 'chip-outline';
}

/**
 * Dependency/path reachability chip face.
 *
 * Reachability is its own axis — it is not a severity — so it reads through
 * `reachabilityTone` rather than being folded into the severity ramp. The
 * earlier mixed map gave "reachable" the green face and "unreachable" the grey
 * one, which inverted the urgency of the very thing this screen exists to show.
 */
function reachFace(status: string): string {
  return toneSoft(reachabilityTone(status));
}

function AttackPathCard({ path, index }: { path: AttackPath; index: number }) {
  const status = path.status ?? 'VERIFIED';
  const riskLevel = path.risk_level ?? '';
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
        <Badge variant="outline">Path {index + 1}</Badge>
        {typeof path.risk_score === 'number' && (
          <Badge variant="outline" className={riskFace(riskLevel)}>
            {riskLevel} risk · {path.risk_score}/100
          </Badge>
        )}
        <Badge
          variant="outline"
          className={status === 'VERIFIED' ? toneSoft('verified') : toneSoft('probable')}
        >
          {status}
        </Badge>
        {path.entry_point?.type && (
          <Badge variant="outline" className="sev-low-soft">
            {path.entry_point.type} entry
          </Badge>
        )}
        {path.sink_category && (
          <Badge variant="outline">{path.sink_category} sink</Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* The chain, in the graph's own hues: source (observed) → sink. */}
        <Badge className={cn(toneCallout('observed'), toneInk('observed'))}>{path.source}</Badge>
        {path.steps.map((step, i) => (
          <span key={i} className="flex items-center gap-2">
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">
              {step.function}
              <span className="ml-1 text-[10px]">@{step.file.split('/').pop()}:{step.line}</span>
            </span>
          </span>
        ))}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <Badge className={cn(toneCallout('critical'), toneInk('critical'))}>{path.sink}</Badge>
      </div>
      {path.note && <p className={cn('mt-2 text-xs', toneHue('probable'))}>{path.note}</p>}
    </div>
  );
}

/**
 * Triage verdict chip face. The verdicts combine two questions — is it
 * vulnerable, and is it reachable — so each half reads from its own mapping
 * instead of one shared palette standing in for both.
 */
function triageFace(triage: string): string {
  switch (triage) {
    case 'reachable-vulnerable':
      return toneSoft('critical');
    case 'vulnerable-unreachable':
    case 'vulnerable-unknown':
      return toneSoft('medium');
    case 'indirectly-reachable':
      return toneSoft(reachabilityTone('indirectly_reachable'));
    case 'not-reachable':
    case 'unreachable':
      return toneSoft(reachabilityTone('unreachable'));
    case 'reachable':
      return toneSoft(reachabilityTone('reachable'));
    default:
      return 'chip-outline';
  }
}

export default function AuditPage() {
  const params = useParams();
  const id = params.id as string;

  const [mode, setMode] = useState<'refs' | 'diff'>('refs');
  const [base, setBase] = useState('main');
  const [head, setHead] = useState('');
  const [diff, setDiff] = useState('');

  const changeAudit = useChangeAudit();
  const explain = useExplainChange();
  const attackPaths = useAttackPaths(id);
  const depReach = useDependencyReachability(id);
  const regression = useRegression(id);

  const audit = changeAudit.data;
  const explanation = explain.data ?? null;
  const riskComponents = useMemo(() => {
    if (!audit) return null;
    const total = Object.values(audit.risk_components).reduce((a, b) => a + b, 0);
    return Object.entries(audit.risk_components)
      .map(([key, value]) => ({ key, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [audit]);

  const auditContext = useMemo(() => {
    if (!audit) return null;
    return {
      apis: audit.affected_apis ?? [],
      authSymbols: audit.security_context?.auth_and_security_symbols ?? [],
      dbSymbols: audit.security_context?.database_symbols ?? [],
    };
  }, [audit]);

  const runAudit = () => {
    changeAudit.mutate({
      repositoryId: id,
      payload: mode === 'refs' ? { base, head } : { diff },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href={`/repositories/${id}`} className="text-sm text-muted-foreground hover:underline mb-2 inline-block">
            ← Back to Repository
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              <GitCompare className="h-6 w-6" />
            </div>
            <div>
              <h1 className="type-page-title">Change Audit</h1>
              <p className="text-muted-foreground mt-1">
                PR risk, blast radius, attack paths, dependency triage and regression — one page
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="change">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="change">Change Risk</TabsTrigger>
          <TabsTrigger value="attack">Attack Paths</TabsTrigger>
          <TabsTrigger value="deps">Dependencies</TabsTrigger>
          <TabsTrigger value="regression">Regression</TabsTrigger>
        </TabsList>

        {/* ---------------- Change risk ---------------- */}
        <TabsContent value="change" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit a change</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={mode === 'refs' ? 'default' : 'outline'}
                  onClick={() => setMode('refs')}
                >
                  <GitCompare className="mr-2 h-4 w-4" /> Git refs
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'diff' ? 'default' : 'outline'}
                  onClick={() => setMode('diff')}
                >
                  <FileWarning className="mr-2 h-4 w-4" /> Raw diff
                </Button>
              </div>
              {mode === 'refs' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Base ref</label>
                    <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="main" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Head ref</label>
                    <Input
                      value={head}
                      onChange={(e) => setHead(e.target.value)}
                      placeholder="feature/xyz or commit SHA"
                    />
                  </div>
                </div>
              ) : (
                <Textarea
                  value={diff}
                  onChange={(e) => setDiff(e.target.value)}
                  placeholder={'Paste a unified diff here…\n--- a/app.py\n+++ b/app.py\n@@ -1,3 +1,4 @@'}
                  rows={8}
                  className="font-mono text-xs"
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={runAudit} disabled={changeAudit.isPending || (mode === 'refs' && !head)}>
                  {changeAudit.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Run change audit
                </Button>
                <Button
                  variant="outline"
                  disabled={explain.isPending || (mode === 'refs' && !head)}
                  onClick={() =>
                    explain.mutate({
                      repositoryId: id,
                      payload: mode === 'refs' ? { base, head } : { diff },
                    })
                  }
                >
                  {explain.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Explain in plain English
                </Button>
              </div>
              {changeAudit.isError && (
                <p className="text-sm text-destructive">
                  {(changeAudit.error as { response?: { data?: { detail?: string } } })?.response?.data
                    ?.detail || (changeAudit.error as Error).message}
                </p>
              )}
              {explain.isError && (
                <p className="text-sm text-destructive">
                  {(explain.error as { response?: { data?: { detail?: string } } })?.response?.data
                    ?.detail || (explain.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>

          {explanation && <ExplanationCard explanation={explanation} />}

          {audit && (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" /> Risk score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center gap-3">
                    <RiskGauge score={audit.risk_score} level={audit.risk_level} />
                    {audit.risk_formula && (
                      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed text-center max-w-[240px]">
                        {audit.risk_formula}
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Risk components</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(audit.risk_factors ?? []).length > 0
                      ? audit.risk_factors?.map((f) => (
                          <div key={f.key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">{f.label}</span>
                              <span className="font-mono">
                                {f.contribution.toFixed(1)}
                                <span className="text-muted-foreground text-xs"> / w{f.weight}</span>
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(2, (f.contribution / Math.max(1, f.weight)) * 100)}%`,
                                  background:
                                    f.contribution >= f.weight * 0.6
                                      ? '#ef4444'
                                      : f.contribution >= f.weight * 0.3
                                        ? '#eab308'
                                        : '#22c55e',
                                }}
                              />
                            </div>
                          </div>
                        ))
                      : riskComponents?.map((c) => (
                          <div key={c.key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="capitalize text-muted-foreground">
                                {c.key.replace('_', ' ')}
                              </span>
                              <span className="font-mono">{c.value.toFixed(2)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.max(2, c.pct)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    <div className="pt-2 flex flex-wrap gap-2">
                      {audit.directives.map((d) => (
                        <Badge key={d} variant="outline">
                          {DIRECTIVE_LABELS[d] ?? d}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Changed files</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {audit.changed_files.map((f) => (
                        <Badge key={f} variant="outline" className="font-mono text-xs">
                          {f}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      +{audit.added_lines} / −{audit.removed_lines} lines
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Blast radius</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="font-semibold">{audit.blast_radius.caller_count}</span>{' '}
                      callers outside the change
                    </p>
                    {Object.entries(audit.blast_radius.caller_files).map(([file, count]) => (
                      <div key={file} className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs truncate">{file}</span>
                        <Badge variant="secondary">{count} calls</Badge>
                      </div>
                    ))}
                    {audit.blast_radius.importing_files.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground mb-1">Files importing the change</p>
                        <div className="flex flex-wrap gap-1.5">
                          {audit.blast_radius.importing_files.map((f) => (
                            <Badge key={f} variant="outline" className="font-mono text-[10px]">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {audit.changed_symbols.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Changed symbols</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {audit.changed_symbols.map((s, i) => (
                      <Badge key={i} variant="outline" className="font-mono text-xs">
                        {s.name}
                        {s.line_start ? ` · :${s.line_start}` : ''}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              )}

              {auditContext &&
                (auditContext.apis.length > 0 ||
                  auditContext.authSymbols.length > 0 ||
                  auditContext.dbSymbols.length > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className={cn('flex items-center gap-2', toneInk('probable'))}>
                        <ShieldAlert className="h-4 w-4" /> Security, API and database context
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {auditContext.apis.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            API endpoint registrations in changed files ({auditContext.apis.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {auditContext.apis.map((a, i) => (
                              <Badge key={i} variant="outline" className="font-mono text-[10px]">
                                {a.file}:{a.line}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {auditContext.authSymbols.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Auth / security-sensitive symbols</p>
                          <div className="flex flex-wrap gap-1.5">
                            {auditContext.authSymbols.map((s, i) => (
                              <Badge key={i} variant="outline" className="font-mono text-[10px]">
                                {s.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {auditContext.dbSymbols.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Database-touching code</p>
                          <div className="flex flex-wrap gap-1.5">
                            {auditContext.dbSymbols.map((s, i) => (
                              <Badge key={i} variant="outline" className="font-mono text-[10px]">
                                {s.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

              <div className="grid gap-4 lg:grid-cols-2">
                {audit.tests_to_run.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4" /> Tests to run
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {audit.tests_to_run.map((t) => (
                        <Badge key={t} variant="outline" className="font-mono text-xs">
                          {t}
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {(audit.missing_companion_files.length > 0 || audit.untested_changed_files.length > 0) && (
                  <Card className={cn('border', toneBorder('probable'))}>
                    <CardHeader>
                      <CardTitle className={cn('flex items-center gap-2', toneInk('probable'))}>
                        <AlertTriangle className="h-4 w-4" /> Gaps detected
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {audit.missing_companion_files.length > 0 && (
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">
                            History says these files usually change together:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {audit.missing_companion_files.map((f) => (
                              <Badge key={f} variant="outline" className="font-mono text-[10px]">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {audit.untested_changed_files.length > 0 && (
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">No tests touch these files:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {audit.untested_changed_files.map((f) => (
                              <Badge key={f} variant="outline" className="font-mono text-[10px]">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------------- Attack paths ---------------- */}
        <TabsContent value="attack" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Source functions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attackPaths.data?.source_count ?? '—'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Untrusted → sink paths</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attackPaths.data?.path_count ?? '—'}</div>
              </CardContent>
            </Card>
          </div>
          {attackPaths.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Tracing call graph…
              </CardContent>
            </Card>
          ) : attackPaths.isError ? (
            <Card>
              <CardContent className="p-6 text-destructive">
                {(attackPaths.error as { response?: { data?: { detail?: string } } })?.response?.data
                  ?.detail || 'Could not trace attack paths'}
              </CardContent>
            </Card>
          ) : (attackPaths.data?.paths ?? []).length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No untrusted-input → sink paths found in this repository.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {attackPaths.data?.paths.map((p, i) => (
                <AttackPathCard key={i} path={p} index={i} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------------- Dependencies ---------------- */}
        <TabsContent value="deps" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Reachable</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn('text-2xl font-bold', toneHue(reachabilityTone('reachable'))) }>
                  {depReach.data?.reachable_count ?? '—'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Unreachable</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{depReach.data?.unreachable_count ?? '—'}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Vulnerable & reachable</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn('text-2xl font-bold', toneHue('critical'))}>
                  {depReach.data?.vulnerable_reachable ?? '—'}
                </div>
              </CardContent>
            </Card>
          </div>
          {depReach.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Matching imports to manifest…
              </CardContent>
            </Card>
          ) : depReach.isError ? (
            <Card>
              <CardContent className="p-6 text-destructive">
                {(depReach.error as { response?: { data?: { detail?: string } } })?.response?.data
                  ?.detail || 'Could not analyze dependency reachability'}
              </CardContent>
            </Card>
          ) : (depReach.data?.dependencies ?? []).length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                <PackageSearch className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No manifest dependencies found — import a repository with package.json or requirements.txt.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {depReach.data?.dependencies.map((dep) => (
                    <div key={dep.name} className="flex flex-col sm:flex-row sm:items-start gap-2 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium">{dep.name}</span>
                          {dep.version && (
                            <span className="text-xs text-muted-foreground font-mono">{dep.version}</span>
                          )}
                          {dep.known_vulnerabilities > 0 && (
                            <Badge variant="outline" className={cn(toneCallout('critical'), toneInk('critical'))}>
                              {dep.known_vulnerabilities} known vuln{dep.known_vulnerabilities > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {dep.reachability_status && (
                            <Badge
                              variant="outline"
                              className={reachFace(dep.reachability_status)}
                            >
                              {dep.reachability_status.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                        {dep.importers.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                            imports: {dep.importers.join(', ')}
                          </p>
                        )}
                        {dep.vulnerabilities && dep.vulnerabilities.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {dep.vulnerabilities.map((vuln, vi) => (
                              <p key={vi} className={cn('text-xs', toneHue('critical'))}>
                                {vuln.id && <span className="font-mono">{vuln.id} · </span>}
                                {typeof vuln.cvss === 'number' && <span>CVSS {vuln.cvss} · </span>}
                                {vuln.summary ?? ''}
                              </p>
                            ))}
                          </div>
                        )}
                        {dep.recommendation && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{dep.recommendation}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={triageFace(dep.triage)}>
                        {dep.triage.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ---------------- Regression ---------------- */}
        <TabsContent value="regression" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href={`/repositories/${id}/regression`}>
                <GitCompare className="mr-2 h-4 w-4" /> Full scan comparison
              </Link>
            </Button>
          </div>
          {regression.isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Comparing scans…
              </CardContent>
            </Card>
          ) : regression.isError ? (
            <Card>
              <CardContent className="p-6 text-destructive">
                {(regression.error as { response?: { data?: { detail?: string } } })?.response?.data
                  ?.detail || 'Need at least two completed scans to compare'}
              </CardContent>
            </Card>
          ) : regression.data ? (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">New</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={cn('text-2xl font-bold', toneHue('critical'))}>
                      {regression.data.new.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Resolved</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={cn('text-2xl font-bold', toneHue('verified'))}>
                      {regression.data.resolved.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Still present</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={cn('text-2xl font-bold', toneHue('probable'))}>
                      {regression.data.still_present.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Reintroduced</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={cn('text-2xl font-bold', toneHue('high'))}>
                      {regression.data.reintroduced.length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {regression.data.new_findings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bug className="h-4 w-4" /> New findings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {regression.data.new_findings.map((f) => (
                      <div key={f.external_id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium truncate">{f.title}</span>
                        <span className="font-mono text-xs text-muted-foreground truncate">
                          {f.file_path}
                        </span>
                        <Badge variant="outline">{f.severity}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {regression.data.reintroduced_findings.length > 0 && (
                <Card className={cn('border', toneBorder('high'))}>
                  <CardHeader>
                    <CardTitle className={cn('flex items-center gap-2', toneInk('high'))}>
                      <AlertTriangle className="h-4 w-4" /> Reintroduced
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {regression.data.reintroduced_findings.map((f) => (
                      <div key={f.external_id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium truncate">{f.title}</span>
                        <span className="font-mono text-xs text-muted-foreground truncate">
                          {f.file_path}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {regression.data.changed_status.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Status changes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {regression.data.changed_status.map((c) => (
                      <div key={c.external_id} className="flex items-center gap-2 text-sm">
                        <span className="font-medium truncate flex-1">{c.title}</span>
                        <Badge variant="outline">{c.status_before}</Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <Badge variant="outline">{c.status_after}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {regression.data.still_present.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Still present</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {regression.data.still_present.map((id) => (
                      <Badge key={id} variant="outline" className="font-mono text-xs">
                        {id}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}