'use client';

import { useParams } from 'next/navigation';
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
import { ExternalLink, RefreshCw, ArrowUpRight, Zap, CheckCircle2 } from 'lucide-react';
import { Breadcrumbs, PageHeader } from '@/components/system/page-header';
import { cn } from '@/lib/utils';
import { toneCallout, toneInk } from '@/lib/tone';

const SCORE_LABELS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'technical_seo', label: 'Technical SEO', hint: 'Titles, descriptions, structure.' },
  { key: 'security_posture', label: 'Security', hint: 'HTTPS and defense-in-depth headers.' },
  { key: 'accessibility', label: 'Accessibility', hint: 'WCAG signals observed.' },
  { key: 'performance', label: 'Performance', hint: 'Response times and weight.' },
  { key: 'ai_search_readiness', label: 'AI Readiness', hint: 'Observable signals for AI indexing.' },
  { key: 'technical_health', label: 'Health', hint: 'Crawl success and errors.' },
];

const STATE_ORDER = ['observed', 'recommendation', 'insufficient'] as const;

export default function WebsiteDetailPage() {
  const params = useParams();
  const id = params.id as string;
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
  const origin = detail?.summary
    ? String((detail.summary as Record<string, unknown>).origin ?? '')
    : '';

  return (
    <div className="space-y-6 animate-page">
      <Breadcrumbs items={[{ label: 'Website Audits', href: '/websites' }, { label: origin || 'Website' }]} />
      <PageHeader
        eyebrow="Website Audit"
        title={origin || 'Website'}
        description={
          latest
            ? `Latest audit ${new Date(latest.created_at).toLocaleString()} • ${latest.pages_crawled} page${latest.pages_crawled === 1 ? '' : 's'} crawled`
            : 'No audits yet — run the first one to collect evidence.'
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/websites/${id}/history`}>History</Link>
            </Button>
            <Button 
              onClick={() => startAudit.mutate({ websiteId: id })} 
              disabled={startAudit.isPending}
              className="gap-2"
            >
              {startAudit.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
              {!startAudit.isPending && <Zap className="h-4 w-4" />}
              Audit
            </Button>
          </>
        }
      />

      {/* Audit status */}
      {(audit.data?.status === 'pending' || audit.data?.status === 'running') && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <RefreshCw className="h-4 w-4 animate-spin text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Audit in progress</p>
              <p className="text-xs text-muted-foreground">This page updates automatically</p>
            </div>
          </CardContent>
        </Card>
      )}

      {audit.data?.status === 'failed' && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Audit Failed</CardTitle>
            <CardDescription>{audit.data.error ?? 'The crawl could not complete.'}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {detail?.status === 'complete' && (
        <>
          {/* Score grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SCORE_LABELS.map(({ key, label, hint }) => (
              <Card key={key}>
                <CardContent className="pt-5">
                  <ScoreMeter label={label} score={detail.scores?.[key]} hint={hint} />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Evidence note */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <AnalyticalScoreBadge />
            <span>Computed from observed data. Not a Google ranking, Bing score, or security certification.</span>
          </div>

          {/* Findings section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Findings
              </CardTitle>
              <CardDescription>Observations and recommendations from this crawl</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(detail.findings ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No findings recorded.</p>
              ) : (
                <>
                  {STATE_ORDER.map((state) => {
                    const rows = (detail.findings ?? []).filter((f) => f.state === state);
                    if (rows.length === 0) return null;
                    return (
                      <div key={state} className="space-y-3">
                        <div className="flex items-center gap-2 pt-2">
                          <WebsiteStateChip state={state} />
                          <span className="text-xs text-muted-foreground font-medium">
                            {rows.length} finding{rows.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {rows.map((f) => (
                            <div key={f.code} className="data-row rounded-lg border border-border/60 bg-card/40 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-sm">{f.title}</span>
                                <SeverityChip severity={f.severity} />
                              </div>
                              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{f.detail}</p>
                              {f.url && (
                                <a
                                  href={f.url}
                                  target="_blank"
                                  rel="noopener noreferrer nofollow"
                                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                                >
                                  View page <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {f.evidence_id && (
                                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                                  {f.evidence_id}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>

          {/* Evidence section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-primary" />
                Raw Evidence
              </CardTitle>
              <CardDescription>Measured data from the crawl (first 40 rows)</CardDescription>
            </CardHeader>
            <CardContent>
              {(detail.evidence ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No evidence recorded.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(detail.evidence ?? []).slice(0, 40).map((ev) => (
                    <div key={ev.id} className="rounded-lg border border-border/60 bg-card/40 p-2.5">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono text-[9px]">
                          {ev.id}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {ev.kind}
                        </Badge>
                        <span className="truncate text-[11px] text-muted-foreground">{ev.url}</span>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
                        {JSON.stringify(ev.detail, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pages section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowUpRight className="h-4 w-4 text-primary" />
                Crawled Pages
              </CardTitle>
              <CardDescription>Same-origin pages analyzed (first 50)</CardDescription>
            </CardHeader>
            <CardContent>
              {(detail.pages ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No pages crawled.</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {(detail.pages ?? []).slice(0, 50).map((p, i) => {
                    const statusIsSuccess = typeof p.status === 'number' && p.status < 400;
                    return (
                      <div key={i} className="data-row flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-accent/30 transition-colors">
                        <span className="truncate font-mono text-xs text-foreground/80 flex-1">
                          {String(p.url ?? '')}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {typeof p.response_ms === 'number' && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {p.response_ms}ms
                            </span>
                          )}
                          <Badge 
                            variant="outline" 
                            className={cn(
                              'font-mono text-[10px]',
                              statusIsSuccess 
                                ? cn(toneCallout('verified'), toneInk('verified'))
                                : cn(toneCallout('critical'), toneInk('critical'))
                            )}
                          >
                            {p.status ? String(p.status) : String(p.error ?? '—')}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
