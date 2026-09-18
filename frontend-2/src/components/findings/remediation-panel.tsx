'use client';

import * as React from 'react';
import {
  BadgeCheck,
  CircleSlash,
  FlaskConical,
  MessageSquare,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeExcerpt, DiffView } from '@/components/ui/code';
import { DetailList, DetailRow } from '@/components/ui/metric';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { SkeletonText } from '@/components/ui/states';
import {
  useFeedbackSummary,
  useGenerateFix,
  useMyFeedback,
  useProofOfFix,
  useSubmitFeedback,
  useValidateFinding,
} from '@/hooks/use-findings';
import { PATCH_STATUS_LABEL, PATCH_STATUS_TONE, PROOF_DECISION_LABEL, PROOF_DECISION_TONE } from '@/lib/domain';
import { absoluteTime, relativeTime } from '@/lib/dates';
import { toApiFailure } from '@/services/api';
import type { Patch } from '@/types/api';

/**
 * Repair and verification.
 *
 * This is the second half of the value proposition, so the panel is explicit
 * about the difference between a generated diff and a verified repair: the
 * candidate patch is shown as a diff, and the recorded checks and runs are
 * listed with their real outcomes, including the ones that failed.
 *
 * Reviewer feedback lives here too. It is what the workspace reports as
 * detection quality, and it is the only place a person can record that a claim
 * is wrong in a way the product keeps.
 */

const FEEDBACK_OPTIONS = [
  { verdict: 'correct', label: 'Correct', icon: ThumbsUp },
  { verdict: 'incorrect', label: 'Not a real issue', icon: ThumbsDown },
  { verdict: 'already_fixed', label: 'Already fixed', icon: BadgeCheck },
  { verdict: 'not_useful', label: 'Not useful', icon: CircleSlash },
] as const;

