'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, GitPullRequest, ArrowRight, ShieldAlert, Bug, TestTube, MessageSquare, ExternalLink, RefreshCw } from 'lucide-react';
import { usePullRequestAudit, usePostPullRequestReview } from '@/hooks/usePullRequests';
import { RiskGauge } from '@/components/audit/risk-gauge';
import { toneBorder, toneCallout, toneHue, toneInk, verdictTone } from '@/lib/tone';
import type { PrAuditFinding } from '@/types/api';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'sev-critical-soft',
  high: 'sev-high-soft',
  medium: 'sev-medium-soft',
  low: 'sev-low-soft',
  // `info` has no filled face — the outline chip is its honest neutral.
  info: 'chip-outline',
};

/** Finding verdict face — one mapping, via the shared tone layer. */
function statusFace(status: string | null | undefined): string {
  const tone = verdictTone(status);
  return `${toneCallout(tone)} ${toneInk(tone)}`;
}

function FindingCard({ finding }: { finding: PrAuditFinding }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border">
      <button className="w-full text-left px-4 py-3 hover:bg-muted/40 flex flex-col gap-2" onClick={() => setOpen(!open)}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={SEVERITY_STYLES[finding.severity] ?? ''}>
            {finding.severity}
          </Badge>
          <Badge variant="outline" className={statusFace(finding.status)}>
            {finding.status}
          </Badge>
          <span className="text-sm font-medium">{finding.title}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {Math.round(finding.confidence * 100)}% confidence
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>{finding.file_path}</span>
          {finding.function_name && <span>· {finding.function_name}</span>}
          {finding.line_start && <span>· line {finding.line_start}</span>}
          {finding.rule && <span>· {finding.rule}</span>}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-sm text-muted-foreground">{finding.description}</p>
          {finding.recommendation && (
            <p className={`text-sm ${toneHue('verified')}`}>Suggested fix: {finding.recommendation}</p>
          )}
          {finding.evidence.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Evidence chain
              </p>
              {finding.evidence.map((ev, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <Badge variant="outline" className="shrink-0 font-mono">{ev.kind}</Badge>
                  <div className="min-w-0">
                    <p className="text-muted-foreground">
                      {ev.file_path ? `${ev.file_path}:${ev.line_start ?? ''} — ` : ''}
                      {ev.description}
                    </p>
                    {ev.snippet && <pre className="mt-1 rounded bg-muted p-2 font-mono text-[11px] overflow-x-auto">{ev.snippet}</pre>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PullRequestAuditPage() {
  const params = useParams();
  const auditId = params.id as string;
  const audit = usePullRequestAudit(auditId);
  const post = usePostPullRequestReview();

  const detail = audit.data;

  const factorBars = useMemo(() => {
    if (!detail?.risk_factors?.length) return [];
    const total = detail.risk_factors.reduce((a, f) => a + f.weight, 0) || 100;
    return detail.risk_factors
      .slice()
      .sort((a, b) => b.contribution - a.contribution)
      .map((f) => ({ ...f, pct: total ? (f.weight / total) * 100 : 0 }));
  }, [detail]);

  if (audit.isLoading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-20 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading PR audit…
      </div>
    );
  }
  if (audit.isError || !detail) {
    return (
      <Card>
        <CardContent className="p-8 text-destructive">
          {(audit.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
            'Could not load this PR audit'}
        </CardContent>
      </Card>
    );
  }

  const repoHref = detail.repository_id ? `/repositories/${detail.repository_id}` : '/repositories';
  const pr = detail.pr;
  const canPost = !detail.posted;

  const handlePost = () => {
    if (!detail.repository_id) return;
    if (!window.confirm('Post this RepoVeriX review to GitHub as inline comments on the PR? This writes to GitHub.')) {
      return;
    }
    post.mutate({ repositoryId: detail.repository_id, auditId: detail.audit_id });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Link href="/pull-requests" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1 w-fit">
          ← Back to PR audits
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="p-3 rounded-lg bg-primary/10 text-primary">
                <GitPullRequest className="h-6 w-6" />
              </div>
              <div>
                <h1 className="type-page-title">
                  PR #{pr.number}
                  {pr.title ? ` — ${pr.title}` : ''}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                  <Link href={repoHref} className="hover:underline">Repository</Link>
                  {pr.author && <span>· authored by {pr.author}</span>}
                  <span className="font-mono">· {pr.base_ref}…{pr.head_ref}</span>
                  {pr.html_url && (
                    <a href={pr.html_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      GitHub <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
          {detail.posted ? (
            <Badge
              variant="outline"
              className={`${toneCallout('verified')} ${toneInk('verified')} py-1 px-3`}
            >
              Review posted to GitHub
            </Badge>
          ) : (
            <Button onClick={handlePost} disabled={!canPost || post.isPending}>
              {post.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
              Post review to GitHub
            </Button>
          )}
        </div>
      </div>

      {/* Risk summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Change risk
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <RiskGauge score={detail.risk_score} level={detail.risk_level} />
            <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">{detail.risk_formula}</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>What the audit found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.summary_lines?.map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground flex gap-2">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {line}
              </p>
            ))}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                { label: 'Files', value: detail.stats.files },
                { label: 'Findings', value: detail.stats.findings },
                { label: 'Verified', value: detail.stats.verified_findings },
                { label: 'Regression risks', value: detail.stats.regression_risks },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk factors */}
      {factorBars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risk factors — documented formula</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {factorBars.map((f) => (
              <div key={f.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-mono">
                    {f.contribution.toFixed(1)} <span className="text-muted-foreground text-xs">/ w{f.weight}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(2, (f.contribution / Math.max(1, f.weight)) * 100)}%`,
                      background: f.contribution >= f.weight * 0.6 ? '#ef4444' : f.contribution >= f.weight * 0.3 ? '#eab308' : '#22c55e',
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="findings">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="findings">Findings ({detail.findings.length})</TabsTrigger>
          <TabsTrigger value="context">Changed files</TabsTrigger>
          <TabsTrigger value="comments">
            Inline comments ({detail.comments.length})
          </TabsTrigger>
          <TabsTrigger value="regression">Regression risks ({detail.regression_risks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="space-y-3 pt-4">
          {detail.findings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No deterministic findings on the changed files. The change-impact factors above still tell you where
                the risk is.
              </CardContent>
            </Card>
          ) : (
            detail.findings.map((f) => <FindingCard key={f.external_id} finding={f} />)
          )}
        </TabsContent>

        <TabsContent value="context" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Changed files</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {detail.changed_files.map((f) => (
                <Badge key={f} variant="outline" className="font-mono text-xs">{f}</Badge>
              ))}
            </CardContent>
          </Card>
          {(detail.affected_apis?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Affected API endpoints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {detail.affected_apis?.map((a, i) => (
                  <div key={i} className="flex gap-2 font-mono text-xs">
                    <span className="text-muted-foreground">{a.file}:{a.line}</span>
                    <span className="truncate">{a.route}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {detail.tests_to_run.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="h-4 w-4" /> Tests to run
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {detail.tests_to_run.map((t) => (
                    <Badge key={t} variant="outline" className="font-mono text-xs">{t}</Badge>
                  ))}
                </CardContent>
              </Card>
            )}
            {(detail.security_context?.auth_and_security_symbols.length ||
              detail.security_context?.database_symbols.length) ? (
              <Card className={`border ${toneBorder('probable')}`}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${toneInk('probable')}`}>
                    <ShieldAlert className="h-4 w-4" /> Security & database context
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(detail.security_context?.auth_and_security_symbols ?? []).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Auth / security-sensitive symbols</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(detail.security_context?.auth_and_security_symbols ?? []).map((s, i) => (
                          <Badge key={i} variant="outline" className="font-mono text-[10px]">{s.name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(detail.security_context?.database_symbols ?? []).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Database-touching code</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(detail.security_context?.database_symbols ?? []).map((s, i) => (
                          <Badge key={i} variant="outline" className="font-mono text-[10px]">{s.name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="comments" className="space-y-3 pt-4">
          {detail.comments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No inline comments — findings did not anchor on added diff lines. Posting the review will still leave a
                summary comment.
              </CardContent>
            </Card>
          ) : (
            detail.comments.map((c, i) => (
              <div key={i} className="rounded-lg border">
                <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground flex items-center gap-2">
                  {c.path}:{c.line}
                  {!detail.posted && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      Posted on review submit
                    </span>
                  )}
                </div>
                <div className="px-4 py-3 text-sm whitespace-pre-wrap">{c.body}</div>
              </div>
            ))
          )}
          {!detail.posted && detail.repository_id && (
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handlePost} disabled={post.isPending}>
                {post.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {post.isPending ? 'Posting…' : 'Post review to GitHub'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Posting is explicit — RepoVeriX never publishes review comments automatically.
              </span>
            </div>
          )}
        </TabsContent>

        <TabsContent value="regression" className="space-y-3 pt-4">
          {detail.regression_risks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No previously-reported repository findings sit in the changed files.
              </CardContent>
            </Card>
          ) : (
            detail.regression_risks.map((r) => (
              <div key={r.external_id} className="rounded-lg border p-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={SEVERITY_STYLES[r.severity] ?? ''}>{r.severity}</Badge>
                  <span className="text-sm font-medium">{r.title}</span>
                  {r.line_touched && (
                    <Badge variant="outline" className="sev-critical-soft">
                      lines modified
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">{r.file_path}:{r.line_start ?? '?'}</p>
                <p className={`text-xs ${toneHue('probable')}`}>{r.note}</p>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
