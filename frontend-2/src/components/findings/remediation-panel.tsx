'use client';

import * as React from 'react';
import { BadgeCheck, Copy, FlaskConical, PlayCircle, ShieldQuestion, Wrench } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeExcerpt, DiffView } from '@/components/ui/code';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { DetailList, DetailRow } from '@/components/ui/metric';
import { EmptyState, InlineError, LoadingRegion } from '@/components/ui/states';
import {
  useGenerateFix,
  useGenerateTest,
  useProofOfFix,
  useRunGeneratedTest,
  useValidateFinding,
} from '@/hooks/use-findings';
import {
  PATCH_STATUS_LABEL,
  PROOF_DECISION_LABEL,
  PROOF_DECISION_TONE,
  checkStateLabel,
} from '@/lib/domain';
import { absoluteTime, relativeTime } from '@/lib/dates';
import { toApiFailure } from '@/services/api';
import type { FindingDetail, GeneratedTest, Patch, ProofCheck } from '@/types/api';

/**
 * Repair and verification.
 *
 * Everything that can act on a finding lives here: generating a candidate patch,
 * generating a reproduction, running that reproduction with and without the
 * patch, and re-running evidence validation. Every action states what it will do
 * before it runs, and the result is rendered as a record — a diff, a check list,
 * a decision with its reason — rather than as a claim that the issue is fixed.
 *
 * The panel is deliberately careful about the three-valued checks the backend
 * returns: `null` means a check could not run, which is not the same as failing,
 * and it is never shown as a pass.
 */

function CheckRow({ check }: { check: ProofCheck }) {
  const tone =
    check.passed === true ? 'text-verified' : check.passed === false ? 'text-critical' : 'text-muted';
  return (
    <li className="flex gap-3 border-t border-hairline py-2.5 first:border-t-0">
      <span className={`w-[68px] shrink-0 text-[12px] font-medium ${tone}`}>
        {checkStateLabel(check.passed)}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-ink">{check.label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">{check.detail}</span>
      </span>
    </li>
  );
}