function CheckRow({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean | null;
  detail?: string;
}) {
  const state = passed === null ? 'not run' : passed ? 'passed' : 'failed';
  return (
    <li className="flex items-start gap-2.5 py-2.5">
      <span
        className={passed === null ? 'mt-0.5 text-faint' : passed ? 'mt-0.5 text-verified' : 'mt-0.5 text-critical'}
        aria-hidden="true"
      >
        {passed === null ? <CircleSlash className="size-4" /> : <BadgeCheck className="size-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] text-ink">
          {label}
          <span className="sr-only">: {state}</span>
        </p>
        {detail ? <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{detail}</p> : null}
      </div>
      <span
        className={
          passed === null
            ? 'ml-auto shrink-0 text-[12px] text-muted'
            : passed
              ? 'ml-auto shrink-0 text-[12px] text-verified'
              : 'ml-auto shrink-0 text-[12px] text-critical'
        }
      >
        {state}
      </span>
    </li>
  );
}

export function RemediationPanel({ findingId, patches }: { findingId: string; patches: Patch[] }) {
  const proof = useProofOfFix(findingId);
  const feedback = useMyFeedback(findingId);
  const summary = useFeedbackSummary(findingId);
  const generateFix = useGenerateFix(findingId);
  const validate = useValidateFinding(findingId);
  const submitFeedback = useSubmitFeedback(findingId);
  const [note, setNote] = React.useState('');

  const data = proof.data;
  const failure = (error: unknown) => toApiFailure(error).message;

  const run = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
      toast.success(label);
    } catch (error) {
      toast.error(failure(error));
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Repair and verification"
        hint="A generated diff is a proposal. A verified repair is a record of what happened when it ran."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={generateFix.isPending}
              onClick={() => void run('Candidate fix generated', () => generateFix.mutateAsync())}
            >
              <Wand2 className="size-3.5" aria-hidden="true" />
              Generate fix
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={validate.isPending}
              onClick={() => void run('Claim re-validated', () => validate.mutateAsync())}
            >
              <FlaskConical className="size-3.5" aria-hidden="true" />
              Re-validate
            </Button>
          </div>
        }
      />

      <div className="space-y-6 px-5 py-5 sm:px-6">
        {proof.isLoading ? <SkeletonText lines={4} /> : null}

        {proof.isError ? (
          <Callout tone="info" title="No proof record for this finding">
            A proof record is written by the pipeline that validated the claim. Findings from a
            static-only scan do not have one yet: run the repository again with the RepoVeriX
            configuration to produce checks, runs and a decision.
          </Callout>
        ) : null}

        {data ? (
          <>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone={PROOF_DECISION_TONE[data.decision ?? ''] ?? 'info'}>
                {PROOF_DECISION_LABEL[data.decision ?? ''] ?? 'No decision recorded'}
              </Badge>
              {data.reproduction ? (
                <Badge tone="verified">
                  <FlaskConical className="size-3" aria-hidden="true" />
                  Reproduced
                </Badge>
              ) : (
                <Badge tone="medium">Not reproduced</Badge>
              )}
              <span className="font-mono text-[11.5px] text-faint" title={absoluteTime(data.recorded_at)}>
                recorded {relativeTime(data.recorded_at)}
              </span>
            </div>

            <p className="max-w-[80ch] text-[13.5px] leading-relaxed text-body">
              {data.decision_reason}
            </p>

            {data.checks.length > 0 ? (
              <div>
                <h3 className="text-[13px] font-medium text-muted">Recorded checks</h3>
                <ul className="mt-1 divide-y divide-hairline border-t border-hairline">
                  {data.checks.map((check) => (
                    <CheckRow
                      key={check.key}
                      label={check.label}
                      passed={check.passed}
                      detail={check.detail}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}

        {patches.length > 0 ? (
          <div className="space-y-5">
            <h3 className="text-[13px] font-medium text-muted">
              Candidate fixes ({patches.length})
            </h3>
            {patches.map((patch) => {
              const proofPatch = data?.patches.find((item) => item.patch_id === patch.id);
              return (
                <div key={patch.id} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tone={PATCH_STATUS_TONE[patch.status] ?? 'info'}>
                      {PATCH_STATUS_LABEL[patch.status] ?? patch.status}
                    </Badge>
                    <span className="font-mono text-[11.5px] text-muted">{patch.generated_by}</span>
                    <span className="text-[11.5px] text-faint" title={absoluteTime(patch.created_at)}>
                      {relativeTime(patch.created_at)}
                    </span>
                  </div>

                  {proofPatch ? (
                    <DetailList className="border-t border-hairline">
                      <DetailRow label="Changed files">
                        <span className="font-mono text-[12px]">
                          {proofPatch.changed_files.join(', ') || 'none recorded'}
                        </span>
                      </DetailRow>
                      <DetailRow label="Lines changed">
                        <span data-numeric className="font-mono text-[12px]">
                          {proofPatch.changed_line_count}
                        </span>
                      </DetailRow>
                      {proofPatch.decision_reason ? (
                        <DetailRow label="Decision">{proofPatch.decision_reason}</DetailRow>
                      ) : null}
                    </DetailList>
                  ) : null}

                  {patch.explanation ? (
                    <p className="max-w-[80ch] text-[13px] leading-relaxed text-body">
                      {patch.explanation}
                    </p>
                  ) : null}

                  <DiffView diff={patch.diff} label={`Patch · ${patch.generated_by}`} />

                  {proofPatch && proofPatch.runs.length > 0 ? (
                    <ul className="space-y-3">
                      {proofPatch.runs.map((verification) => (
                        <li key={verification.id} className="panel-muted rounded-md p-3.5">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                            <Badge
                              tone={verification.status === 'verified_repair' ? 'verified' : 'info'}
                            >
                              {verification.status}
                            </Badge>
                            <span className="font-mono text-[11.5px] text-muted">
                              {verification.test_count} test{verification.test_count === 1 ? '' : 's'}
                            </span>
                            <span className="text-[11.5px] text-faint">
                              {absoluteTime(verification.started_at)}
                            </span>
                          </div>
                          {verification.log_excerpt ? (
                            <div className="mt-3">
                              <CodeExcerpt
                                code={verification.log_excerpt}
                                label="Verification log"
                                maxHeight="max-h-48"
                              />
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <Callout tone="info" title="No candidate fix recorded">
            Generating a fix asks the model for a minimal diff and stores it against this finding.
            Nothing is applied to your repository: the diff is a proposal you can read, and
            verification runs against a copy of the stored snapshot.
          </Callout>
        )}

        <div className="border-t border-hairline pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                <MessageSquare className="size-4 text-muted" aria-hidden="true" />
                Your verdict on this finding
              </h3>
              <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-muted">
                Feedback is kept and reported as detection quality for your workspace.
                {summary.data && summary.data.total > 0
                  ? ` ${summary.data.total} verdict${summary.data.total === 1 ? '' : 's'} recorded on this finding.`
                  : ''}
              </p>
            </div>
            {feedback.data ? (
              <Badge tone="accent">Recorded: {feedback.data.verdict.replace(/_/g, ' ')}</Badge>
            ) : null}
          </div>

          <fieldset className="mt-3">
            <legend className="sr-only">Record your verdict</legend>
            <div className="flex flex-wrap items-center gap-2">
              {FEEDBACK_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = feedback.data?.verdict === option.verdict;
                return (
                  <Button
                    key={option.verdict}
                    size="sm"
                    variant={active ? 'primary' : 'secondary'}
                    aria-pressed={active}
                    disabled={submitFeedback.isPending}
                    onClick={() =>
                      void run('Verdict recorded', () =>
                        submitFeedback.mutateAsync({ verdict: option.verdict }),
                      )
                    }
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4">
            <label htmlFor="finding-note" className="text-[13px] font-medium text-ink">
              Note <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="finding-note"
              rows={3}
              className="field mt-1.5 resize-y"
              placeholder="Why this verdict, for the next person reading the finding"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="mt-2">
              <Button
                size="sm"
                variant="secondary"
                loading={submitFeedback.isPending}
                onClick={() =>
                  void run('Verdict recorded', () =>
                    submitFeedback.mutateAsync({
                      verdict: feedback.data?.verdict ?? 'correct',
                      note: note.trim() || undefined,
                    }),
                  )
                }
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Save verdict with note
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
