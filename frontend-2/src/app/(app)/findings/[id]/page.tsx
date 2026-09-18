'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, BookOpen, Bug, Route, ShieldQuestion } from 'lucide-react';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EvidenceChain } from '@/components/findings/evidence-chain';
import { RemediationPanel } from '@/components/findings/remediation-panel';
import { SeverityBadge, VerdictBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DetailList, DetailRow } from '@/components/ui/metric';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { PathValue, CopyableValue } from '@/components/ui/misc';
import { EmptyState, ErrorState, LoadingRegion, SkeletonText } from '@/components/ui/states';
import { useFinding, useFindingImpact } from '@/hooks/use-findings';
import { useRepositories } from '@/hooks/use-repositories';
import { useScans } from '@/hooks/use-scans';
import { CATEGORY_LABEL, CONFIDENCE_LABEL, SOURCE_LABEL } from '@/lib/domain';
import { absoluteTime, relativeTime } from '@/lib/dates';
import { DETECTION_RULES } from '@/lib/rules';

/**
 * Finding detail.
 *
 * Read order is deliberate: what is claimed, why it matters, the evidence that
 * supports it, then the repair. The technical material (chain snippets, diffs,
 * verification logs) sits inside the chain and remediation sections rather than
 * being dumped above the explanation, because a reviewer needs to understand the
 * claim before reading the code.
 */