export function RemediationPanel({ finding }: { finding: FindingDetail }) {
  const proof = useProofOfFix(finding.id);
  const generateFix = useGenerateFix(finding.id);
  const generateTest = useGenerateTest(finding.id);
  const runTest = useRunGeneratedTest(finding.id);
  const validate = useValidateFinding(finding.id);

  const [patch, setPatch] = React.useState<Patch | null>(null);
  const [test, setTest] = React.useState<GeneratedTest | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const proofData = proof.data;
  const decision = proofData?.decision ?? null;
  const decisionLabel = decision ? PROOF_DECISION_LABEL[decision] ?? decision : null;
  const bestPatch = React.useMemo(() => {
    const patches = proofData?.patches ?? [];
    return (
      patches.find((p) => p.decision === 'VERIFIED_FIX') ??
      patches[patches.length - 1] ??
      null
    );
  }, [proofData]);

  const onGenerateFix = async () => {
    setError(null);
    try {
      const result = await generateFix.mutateAsync();
      setPatch(result);
      void proof.refetch();
      toast.success('Candidate patch generated', {
        description:
          'Read the diff before applying anything. Nothing has been written to the repository.',
      });
    } catch (cause) {
      setError(toApiFailure(cause).message);
    }
  };

  const onGenerateTest = async () => {
    setError(null);
    try {
      const result = await generateTest.mutateAsync();
      setTest(result);
      toast.success('Reproduction test generated', {
        description: 'Run it once without the patch, then again with it, to record a proof.',
      });
    } catch (cause) {
      setError(toApiFailure(cause).message);
    }
  };

  const onRunTest = async () => {
    if (!test) return;
    setError(null);
    try {
      const result = await runTest.mutateAsync({
        testId: test.id,
        patchId: patch?.id ?? bestPatch?.patch_id ?? undefined,
      });
      setTest({ ...test, status: result.status as GeneratedTest['status'], result: result.result });
      void proof.refetch();
      const baseline = result.proof_of_fix?.baseline_outcome;
      toast.success(`Reproduction ${result.status}`, {
        description: result.proof_of_fix
          ? result.proof_of_fix.explanation
          : baseline
            ? `Baseline outcome: ${baseline}. Apply a patch to compare.`
            : 'Outcome recorded against the reproduction test.',
      });
    } catch (cause) {
      setError(toApiFailure(cause).message);
    }
  };

  const onValidate = async () => {
    setError(null);
    try {
      const result = await validate.mutateAsync();
      toast.success('Validation re-run', {
        description: `Final status: ${result.final_status} · confidence ${Math.round(
          result.confidence * 100,
        )}%.`,
      });
      void proof.refetch();
    } catch (cause) {
      setError(toApiFailure(cause).message);
    }
  };

  const busy =
    generateFix.isPending || generateTest.isPending || runTest.isPending || validate.isPending;

  return (
    <Panel>
      <PanelHeader
        title="Repair and verification"
        hint="A generated diff is a suggestion until a run proves it. The record below is what the API stored."
        icon={<Wrench className="size-4" aria-hidden="true" />}
        actions={
          decisionLabel ? (
            <Badge tone={PROOF_DECISION_TONE[decision ?? ''] ?? 'neutral'}>
              {decision === 'VERIFIED_FIX' ? (
                <BadgeCheck className="size-3" aria-hidden="true" />
              ) : (
                <ShieldQuestion className="size-3" aria-hidden="true" />
              )}
              {decisionLabel}
            </Badge>
          ) : undefined
        }
      />

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {error ? <InlineError>{error}</InlineError> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={onGenerateFix}
            loading={generateFix.isPending}
            disabled={busy}
          >
            <Wrench className="size-4" aria-hidden="true" />
            Generate candidate patch
          </Button>
          <Button onClick={onGenerateTest} loading={generateTest.isPending} disabled={busy}>
            <FlaskConical className="size-4" aria-hidden="true" />
            Generate reproduction
          </Button>
          <Button
            onClick={onRunTest}
            loading={runTest.isPending}
            disabled={busy || !test}
          >
            <PlayCircle className="size-4" aria-hidden="true" />
            Run reproduction
          </Button>
          <Button onClick={onValidate} loading={validate.isPending} disabled={busy}>
            Re-run evidence validation
          </Button>
        </div>

        {proof.isLoading ? <LoadingRegion label="Loading verification record" /> : null}

        {proof.isError ? (
          <InlineError>
            {toApiFailure(proof.error).message} The verification record could not be loaded.
          </InlineError>
        ) : null}

        {!proof.isLoading && !proof.isError && proofData ? (
          <>
            <Callout tone={decision === 'VERIFIED_FIX' ? 'verified' : 'info'}>
              <p className="text-[13.5px] leading-relaxed text-ink">
                {decisionLabel ?? 'No decision recorded yet'}
                {proofData.decision_reason ? ` — ${proofData.decision_reason}` : ''}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                Recorded {relativeTime(proofData.recorded_at)} · the decision is derived from
                recorded runs, not from a model&apos;s own assessment.
              </p>
            </Callout>

            {proofData.checks.length > 0 ? (
              <div>
                <h3 className="mb-1 text-[12px] font-medium tracking-wide text-muted">
                  Validation checks
                </h3>
                <ul className="rounded-md border border-hairline">
                  {proofData.checks.map((check) => (
                    <CheckRow key={check.key} check={check} />
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState
                title="No verification run recorded yet"
                body="A verification run applies the candidate patch to an isolated copy of the snapshot and records what happened. Until one runs, the finding stays open."
              />
            )}

            {proofData.reproduction ? (
              <>
                <DetailList className="border-t border-hairline">
                  <DetailRow label="Reproduction test">
                    <span className="font-mono text-[12.5px]">{proofData.reproduction.test_id}</span>
                  </DetailRow>
                  <DetailRow label="Outcome">
                    {proofData.reproduction.outcome ?? 'not recorded'}
                    {proofData.reproduction.outcome_detail ? (
                      <span className="ml-2 text-muted">
                        {proofData.reproduction.outcome_detail}
                      </span>
                    ) : null}
                  </DetailRow>
                  <DetailRow label="Generated by">{proofData.reproduction.generated_by}</DetailRow>
                  <DetailRow label="Patch applied">
                    {proofData.reproduction.patch_applied === true
                      ? 'yes'
                      : proofData.reproduction.patch_applied === false
                        ? 'no'
                        : 'not recorded'}
                  </DetailRow>
                </DetailList>
                {proofData.reproduction.summary ? (
                  <CodeExcerpt
                    code={proofData.reproduction.summary}
                    label={`Reproduction output · ${proofData.reproduction.outcome ?? 'no outcome recorded'}`}
                    tone="accent"
                  />
                ) : null}
              </>
            ) : null}

            {bestPatch ? (
              <div>
                <DetailList className="border-t border-hairline">
                  <DetailRow label="Patch status">
                    {PATCH_STATUS_LABEL[bestPatch.patch_status] ?? bestPatch.patch_status}
                  </DetailRow>
                  <DetailRow label="Generated by">{bestPatch.generated_by}</DetailRow>
                  <DetailRow label="Changed">
                    {bestPatch.changed_files.length} file
                    {bestPatch.changed_files.length === 1 ? '' : 's'} ·{' '}
                    {bestPatch.changed_line_count} lines
                  </DetailRow>
                </DetailList>
                {bestPatch.changed_files.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {bestPatch.changed_files.map((file) => (
                      <li key={file} className="font-mono text-[12.5px] text-body">
                        {file}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {bestPatch.decision_reason ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">
                    {bestPatch.decision_reason}
                  </p>
                ) : null}
                {bestPatch.runs.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {bestPatch.runs.map((run) => (
                      <li
                        key={run.id}
                        className="rounded-md border border-hairline px-3 py-2.5 text-[12.5px]"
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
                          <span className="text-ink">{run.status}</span>
                          {run.decision ? (
                            <span>{PROOF_DECISION_LABEL[run.decision] ?? run.decision}</span>
                          ) : null}
                          {run.finished_at ? (
                            <span title={absoluteTime(run.finished_at)}>
                              {relativeTime(run.finished_at)}
                            </span>
                          ) : null}
                          <span>{run.test_count} test results</span>
                        </div>
                        {run.log_excerpt ? (
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-body">
                            {run.log_excerpt}
                          </pre>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {patch ? (
          <div className="space-y-3">
            <DetailList className="border-t border-hairline">
              <DetailRow label="Patch you generated">
                {PATCH_STATUS_LABEL[patch.status] ?? patch.status}
              </DetailRow>
              <DetailRow label="Generated by">{patch.generated_by}</DetailRow>
              <DetailRow label="Created">
                <span title={absoluteTime(patch.created_at)}>
                  {relativeTime(patch.created_at)}
                </span>
              </DetailRow>
            </DetailList>

            {patch.explanation ? (
              <p className="max-w-[78ch] text-[13.5px] leading-relaxed text-body">
                {patch.explanation}
              </p>
            ) : null}

            <DiffView diff={patch.diff} label={`Candidate patch · ${patch.generated_by}`} />

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(patch.diff);
                  toast.success('Diff copied');
                }}
              >
                <Copy className="size-3.5" aria-hidden="true" />
                Copy diff
              </Button>
            </div>
          </div>
        ) : null}

        {test ? (
          <div className="space-y-3">
            <DetailList className="border-t border-hairline">
              <DetailRow label="Reproduction">{test.generated_by}</DetailRow>
              <DetailRow label="Language">{test.language}</DetailRow>
              <DetailRow label="Status">{test.status}</DetailRow>
            </DetailList>
            <CodeExcerpt
              code={test.test_code}
              label={`Generated reproduction \u00b7 ${test.language}`}
              tone="accent"
              maxHeight="max-h-[30rem]"
            />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
