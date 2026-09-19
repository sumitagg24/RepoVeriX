'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  GitBranch,
  History,
  Info,
  Link2,
  ScanSearch,
  ShieldQuestion,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EvidenceChain } from '@/components/findings/evidence-chain';
import { RemediationPanel } from '@/components/findings/remediation-panel';
import { Badge, FindingStatusBadge, SeverityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { DetailList, DetailRow } from '@/components/ui/metric';
import { PathValue } from '@/components/ui/misc';
import {
  ErrorState,
  LoadingRegion,
  Skeleton,
  SkeletonText,
} from '@/components/ui/states';
import {
  useFeedbackSummary,
  useFinding,
  useFindingImpact,
  useMyFeedback,
  useSubmitFeedback,
} from '@/hooks/use-findings';
import { useRepositories } from '@/hooks/use-repositories';
import { useScans } from '@/hooks/use-scans';
import {
  CATEGORY_LABEL,
  CONFIDENCE_LABEL,
  FINDING_STATUS_HINT,
  FINDING_STATUS_LABEL,
  SOURCE_LABEL,
  ruleIdFromEvidence,
  toolFromEvidence,
} from '@/lib/domain';
import { absoluteTime, relativeTime } from '@/lib/dates';
import { getRuleById } from '@/lib/rules';
import { toApiFailure } from '@/services/api';

/**
 * Finding detail.
 *
 * Reading order is deliberate: what the engine claims and why it says so, then
 * the chain that proves it, then the repair and its verification. A reader who
 * never opens the code can still take a position on the finding from the first
 * panel; a reader who does opens the excerpts in place.
 *
 * Everything shown here is recorded server state. Where the API has no field —
 * a rule id on a finding with no static chain, an impact path that has not been
 * computed — the page says so instead of filling the gap.
 */
export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : undefined;

  const finding = useFinding(id);
  const impact = useFindingImpact(id);
  const feedback = useMyFeedback(id);
  const feedbackSummary = useFeedbackSummary(id);
  const repositories = useRepositories();
  const scans = useScans();

  const [note, setNote] = React.useState('');
  const submit = useSubmitFeedback(id);

  const data = finding.data;
  const scan = React.useMemo(
    () => (data ? (scans.data ?? []).find((item) => item.id === data.scan_id) : undefined),
    [data, scans.data],
  );
  const repository = React.useMemo(
    () => (scan ? (repositories.data ?? []).find((item) => item.id === scan.repository_id) : undefined),
    [scan, repositories.data],
  );

  const ruleId = data ? ruleIdFromEvidence(data.evidence) : null;
  const rule = getRuleById(ruleId);
  const tool = data ? toolFromEvidence(data.evidence) : null;

  const onFeedback = async (verdict: 'correct' | 'incorrect' | 'already_fixed' | 'not_useful') => {
    try {
      await submit.mutateAsync({ verdict, note: note.trim() || undefined });
      setNote('');
      toast.success('Feedback recorded', {
        description: 'Your verdict is stored against the finding and summarised for the workspace.',
      });
    } catch (cause) {
      toast.error('Could not record feedback', { description: toApiFailure(cause).message });
    }
  };

  if (finding.isLoading) {
    return (
      <AppPage>
        <LoadingRegion label="Loading finding">
          <div className="space-y-4">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <SkeletonText lines={6} />
            <Skeleton className="h-64 w-full" />
          </div>
        </LoadingRegion>
      </AppPage>
    );
  }

  if (finding.isError || !data) {
    const failure = finding.error ? toApiFailure(finding.error) : null;
    return (
      <AppPage>
        <ErrorState
          title={failure?.status === 404 ? 'That finding no longer exists' : 'Could not load this finding'}
          body={
            failure?.status === 404
              ? 'It may have been removed with its scan. The findings list still has everything else.'
              : 'The findings endpoint did not answer for this id. Try again, or return to the list.'
          }
          detail={failure?.message}
          onRetry={() => void finding.refetch()}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/findings">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                All findings
              </Link>
            </Button>
          }
        />
      </AppPage>
    );
  }

  const lines =
    data.line_start == null
      ? 'No line recorded'
      : data.line_end && data.line_end !== data.line_start
        ? `${data.line_start}\u2013${data.line_end}`
        : String(data.line_start);

  return (
    <AppPage>
      <PageHeader
        crumbs={[
          { href: '/findings', label: 'Findings' },
          { label: data.external_id },
        ]}
        title={data.title}
        description={
          <span className="text-muted">
            {CATEGORY_LABEL[data.category] ?? data.category} · recorded by the{' '}
            {SOURCE_LABEL[data.source] ?? data.source} analyser
            {scan ? (
              <>
                {' '}
                in{' '}
                <Link href={`/scans/${scan.id}`} className="text-accent hover:underline">
                  a {scan.configuration.replace(/_/g, ' ')} scan
                </Link>
              </>
            ) : null}
            .
          </span>
        }
        meta={
          <>
            <SeverityBadge severity={data.severity} />
            <FindingStatusBadge status={data.status} />
            <Badge tone="neutral">{CONFIDENCE_LABEL(data.confidence)}</Badge>
            {ruleId ? (
              <span className="font-mono text-[12px] text-muted">
                {rule ? (
                  <Link href={`/rules/${rule.slug}`} className="hover:text-accent">
                    {ruleId}
                  </Link>
                ) : (
                  ruleId
                )}
              </span>
            ) : null}
          </>
        }
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href={`/findings?scan=${data.scan_id}`}>
              <ScanSearch className="size-3.5" aria-hidden="true" />
              Findings from this scan
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="What the engine claims"
              hint="The claim in plain language, followed by what it would mean if it is real."
              icon={<Info className="size-4" aria-hidden="true" />}
            />
            <div className="space-y-4 px-5 py-5 sm:px-6">
              <p className="max-w-[78ch] text-[13.5px] leading-relaxed text-body">
                {data.description}
              </p>
              {data.impact ? (
                <div>
                  <h3 className="text-[12.5px] font-medium text-muted">If it is real</h3>
                  <p className="mt-1 max-w-[78ch] text-[13.5px] leading-relaxed text-body">
                    {data.impact}
                  </p>
                </div>
              ) : null}
              {data.recommendation ? (
                <div>
                  <h3 className="text-[12.5px] font-medium text-muted">Suggested direction</h3>
                  <p className="mt-1 max-w-[78ch] text-[13.5px] leading-relaxed text-body">
                    {data.recommendation}
                  </p>
                </div>
              ) : null}

              <Callout tone={data.status === 'verified' ? 'verified' : 'info'}>
                <p className="text-[13px] leading-relaxed">
                  <strong className="font-semibold">
                    {FINDING_STATUS_LABEL[data.status] ?? data.status}
                  </strong>{' '}
                  — {FINDING_STATUS_HINT[data.status] ?? 'The recorded verdict for this finding.'}
                </p>
              </Callout>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Evidence chain"
              hint="Every hop the analyser recorded, in order, with the file and lines it read."
              icon={<GitBranch className="size-4" aria-hidden="true" />}
              actions={
                tool ? (
                  <span className="font-mono text-[11.5px] text-muted">via {tool}</span>
                ) : undefined
              }
            />
            <div className="px-5 py-5 sm:px-6">
              <EvidenceChain evidence={data.evidence} />
            </div>
          </Panel>

          {impact.isLoading ? (
            <Panel>
              <PanelHeader title="Impact" hint="Checking how far this reaches." />
              <div className="px-5 py-5 sm:px-6">
                <SkeletonText lines={4} />
              </div>
            </Panel>
          ) : null}

          {impact.data ? (
            <Panel>
              <PanelHeader
                title="How far it reaches"
                hint={impact.data.summary}
                icon={<Link2 className="size-4" aria-hidden="true" />}
              />
              <div className="px-5 py-5 sm:px-6">
                <DetailList className="border-t border-hairline">
                  <DetailRow label="Reachable from an entry point">
                    {impact.data.reachable ? 'yes' : 'not recorded as reachable'}
                  </DetailRow>
                  <DetailRow label="Affected files">
                    {impact.data.affected_files.length}
                  </DetailRow>
                </DetailList>
                {impact.data.call_chain.length > 0 ? (
                  <ol className="mt-4 space-y-2">
                    {impact.data.call_chain.map((step, index) => (
                      <li
                        key={`${step.file}-${step.symbol}-${index}`}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-hairline pt-2 text-[13px] first:border-t-0 first:pt-0"
                      >
                        <span className="text-muted">{index + 1}.</span>
                        <span className="font-medium text-ink">{step.symbol}</span>
                        <PathValue path={step.file} />
                        {step.line != null ? (
                          <span className="font-mono text-[11.5px] text-faint">line {step.line}</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-[13px] text-muted">
                    No call chain was recorded for this finding, so reachability is unknown rather
                    than absent.
                  </p>
                )}
              </div>
            </Panel>
          ) : null}

          <RemediationPanel finding={data} />

          <Panel>
            <PanelHeader
              title="Was this useful?"
              hint="Feedback is how a workspace tells the engine which claims to trust. It does not change the finding's verdict."
              icon={<ShieldQuestion className="size-4" aria-hidden="true" />}
            />
            <div className="space-y-4 px-5 py-5 sm:px-6">
              {feedback.data ? (
                <p className="text-[13px] leading-relaxed text-body">
                  You recorded <strong className="font-medium text-ink">{feedback.data.verdict.replace(/_/g, ' ')}</strong>{' '}
                  {relativeTime(feedback.data.created_at)}
                  {feedback.data.note ? <> — “{feedback.data.note}”</> : null}.
                </p>
              ) : (
                <p className="text-[13px] leading-relaxed text-muted">
                  No verdict from you yet on this finding.
                </p>
              )}

              <label className="block text-[12.5px] font-medium text-ink" htmlFor="feedback-note">
                Note (optional)
              </label>
              <textarea
                id="feedback-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full max-w-[52rem] rounded-md border border-hairline bg-card px-3 py-2 text-[13px] text-ink placeholder:text-faint focus-visible:outline-none"
                placeholder="For example: the sink is behind an internal-only flag."
              />

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void onFeedback('correct')} loading={submit.isPending}>
                  <ThumbsUp className="size-3.5" aria-hidden="true" />
                  Correct
                </Button>
                <Button
                  size="sm"
                  onClick={() => void onFeedback('incorrect')}
                  loading={submit.isPending}
                >
                  <ThumbsDown className="size-3.5" aria-hidden="true" />
                  Incorrect
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void onFeedback('already_fixed')}
                  loading={submit.isPending}
                >
                  Already fixed
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void onFeedback('not_useful')}
                  loading={submit.isPending}
                >
                  Not useful
                </Button>
              </div>

              {feedbackSummary.data ? (
                <p className="text-[12.5px] text-muted">
                  Workspace tally:{' '}
                  {Object.entries(feedbackSummary.data.counts)
                    .map(([verdict, count]) => `${count} ${verdict.replace(/_/g, ' ')}`)
                    .join(', ') || 'none recorded'}
                  .
                </p>
              ) : null}
            </div>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel>
            <PanelHeader title="Where it lives" titleAs="h2" />
            <div className="px-5 py-4 sm:px-6">
              <DetailList>
                <DetailRow label="Repository">
                  {repository ? (
                    <Link href={`/repositories/${repository.id}`} className="text-accent hover:underline">
                      {repository.name}
                    </Link>
                  ) : (
                    <span className="text-muted">Unknown</span>
                  )}
                </DetailRow>
                <DetailRow label="File">
                  <PathValue path={data.file_path} />
                </DetailRow>
                <DetailRow label="Lines">
                  <span className="font-mono text-[12.5px]">{lines}</span>
                </DetailRow>
                <DetailRow label="Function">
                  {data.function_name ? (
                    <span className="font-mono text-[12.5px]">{data.function_name}()</span>
                  ) : (
                    <span className="text-muted">Not recorded</span>
                  )}
                </DetailRow>
                <DetailRow label="Branch">
                  {repository?.default_branch ? (
                    <span className="font-mono text-[12.5px]">{repository.default_branch}</span>
                  ) : (
                    <span className="text-muted">Not recorded</span>
                  )}
                </DetailRow>
              </DetailList>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Record"
              icon={<History className="size-4" aria-hidden="true" />}
              titleAs="h2"
            />
            <div className="px-5 py-4 sm:px-6">
              <DetailList>
                <DetailRow label="Verdict">
                  {FINDING_STATUS_LABEL[data.status] ?? data.status}
                </DetailRow>
                <DetailRow label="Confidence">{CONFIDENCE_LABEL(data.confidence)}</DetailRow>
                <DetailRow label="Source">{SOURCE_LABEL[data.source] ?? data.source}</DetailRow>
                <DetailRow label="Recorded">
                  <span title={absoluteTime(data.created_at)}>{relativeTime(data.created_at)}</span>
                </DetailRow>
                <DetailRow label="Updated">
                  <span title={absoluteTime(data.updated_at)}>{relativeTime(data.updated_at)}</span>
                </DetailRow>
                <DetailRow label="Identifiers">
                  <span className="font-mono text-[11.5px] text-muted">
                    {data.external_id}
                  </span>
                </DetailRow>
                {scan ? (
                  <DetailRow label="Scan">
                    <Link href={`/scans/${scan.id}`} className="text-accent hover:underline">
                      {scan.configuration.replace(/_/g, ' ')}
                    </Link>
                  </DetailRow>
                ) : null}
              </DetailList>
            </div>
          </Panel>

          {rule ? (
            <Panel>
              <PanelHeader
                title="Detection rule"
                icon={<BookOpen className="size-4" aria-hidden="true" />}
                titleAs="h2"
              />
              <div className="px-5 py-4 sm:px-6">
                <p className="text-[13px] leading-relaxed text-body">{rule.summary}</p>
                <Button asChild size="sm" variant="secondary" className="mt-3">
                  <Link href={`/rules/${rule.slug}`}>Read the rule</Link>
                </Button>
              </div>
            </Panel>
          ) : null}
        </aside>
      </div>
    </AppPage>
  );
}
