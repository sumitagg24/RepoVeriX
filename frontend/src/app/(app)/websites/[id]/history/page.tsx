'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ListSkeleton, QueryError } from '@/components/ui/state';
import { Breadcrumbs, PageHeader } from '@/components/system/page-header';
import { ScanStatus } from '@/components/system/status';
import { WebsiteStateChip } from '@/components/evidence';
import { useWebsiteAudit, useWebsiteAudits, useWebsites } from '@/hooks/useWebsites';
import { History } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toneHue } from '@/lib/tone';
import type { WebsiteAuditDetail, WebsiteFinding } from '@/types/api';

const SCORE_LABELS: Record<string, string> = {
  technical_seo: 'Technical SEO',
  security_posture: 'Security posture',
  accessibility: 'Accessibility',
  performance: 'Performance',
  ai_search_readiness: 'AI search readiness',
  technical_health: 'Technical health',
};

function findingKey(f: WebsiteFinding): string {
  return `${f.code}::${f.url ?? ''}`;
}

/**
 * Audit history: every recorded scan with timestamp, pages, status and —
 * on expand — scores plus new/resolved findings computed by matching finding
 * codes against the previous completed audit. No manufactured trends: deltas
 * appear only where both audits report the same score.
 */
export default function WebsiteHistoryPage() {
  const params = useParams();
  const id = params.id as string;
  const websites = useWebsites();
  const audits = useWebsiteAudits(id);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const website = websites.data?.find((w) => w.id === id);

  if (websites.isLoading || audits.isLoading) return <ListSkeleton rows={5} />;
  if (websites.isError)
    return <QueryError error={websites.error} onRetry={() => websites.refetch()} title="Website unavailable" />;
  if (audits.isError)
    return <QueryError error={audits.error} onRetry={() => audits.refetch()} title="Audit history unavailable" />;
  if (!website) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Website Audits', href: '/websites' }, { label: 'History' }]} />
        <Card>
          <EmptyState
            icon={History}
            title="Website not found"
            body="It may have been deleted, or the link is stale."
            ctaHref="/websites"
            ctaLabel="Back to websites"
          />
        </Card>
      </div>
    );
  }

  const list = audits.data ?? [];
  const completed = list.filter((a) => a.status === 'complete');

  return (
    <div className="space-y-6 animate-page">
      <Breadcrumbs
        items={[
          { label: 'Website Audits', href: '/websites' },
          { label: website.hostname || website.url, href: `/websites/${id}` },
          { label: 'History' },
        ]}
      />
      <PageHeader
        eyebrow="Website audit · history"
        title="Scan history"
        description={`${website.url} — ${list.length} recorded audit${list.length === 1 ? '' : 's'}. Expand a row to compare scores and findings against the previous completed audit.`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/websites/${id}`}>Back to latest</Link>
          </Button>
        }
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="No audits recorded yet"
            body="Run the first audit to start building history for this website."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={`/websites/${id}`}>Open website</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {list.map((audit) => {
                const expanded = expandedId === audit.id;
                const previous = completed
                  .filter((a) => new Date(a.created_at).getTime() < new Date(audit.created_at).getTime())
                  .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
                return (
                  <div key={audit.id}>
                    <button
                      onClick={() => setExpandedId(expanded ? null : audit.id)}
                      aria-expanded={expanded}
                      className="data-row flex w-full flex-col gap-2 px-5 py-3 text-left sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {new Date(audit.created_at).toLocaleString()}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {formatDistanceToNow(new Date(audit.created_at), { addSuffix: true })}
                          </span>
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {audit.pages_crawled} page{audit.pages_crawled === 1 ? '' : 's'} crawled
                          {audit.finished_at
                            ? ` · finished ${formatDistanceToNow(new Date(audit.finished_at), { addSuffix: true })}`
                            : ''}
                          {audit.error ? ` · ${audit.error}` : ''}
                        </p>
                      </div>
                      <ScanStatus status={audit.status} />
                      <span className="text-xs text-muted-foreground" aria-hidden="true">
                        {expanded ? '▴' : '▾'}
                      </span>
                    </button>
                    {expanded && (
                      <AuditComparison
                        websiteId={id}
                        auditId={audit.id}
                        previousId={audit.status === 'complete' ? previous?.id : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AuditComparison({
  websiteId,
  auditId,
  previousId,
}: {
  websiteId: string;
  auditId: string;
  previousId?: string;
}) {
  const current = useWebsiteAudit(websiteId, auditId);
  const previous = useWebsiteAudit(websiteId, previousId);

  if (current.isLoading) return <ListSkeleton rows={2} />;
  if (current.isError || !current.data) {
    return (
      <div className="border-t border-border/60 px-5 py-4">
        <QueryError error={current.error} onRetry={() => current.refetch()} title="Audit detail unavailable" />
      </div>
    );
  }

  const detail: WebsiteAuditDetail = current.data;
  const scores = detail.scores ?? {};
  const prevScores = previous.data?.scores ?? {};
  const findings = detail.findings ?? [];
  const prevKeys = new Set((previous.data?.findings ?? []).map(findingKey));

  const fresh = previousId ? findings.filter((f) => !prevKeys.has(findingKey(f))) : [];
  const currentKeys = new Set(findings.map(findingKey));
  const resolved = previousId
    ? (previous.data?.findings ?? []).filter((f) => !currentKeys.has(findingKey(f)))
    : [];

  return (
    <div className="space-y-4 border-t border-border/60 bg-muted/20 px-5 py-4">
      <div>
        <p className="mono-label mb-2">Dimension scores</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(SCORE_LABELS).map((key) => {
            const value = scores[key] ?? null;
            const prev = prevScores[key] ?? null;
            const delta = value !== null && prev !== null ? value - prev : null;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs"
              >
                <span className="text-muted-foreground">{SCORE_LABELS[key]}</span>
                {value === null ? (
                  <span className="font-medium text-muted-foreground">insufficient</span>
                ) : (
                  <span className="font-semibold tabular-nums">{value}</span>
                )}
                {delta !== null && delta !== 0 && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${delta > 0 ? toneHue('verified') : toneHue('critical')}`}
                    title={`Previous completed audit: ${prev}`}
                  >
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {previousId && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="mono-label mb-1.5">New since previous audit ({fresh.length})</p>
            {previous.isLoading ? (
              <p className="text-xs text-muted-foreground">Comparing…</p>
            ) : fresh.length === 0 ? (
              <p className="text-xs text-muted-foreground">No new findings — matched by finding code and URL.</p>
            ) : (
              <ul className="space-y-1">
                {fresh.map((f) => (
                  <li key={findingKey(f)} className="text-xs">
                    <WebsiteStateChip state={f.state} />{' '}
                    <span className="font-medium">{f.title}</span>{' '}
                    <span className="font-mono text-muted-foreground">{f.code}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="mono-label mb-1.5">Resolved since previous audit ({resolved.length})</p>
            {previous.isLoading ? (
              <p className="text-xs text-muted-foreground">Comparing…</p>
            ) : resolved.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing resolved — every previous finding still present.</p>
            ) : (
              <ul className="space-y-1">
                {resolved.map((f) => (
                  <li key={findingKey(f)} className="text-xs">
                    <span className="font-medium">{f.title}</span>{' '}
                    <span className="font-mono text-muted-foreground">{f.code}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