export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const finding = useFinding(id);
  const impact = useFindingImpact(id);
  const scans = useScans();
  const repositories = useRepositories();

  const data = finding.data;

  const repository = React.useMemo(() => {
    if (!data) return undefined;
    const scan = (scans.data ?? []).find((item) => item.id === data.scan_id);
    if (!scan) return undefined;
    return (repositories.data ?? []).find((item) => item.id === scan.repository_id);
  }, [data, scans.data, repositories.data]);

  const rule = React.useMemo(
    () => (data ? DETECTION_RULES.find((item) => item.id === data.external_id) : undefined),
    [data],
  );

  if (finding.isError) {
    return (
      <AppPage>
        <PageHeader title="Finding" crumbs={[{ href: '/findings', label: 'Findings' }]} />
        <ErrorState
          title="This finding could not be loaded"
          body="It may belong to a different workspace, or the id in the URL may be wrong."
          onRetry={() => void finding.refetch()}
        />
      </AppPage>
    );
  }

  if (finding.isLoading || !data) {
    return (
      <AppPage>
        <PageHeader title="Finding" crumbs={[{ href: '/findings', label: 'Findings' }]} />
        <LoadingRegion label="Loading finding">
          <SkeletonText lines={6} />
        </LoadingRegion>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageHeader
        title={data.title}
        crumbs={[
          { href: '/findings', label: 'Findings' },
          { label: data.external_id },
        ]}
        description={data.description}
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/findings">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              All findings
            </Link>
          </Button>
        }
        meta={
          <>
            <SeverityBadge severity={data.severity} />
            <VerdictBadge status={data.status} />
            <span className="chip">{CATEGORY_LABEL[data.category] ?? data.category}</span>
            <span className="chip font-mono">{data.external_id}</span>
            <span className="text-[12px] text-muted">{CONFIDENCE_LABEL(data.confidence)}</span>
            <span className="text-[12px] text-muted">first seen {relativeTime(data.created_at)}</span>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="What the finding claims"
              hint={SOURCE_LABEL[data.source] ?? data.source}
              icon={<Bug className="size-4" />}
            />
            <div className="space-y-4 px-5 py-5 sm:px-6">
              <p className="max-w-[80ch] text-[14px] leading-relaxed text-body">{data.description}</p>

              {data.impact ? (
                <div>
                  <h3 className="text-[13px] font-medium text-muted">Impact</h3>
                  <p className="mt-1.5 max-w-[80ch] text-[13.5px] leading-relaxed text-body">
                    {data.impact}
                  </p>
                </div>
              ) : null}

              {data.recommendation ? (
                <div className="rounded-md border border-accent-line bg-accent-soft px-3.5 py-3">
                  <h3 className="text-[13px] font-medium text-ink">Recommended direction</h3>
                  <p className="mt-1.5 max-w-[80ch] text-[13.5] leading-relaxed text-body">
                    {data.recommendation}
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Why it matters here"
              hint="Reachability and blast radius as the analyzer recorded them."
              icon={<Route className="size-4" />}
            />
            <div className="px-5 py-5 sm:px-6">
              {impact.isLoading ? <SkeletonText lines={3} /> : null}

              {impact.isError ? (
                <EmptyState
                  icon={<ShieldQuestion className="size-4" aria-hidden="true" />}
                  title="No impact analysis recorded"
                  body="Impact analysis is produced by the model-backed configurations. This finding came from a run that did not include one."
                  action={
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/scans/new">Run a fuller scan</Link>
                    </Button>
                  }
                />
              ) : null}

              {impact.data ? (
                <div className="space-y-5">
                  <p className="max-w-[80ch] text-[13.5px] leading-relaxed text-body">
                    {impact.data.summary}
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={
                        impact.data.entrypoint_reachable
                          ? 'chip border-critical-line bg-critical-soft text-critical'
                          : 'chip'
                      }
                    >
                      {impact.data.entrypoint_reachable
                        ? 'Reachable from an entry point'
                        : 'No reachable entry point recorded'}
                    </span>
                    <span className="chip">{impact.data.category}</span>
                  </div>

                  {impact.data.why_it_matters.length > 0 ? (
                    <div>
                      <h3 className="text-[13px] font-medium text-muted">What follows from it</h3>
                      <ul className="mt-2 space-y-2">
                        {impact.data.why_it_matters.map((item) => (
                          <li key={item} className="flex gap-2.5 text-[13.5px] leading-relaxed text-body">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {impact.data.worst_case ? (
                    <Callout tone="warning" title="Worst case on this path">
                      {impact.data.worst_case}
                    </Callout>
                  ) : null}

                  {impact.data.callers.length > 0 ? (
                    <div>
                      <h3 className="text-[13px] font-medium text-muted">Callers on the path</h3>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {impact.data.callers.map((caller) => (
                          <li key={caller} className="chip font-mono">
                            {caller}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="border-t border-hairline pt-4">
                    <h3 className="text-[13px] font-medium text-muted">Fix direction</h3>
                    <p className="mt-1.5 max-w-[80ch] text-[13.5px] leading-relaxed text-body">
                      {impact.data.fix_direction}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title={`Evidence chain (${data.evidence.length} step${data.evidence.length === 1 ? '' : 's'})`}
              hint="Recorded in the order the analyzer followed them, from untrusted input to the sink it reaches."
            />
            <div className="px-5 py-5 sm:px-6">
              <EvidenceChain evidence={data.evidence} />
            </div>
          </Panel>

          <RemediationPanel findingId={data.id} patches={data.patches} />
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Location" hint="Where the proving lines are." />
            <div className="px-5 py-5 sm:px-6">
              <DetailList className="border-t border-hairline">
                <DetailRow label="Repository">
                  {repository ? (
                    <Link href={`/repositories/${repository.id}`} className="text-accent">
                      {repository.name}
                    </Link>
                  ) : (
                    'Not recorded'
                  )}
                </DetailRow>
                <DetailRow label="File">
                  <PathValue path={data.file_path} />
                </DetailRow>
                <DetailRow label="Function">
                  {data.function_name ? (
                    <span className="font-mono text-[12px]">{data.function_name}()</span>
                  ) : (
                    'Not recorded'
                  )}
                </DetailRow>
                <DetailRow label="Lines">
                  <span className="font-mono text-[12px]">
                    {data.line_start
                      ? `${data.line_start}${data.line_end && data.line_end !== data.line_start ? `-${data.line_end}` : ''}`
                      : 'Not recorded'}
                  </span>
                </DetailRow>
                <DetailRow label="Scan">
                  <Link href={`/scans/${data.scan_id}`} className="font-mono text-[12px] text-accent">
                    {data.scan_id.slice(0, 8)}
                  </Link>
                </DetailRow>
                <DetailRow label="Finding id">
                  <CopyableValue value={data.id} label="finding id" display={data.id.slice(0, 8)} />
                </DetailRow>
              </DetailList>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Rule and provenance"
              hint="The detector that fired, and when the record last changed."
              icon={<BookOpen className="size-4" />}
            />
            <div className="px-5 py-5 sm:px-6">
              <DetailList className="border-t border-hairline">
                <DetailRow label="Rule id">
                  <span className="font-mono text-[12px]">{data.external_id}</span>
                </DetailRow>
                <DetailRow label="Detector">
                  {SOURCE_LABEL[data.source] ?? data.source}
                </DetailRow>
                <DetailRow label="Confidence">
                  <span data-numeric className="font-mono text-[12px]">
                    {data.confidence.toFixed(2)}
                  </span>
                </DetailRow>
                <DetailRow label="First seen">{absoluteTime(data.created_at)}</DetailRow>
                <DetailRow label="Last updated">{absoluteTime(data.updated_at)}</DetailRow>
              </DetailList>

              {rule ? (
                <div className="mt-4 border-t border-hairline pt-4">
                  <p className="text-[13px] leading-relaxed text-body">{rule.summary}</p>
                  <div className="mt-3">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/rules/${rule.slug}`}>
                        Read the rule and its examples
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 border-t border-hairline pt-4 text-[12.5px] leading-relaxed text-muted">
                  This rule id is not in the bundled catalogue, which means it came from a detector
                  adapter rather than the built-in set.
                </p>
              )}
            </div>
          </Panel>

          <Callout tone="info" title="What verification means here">
            A verdict of verified means the claim survived validation, not that the repair was
            applied. Repair confirmation comes from the verification runs recorded against a
            candidate patch, and the ones that failed stay on the record.
          </Callout>

          {data.patches.length === 0 ? (
            <Panel className="px-5 py-5">
              <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-body">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                No candidate patch has been generated for this finding yet. Use Generate fix in the
                repair panel to ask for one.
              </p>
            </Panel>
          ) : null}
        </div>
      </div>
    </AppPage>
  );
}
