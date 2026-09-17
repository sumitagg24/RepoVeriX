'use client';

import { use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ListSkeleton, QueryError } from '@/components/ui/state';
import { Badge } from '@/components/ui/badge';
import {
  AnalyticalScoreBadge,
  ScoreMeter,
  SeverityChip,
  WebsiteStateChip,
} from '@/components/evidence';
import { useCreateWebsiteAudit, useWebsiteAudit, useWebsiteAudits } from '@/hooks/useWebsites';
import { ArrowLeft, ExternalLink, Globe, RefreshCw } from 'lucide-react';

const SCORE_LABELS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'technical_seo', label: 'Technical SEO', hint: 'Titles, descriptions, structure observed on crawled pages.' },
  { key: 'security_posture', label: 'Security posture', hint: 'HTTPS and defence-in-depth response headers.' },
  { key: 'accessibility', label: 'Accessibility', hint: 'Automated DOM signals only — not a WCAG audit.' },
  { key: 'performance', label: 'Performance', hint: 'Measured response times and HTML weight.' },
  { key: 'ai_search_readiness', label: 'AI search readiness', hint: 'Observable signals; not a ranking prediction.' },
  { key: 'technical_health', label: 'Technical health', hint: 'Fetch success, broken pages, crawl errors.' },
];

const STATE_ORDER = ['observed', 'recommendation', 'insufficient'] as const;

export default function WebsiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const audits = useWebsiteAudits(id);
  const latest = audits.data?.[0];
  const audit = useWebsiteAudit(id, latest?.id);
  const startAudit = useCreateWebsiteAudit();

  if (audits.isLoading) return <ListSkeleton rows={4} />;
  if (audits.isError)
    return (
      <QueryError error={audits.error} onRetry={() => audits.refetch()} title="Audit history unavailable" />
    );

  const detail = audit.data;

  return (
    <div className="space-y-6 p-6 animate-page">
      <Link href="/websites" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> All websites
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Globe className="h-6 w-6 text-primary" /> {detail?.summary ? String((detail.summary as Record<string, unknown>).origin ?? '') : audits.data ? 'Website' : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            {latest
              ? `Latest audit ${new Date(latest.created_at).toLocaleString()} · ${latest.pages_crawled} page(s) crawled`
              : 'No audits yet.'}
          </p>
        </div>
        <Button onClick={() => startAudit.mutate({ websiteId: id })} disabled={startAudit.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${startAudit.isPending ? 'animate-spin' : ''}`} />
          Run audit
        </Button>
      </div>

      {(audit.data?.status === 'pending' || audit.data?.status === 'running') && (
        <Card className="border-primary/40">
          <CardContent className="flex items-center gap-3 py-4">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm">Passive audit in progress — this page updates automatically.</p>
          </CardContent>
        </Card>
      )}

      {audit.data?.status === 'failed' && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Audit failed</CardTitle>
            <CardDescription>{audit.data.error ?? 'The crawl could not complete.'}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {detail?.status === 'complete' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SCORE_LABELS.map(({ key, label, hint }) => (
              <Card key={key}>
                <CardContent className="pt-5">
                  <ScoreMeter label={label} score={detail.scores?.[key]} hint={hint} />
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <AnalyticalScoreBadge />
            Computed from observed evidence during this crawl. RepoVeriX scores are its own
            analysis — not Google, Bing or AI-platform rankings, and not a security certification.
          </p>

          {(['findings', 'evidence', 'pages'] as const).map((section) =>
            section === 'findings' ? (
              <Card key={section}>
                <CardHeader>
                  <CardTitle className="text-base">Findings</CardTitle>
                  <CardDescription>Observations and cautious recommendations from the crawl.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(detail.findings ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No findings recorded.</p>
                  )}
                  {STATE_ORDER.map((state) => {
                    const rows = (detail.findings ?? []).filter((f) => f.state === state);
                    if (rows.length === 0) return null;
                    return (
                      <div key={state} className="space-y-2">
                        <div className="pt-2">
                          <WebsiteStateChip state={state} variant="solid" />
                        </div>
                        {rows.map((f) => (
                          <div key={f.code} className="data-row rounded-lg border p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{f.title}</span>
                              <SeverityChip severity={f.severity} />
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
                            {f.url && (
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                {f.url} <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {f.evidence_id && (
                              <p className="font-mono text-[11px] text-muted-foreground">
                                evidence: {f.evidence_id}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ) : section === 'evidence' ? (
              <Card key={section}>
                <CardHeader>
                  <CardTitle className="text-base">Evidence</CardTitle>
                  <CardDescription>Every finding links back to measured data.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(detail.evidence ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No evidence rows.</p>
                  )}
                  {(detail.evidence ?? []).slice(0, 40).map((ev) => (
                    <div key={ev.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {ev.id}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {ev.kind}
                        </Badge>
                        <span className="truncate text-xs text-muted-foreground">{ev.url}</span>
                      </div>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/60 p-2 font-mono text-[11px]">
                        {JSON.stringify(ev.detail, null, 2)}
                      </pre>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card key={section}>
                <CardHeader>
                  <CardTitle className="text-base">Crawled pages</CardTitle>
                  <CardDescription>
                    Same-origin pages fetched during this audit, with status and depth.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border text-sm">
                    {(detail.pages ?? []).slice(0, 50).map((p, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-2">
                        <span className="truncate font-mono text-xs">{String(p.url ?? '')}</span>
                        <span className="flex flex-none items-center gap-2 text-xs text-muted-foreground">
                          {typeof p.response_ms === 'number' ? `${p.response_ms} ms` : ''}
                          <Badge variant={typeof p.status === 'number' && p.status < 400 ? 'secondary' : 'destructive'}>
                            {p.status ? String(p.status) : String(p.error ?? 'error')}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          )}
        </>
      )}
    </div>
  );
}
