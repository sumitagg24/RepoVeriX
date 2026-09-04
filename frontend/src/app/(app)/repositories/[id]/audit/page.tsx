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
  useRegression,
} from '@/hooks/useAudit';
import type { AttackPath } from '@/types/api';
import {
  AlertTriangle,
  ArrowRight,
  Bug,
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

function RiskGauge({ score }: { score: number }) {
  const color =
    score >= 7 ? 'text-red-500' : score >= 4 ? 'text-amber-500' : 'text-green-500';
  const stroke =
    score >= 7 ? '#ef4444' : score >= 4 ? '#eab308' : '#22c55e';
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (score / 10) * circumference;
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold', color)}>{score.toFixed(1)}</span>
        <span className="text-[10px] text-muted-foreground">/ 10 risk</span>
      </div>
    </div>
  );
}

const DIRECTIVE_LABELS: Record<string, string> = {
  may_break: '⚠ May break callers',
  missing_cochanges: 'Missing companion files',
  missing_tests: 'Missing tests',
  tests_to_run: 'Tests to run',
};

function AttackPathCard({ path, index }: { path: AttackPath; index: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
        <Badge variant="outline">Path {index + 1}</Badge>
        <span className="font-mono text-xs">{path.file}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
          {path.source}
        </Badge>
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
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
          {path.sink}
        </Badge>
      </div>
    </div>
  );
}

const TRIAGE_STYLES: Record<string, string> = {
  'reachable-vulnerable': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  'vulnerable-unreachable': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  unreachable: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
  reachable: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
};

export default function AuditPage() {
  const params = useParams();
  const id = params.id as string;

  const [mode, setMode] = useState<'refs' | 'diff'>('refs');
  const [base, setBase] = useState('main');
  const [head, setHead] = useState('');
  const [diff, setDiff] = useState('');

  const changeAudit = useChangeAudit();
  const attackPaths = useAttackPaths(id);
  const depReach = useDependencyReachability(id);
  const regression = useRegression(id);

  const audit = changeAudit.data;
  const riskComponents = useMemo(() => {
    if (!audit) return null;
    const total = Object.values(audit.risk_components).reduce((a, b) => a + b, 0);
    return Object.entries(audit.risk_components)
      .map(([key, value]) => ({ key, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
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
              <h1 className="text-3xl font-bold tracking-tight">Change Audit</h1>
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
              <Button onClick={runAudit} disabled={changeAudit.isPending || (mode === 'refs' && !head)}>
                {changeAudit.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Run change audit
              </Button>
              {changeAudit.isError && (
                <p className="text-sm text-destructive">
                  {(changeAudit.error as { response?: { data?: { detail?: string } } })?.response?.data
                    ?.detail || (changeAudit.error as Error).message}
                </p>
              )}
            </CardContent>
          </Card>

          {audit && (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" /> Risk score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <RiskGauge score={audit.risk_score} />
                  </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Risk components</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {riskComponents?.map((c) => (
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
                  <Card className="border-amber-500/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
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
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
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
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
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
                    <div key={dep.name} className="flex flex-col sm:flex-row sm:items-center gap-2 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium">{dep.name}</span>
                          {dep.version && (
                            <span className="text-xs text-muted-foreground font-mono">{dep.version}</span>
                          )}
                          {dep.known_vulnerabilities > 0 && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                              {dep.known_vulnerabilities} known vuln{dep.known_vulnerabilities > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        {dep.importers.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                            {dep.importers.join(', ')}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={TRIAGE_STYLES[dep.triage] ?? ''}>
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
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {regression.data.new.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Resolved</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {regression.data.resolved.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Still present</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {regression.data.still_present.length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Reintroduced</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
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
                <Card className="border-orange-500/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
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