'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ShieldCheck, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, QueryError } from '@/components/ui/state';
import { ListSkeleton } from '@/components/ui/state';
import { PageHeader, SectionHeader } from '@/components/system/page-header';
import { SeverityBadge, SeverityMeter } from '@/components/system/severity-badge';
import { VerdictBadge } from '@/components/system/verdict-badge';
import { DataTable } from '@/components/system/data-table';
import { orgService } from '@/services/api';
import type { SecurityCenter } from '@/types/api';

/**
 * Security Center — org-scoped posture, coverage and detection quality.
 *
 * This route previously did not exist even though the sidebar linked to it, so
 * every user who clicked "Security Center" got a 404. It renders the real
 * `GET /organizations/:id/security-center` payload (the same one `/team`
 * summarises) and never derives a number the API did not return.
 */
export default function SecurityCenterPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const orgsQuery = useQuery({
    queryKey: ['orgs', 'mine'],
    queryFn: () => orgService.listMy(),
  });

  const orgs = orgsQuery.data ?? null;

  useEffect(() => {
    if (selected === null && orgs && orgs.length > 0) setSelected(orgs[0].id);
  }, [orgs, selected]);

  const securityQuery = useQuery({
    queryKey: ['orgs', selected, 'security-center'],
    queryFn: () => orgService.getSecurityCenter(selected as string),
    enabled: Boolean(selected),
  });

  const security: SecurityCenter | undefined = securityQuery.data;

  if (orgsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Security center"
          title="Posture, coverage and detection quality"
          description="Aggregated across every repository in the organization."
        />
        <Card>
          <ListSkeleton rows={3} />
        </Card>
      </div>
    );
  }

  if (orgsQuery.isError) {
    return (
      <Card>
        <QueryError error={orgsQuery.error} onRetry={() => void orgsQuery.refetch()} />
      </Card>
    );
  }

  if (!orgs || orgs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Security center"
          title="Posture, coverage and detection quality"
        />
        <Card>
          <CardContent className="py-4">
            <EmptyState
              icon={Users}
              title="No organization yet"
              body="The security center rolls up posture for a shared workspace. Create an organization to share repositories with your team."
              ctaHref="/team"
              ctaLabel="Go to Team & Organizations"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security center"
        title="Posture, coverage and detection quality"
        description="Every number below is derived from findings, evidence and executed verification for this organization — nothing is projected or LLM-assigned."
        meta={
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Organizations">
            {orgs.map((org) => (
              <button
                key={org.id}
                role="tab"
                aria-selected={selected === org.id}
                onClick={() => setSelected(org.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected === org.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {org.name}
                <span className="ml-1.5 opacity-70 capitalize">{org.role}</span>
              </button>
            ))}
          </div>
        }
      />

      {securityQuery.isLoading && (
        <Card>
          <ListSkeleton rows={3} />
        </Card>
      )}

      {securityQuery.isError && (
        <Card>
          <QueryError error={securityQuery.error} onRetry={() => void securityQuery.refetch()} />
        </Card>
      )}

      {security && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Posture score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-semibold tabular-nums">
                    {security.posture_score}
                  </span>
                  <SeverityBadge
                    severity={security.risk_level === 'none' ? 'info' : security.risk_level}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Derived from verified findings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Detection quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl font-semibold tabular-nums">
                  {security.detection_quality.agreement_ratio !== null
                    ? `${Math.round(security.detection_quality.agreement_ratio * 100)}%`
                    : '—'}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {security.detection_quality.feedback_total} reviewer verdicts recorded
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Fix pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl font-semibold tabular-nums">
                  {security.fix_pipeline.patches_verified}
                  <span className="text-muted-foreground">
                    /{security.fix_pipeline.patches_total}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">patches verified by execution</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl font-semibold tabular-nums">
                  {security.coverage.scanned_repositories}
                  <span className="text-muted-foreground">/{security.coverage.repositories}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">repositories analyzed</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Findings by severity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SeverityMeter counts={security.findings.by_severity} />
                <p className="text-xs text-muted-foreground">
                  {security.findings.total} findings ·{' '}
                  <span className="font-medium text-foreground">
                    {security.findings.verified_critical_high}
                  </span>{' '}
                  verified critical/high
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Findings by verdict</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(security.findings.by_status)
                    .filter(([, count]) => count > 0)
                    .map(([status, count]) => (
                      <span key={status} className="inline-flex items-center gap-1.5">
                        <VerdictBadge status={status} />
                        <span className="font-mono text-sm tabular-nums">{count}</span>
                      </span>
                    ))}
                  {Object.values(security.findings.by_status).every((count) => count === 0) && (
                    <p className="text-sm text-muted-foreground">
                      No findings recorded for this organization.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <section>
            <SectionHeader
              eyebrow="Per repository"
              title="Risk across repositories"
              description="Repositories appear even before their first scan — an unscanned repository is a coverage gap, not a clean bill of health."
            />
            <DataTable
              caption="Findings per repository"
              initialSortKey="findings"
              initialSortDirection="desc"
              getRowKey={(row) => row.repository_id}
              rows={security.coverage.per_repository}
              empty={
                <Card>
                  <CardContent className="py-4">
                    <EmptyState
                      icon={ShieldCheck}
                      title="No repositories attached"
                      body="Add a repository to this organization to start measuring coverage and risk."
                      ctaHref="/repositories?import=1"
                      ctaLabel="Import repository"
                    />
                  </CardContent>
                </Card>
              }
              columns={[
                {
                  key: 'name',
                  header: 'Repository',
                  cell: (row) => (
                    <Link
                      href={`/repositories/${row.repository_id}`}
                      className="font-medium hover:underline"
                    >
                      {row.repository_name}
                    </Link>
                  ),
                  sortValue: (row) => row.repository_name,
                },
                {
                  key: 'findings',
                  header: 'Findings',
                  align: 'right',
                  cell: (row) => (
                    <span className="font-mono tabular-nums">{row.findings_total}</span>
                  ),
                  sortValue: (row) => row.findings_total,
                },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}
