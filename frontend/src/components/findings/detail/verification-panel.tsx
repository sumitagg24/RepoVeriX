'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeViewer } from '@/components/system/code';
import { VerificationTimeline } from '@/components/system/verification-timeline';
import { FindingStateChip } from '@/components/evidence';
import { useCounterexample, useGeneratedTest, useValidateFinding } from '@/hooks/useAudit';
import { getApiErrorMessage } from '@/lib/api-error';
import { toneHue } from '@/lib/tone';
import type {
  CounterexampleProof,
  FindingValidationResult,
  Patch,
  RunTestResponse,
} from '@/types/api';
import {
  AlertTriangle,
  CheckCircle,
  Clipboard,
  FlaskConical,
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  Wand2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * VerificationPanel — everything that turns a claim into or out of a result.
 *
 * Moved out of the finding page wholesale, including its state, because this is
 * where the real work happens: generate a contract test, run it against the
 * vulnerable code and against a candidate patch, hunt for a counterexample, and
 * run the full validation battery. The page above it should not have to know
 * any of that.
 */
export function VerificationPanel({
  findingId,
  fixPatch,
  validation,
  onValidation,
  runResult,
  onRunResult,
}: {
  findingId: string;
  fixPatch?: Patch;
  /** Owned by the page so the verification checklist above can read it. */
  validation: FindingValidationResult | null;
  onValidation: (result: FindingValidationResult) => void;
  runResult: RunTestResponse | null;
  onRunResult: (result: RunTestResponse | null) => void;
}) {
  const { generate: generateTest, run: runTest } = useGeneratedTest();
  const counterexample = useCounterexample();
  const validateFinding = useValidateFinding();

  const [generated, setGenerated] = useState<{ id: string; test_code: string; generated_by: string } | null>(
    null,
  );
  const [proof, setProof] = useState<{ counterexample: CounterexampleProof | null } | null>(null);

  const executeTest = (patchId?: string) => {
    if (!generated) return;
    runTest.mutate(
      { testId: generated.id, patchId },
      {
        onSuccess: (data: RunTestResponse) => {
          onRunResult(data);
          if (data.proof_of_fix?.verdict === 'VERIFIED_FIX_PROOF') {
            toast.success('Verified fix proof — test fails on vulnerable code, passes with the patch');
          } else if (data.result?.outcome === 'TEST_REPRODUCES_BUG') {
            toast.success('Test reproduced the defect (fails on this code, as expected)');
          } else if (data.result?.outcome === 'TEST_DOES_NOT_REPRODUCE') {
            toast.success('Test passed — defect not present on this code');
          } else if (data.result?.outcome === 'TEST_FAILED_TO_EXECUTE') {
            toast.error('Test failed to execute — infrastructure issue, not a defect signal');
          }
        },
      },
    );
  };

  const outcome = runResult?.result?.outcome;

  return (
    <div className="space-y-5">
      {/* 1. Reproduction */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" aria-hidden="true" /> Regression test
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {generated && (
              <>
                <Button size="sm" variant="outline" onClick={() => executeTest()} disabled={runTest.isPending}>
                  {runTest.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FlaskConical className="mr-2 h-4 w-4" />
                  )}
                  Run test
                </Button>
                {fixPatch && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => executeTest(fixPatch.id)}
                    disabled={runTest.isPending}
                    title="Run this reproduction test against the generated fix (Proof-of-Fix)"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Run against fix
                  </Button>
                )}
              </>
            )}
            <Button
              size="sm"
              onClick={() =>
                generateTest.mutate(findingId, {
                  onSuccess: (data) => {
                    setGenerated({ id: data.id, test_code: data.test_code, generated_by: data.generated_by });
                    onRunResult(null);
                    toast.success('Regression test generated');
                  },
                })
              }
              disabled={generateTest.isPending}
            >
              {generateTest.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Generate test
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-[76ch] text-[13px] leading-relaxed text-muted-foreground">
            A contract test asserting the vulnerable pattern is gone. It fails on the vulnerable
            code — demonstrating the defect — and passes after a real fix. No runtime, fixtures or
            network required.
          </p>

          {generated ? (
            <>
              <Badge variant="outline" className="font-mono">
                {generated.generated_by}
              </Badge>
              <CodeViewer code={generated.test_code} language="python" maxHeight={300} />

              {runResult &&
                (() => {
                  const tone =
                    outcome === 'TEST_DOES_NOT_REPRODUCE'
                      ? 'border-border state-verified-soft'
                      : outcome === 'TEST_FAILED_TO_EXECUTE'
                        ? 'border-border bg-muted/40'
                        : 'border-destructive/40 bg-destructive/5';
                  return (
                    <div className={`rounded-lg border p-4 ${tone}`}>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {outcome === 'TEST_DOES_NOT_REPRODUCE' && (
                            <>
                              <CheckCircle className={`h-4 w-4 ${toneHue('verified')}`} aria-hidden="true" />
                              Test passed — defect not present
                            </>
                          )}
                          {outcome === 'TEST_REPRODUCES_BUG' && (
                            <>
                              <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                              Test reproduced the defect (failed on vulnerable code)
                            </>
                          )}
                          {outcome === 'TEST_FAILED_TO_EXECUTE' && (
                            <>
                              <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                              Test failed to execute (not a defect signal)
                            </>
                          )}
                          {!outcome && (runResult.status === 'passed' ? 'Test passed' : 'Test failed')}
                        </span>
                        {runResult.result?.patch_applied && (
                          <Badge variant="outline">
                            ran against fix
                            {runResult.result.patched_files?.length
                              ? ` (${runResult.result.patched_files.join(', ')})`
                              : ''}
                          </Badge>
                        )}
                        {runResult.proof_of_fix?.verdict === 'VERIFIED_FIX_PROOF' && (
                          <span className="chip state-verified">Verified fix proof</span>
                        )}
                      </div>
                      {runResult.proof_of_fix?.explanation && (
                        <p className="mb-2 text-xs text-muted-foreground">
                          {runResult.proof_of_fix.explanation}
                        </p>
                      )}
                      {runResult.result?.outcome_detail && (
                        <p className="mb-2 text-xs text-muted-foreground">{runResult.result.outcome_detail}</p>
                      )}
                      <pre className="max-h-40 overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                        {String(runResult.result?.summary ?? '')}
                      </pre>
                    </div>
                  );
                })()}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
              No test generated yet for this finding.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Counterexample */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Counterexample check
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => counterexample.mutate(findingId, { onSuccess: (data) => setProof(data) })}
            disabled={counterexample.isPending}
          >
            {counterexample.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Validate
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-[76ch] text-[13px] leading-relaxed text-muted-foreground">
            Walks the source → sink path looking for a sanitizer — escaping, parameterization,
            validation, type coercion. If one guards the sink, the finding cannot manifest on that
            path, and that is negative evidence against the claim.
          </p>
          {counterexample.isError && (
            <p className="rounded border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(counterexample.error)}
            </p>
          )}
          {proof &&
            (proof.counterexample ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">Counterexample found — the claim may not hold here</p>
                <p className="text-[13px] text-muted-foreground">{proof.counterexample.explanation}</p>
                <div className="grid gap-2 rounded border border-border bg-background p-3 font-mono text-xs">
                  <p className={toneHue('verified')}>
                    {proof.counterexample.sanitizer_line}: {proof.counterexample.sanitizer_snippet}
                  </p>
                  <p className="text-destructive">
                    {proof.counterexample.sink_line}: {proof.counterexample.sink_snippet}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border state-verified-soft p-4">
                <p className="text-sm font-medium">No sanitizer on the path — the claim stands</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  No counterexample found between source and sink.
                </p>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* 3. Validation battery */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" aria-hidden="true" /> Validation battery
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => validateFinding.mutate(findingId, { onSuccess: onValidation })}
            disabled={validateFinding.isPending}
          >
            {validateFinding.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Clipboard className="mr-2 h-4 w-4" />
            )}
            Run validation
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-[76ch] text-[13px] leading-relaxed text-muted-foreground">
            The validator opposes the claim: it checks the source → sink chain, sanitizer and
            parameterization guards, authorization, exception handling, deterministic rules and test
            references — then decides VERIFIED / PROBABLE / REJECTED with confidence. Every run is
            logged for false-positive reduction metrics.
          </p>
          {validateFinding.isError && (
            <p className="rounded border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(validateFinding.error)}
            </p>
          )}
          {validation && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 p-3">
                <FindingStateChip state={validation.final_status} />
                <span className="text-sm font-medium tabular-nums">
                  {Math.round(validation.confidence * 100)}% confidence
                </span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                  was {validation.original_status}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed">{validation.explanation}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{validation.claim}</p>

              <VerificationTimeline checks={validation.checks} />

              {validation.contradicting_evidence.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="mono-label">Contradicting evidence</p>
                  {validation.contradicting_evidence.map((c, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      • {c.label}: {c.detail}
                    </p>
                  ))}
                </div>
              )}
              {validation.supporting_evidence.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-border state-verified-soft p-3">
                  <p className="mono-label">Supporting evidence</p>
                  {validation.supporting_evidence.map((s, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      • {s.label}: {s.detail}
                    </p>
                  ))}
                </div>
              )}
              <p className="font-mono text-[10px] text-muted-foreground">
                validation run {validation.validation_run_id.slice(0, 8)} — recorded for research metrics
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
