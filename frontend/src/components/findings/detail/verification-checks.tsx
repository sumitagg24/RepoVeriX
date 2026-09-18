import { cn } from '@/lib/utils';
import { toneHue } from '@/lib/tone';
import type { Evidence, Finding, FindingValidationResult, RunTestResponse } from '@/types/api';
import { CheckCircle2, CircleDashed, MinusCircle } from 'lucide-react';

/**
 * VerificationChecks — the claim broken into what was actually proven.
 *
 * Every row is derived from data the API returned; nothing is assumed. A step
 * with no supporting data renders as "not determined" instead of a tick, which
 * is the whole point: a checklist that ticks itself is worse than no checklist,
 * because it launders an absence of evidence into apparent proof.
 *
 * Sources, in order of authority:
 *  - evidence rows (what the detectors located),
 *  - validation checks (what the validator proved or refuted),
 *  - the patch record (whether a repair survived execution),
 *  - a test run payload, when the user has actually run one this session.
 */

type CheckState = 'confirmed' | 'failed' | 'unknown';

type Check = { label: string; state: CheckState; detail: string };

function hasKind(evidence: Evidence[], kind: string) {
  return evidence.some((e) => e.kind.toLowerCase() === kind);
}

function validationCheck(
  validation: FindingValidationResult | null,
  pattern: RegExp,
): { label: string; passed: boolean | null; detail?: string } | undefined {
  return validation?.checks.find((c) => pattern.test(c.label));
}

function StateIcon({ state }: { state: CheckState }) {
  if (state === 'confirmed') {
    return (
      <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', toneHue('verified'))} aria-hidden="true" />
    );
  }
  if (state === 'failed') {
    return <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />;
  }
  return <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />;
}

const STATE_TEXT: Record<CheckState, string> = {
  confirmed: 'confirmed',
  failed: 'refuted',
  unknown: 'not determined',
};

export function VerificationChecks({
  finding,
  evidence = [],
  validation = null,
  hasVerifiedPatch = false,
  testRun = null,
}: {
  finding: Finding;
  evidence?: Evidence[];
  validation?: FindingValidationResult | null;
  hasVerifiedPatch?: boolean;
  testRun?: RunTestResponse | null;
}) {
  const sanitizer = validationCheck(validation, /sanitiz|parameter|guard/i);
  const reachability = validationCheck(validation, /reachab|path/i);
  const reproduction = validationCheck(validation, /reproduc|exploit|test/i);

  const outcome = testRun?.result?.outcome;

  const checks: Check[] = [
    {
      label: 'Untrusted source identified',
      state: hasKind(evidence, 'source_input') ? 'confirmed' : 'unknown',
      detail: hasKind(evidence, 'source_input')
        ? 'An input node was located and recorded in the evidence chain.'
        : 'No source_input evidence row exists for this finding.',
    },
    {
      label: 'Reachable sink located',
      state: hasKind(evidence, 'sink') ? 'confirmed' : 'unknown',
      detail: hasKind(evidence, 'sink')
        ? 'A sink node was located and linked to the chain.'
        : 'No sink evidence row exists for this finding.',
    },
    {
      label: 'Data flow established',
      state: hasKind(evidence, 'call_relationship')
        ? 'confirmed'
        : reachability?.passed === true
          ? 'confirmed'
          : reachability?.passed === false
            ? 'failed'
            : 'unknown',
      detail:
        reachability?.detail ??
        (hasKind(evidence, 'call_relationship')
          ? 'Call relationships were recorded between the source and the sink.'
          : 'Run validation to have the chain checked source → sink.'),
    },
    {
      label: 'No sanitizer on the path',
      state: sanitizer ? (sanitizer.passed ? 'confirmed' : 'failed') : 'unknown',
      detail:
        sanitizer?.detail ??
        'Not yet checked. The counterexample validator hunts for a sanitizer between source and sink.',
    },
    {
      label: 'Defect reproduced',
      state:
        outcome === 'TEST_REPRODUCES_BUG'
          ? 'confirmed'
          : outcome === 'TEST_DOES_NOT_REPRODUCE'
            ? 'failed'
            : reproduction
              ? reproduction.passed
                ? 'confirmed'
                : 'failed'
              : 'unknown',
      detail:
        (outcome === 'TEST_REPRODUCES_BUG' &&
          'The generated test fails on this code, demonstrating the defect.') ||
        (outcome === 'TEST_DOES_NOT_REPRODUCE' &&
          'The generated test passed on this code — the defect did not reproduce.') ||
        reproduction?.detail ||
        'Generate and run a regression test to attempt reproduction.',
    },
    {
      label: 'Repair survives execution',
      state: hasVerifiedPatch
        ? 'confirmed'
        : finding.status === 'rejected'
          ? 'failed'
          : 'unknown',
      detail: hasVerifiedPatch
        ? 'A patch was applied and verified against this finding.'
        : 'No verified patch for this finding yet.',
    },
  ];

  const confirmed = checks.filter((c) => c.state === 'confirmed').length;
  const verdict: CheckState =
    finding.status === 'verified' ? 'confirmed' : finding.status === 'rejected' ? 'failed' : 'unknown';

  return (
    <section aria-label="Verification" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mono-label">Verification</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {confirmed} of {checks.length} steps confirmed from recorded evidence.
          </p>
        </div>
        <span
          className={cn(
            'chip chip-lg',
            verdict === 'confirmed'
              ? 'state-verified'
              : verdict === 'failed'
                ? 'state-rejected'
                : 'state-observed',
          )}
        >
          {verdict === 'confirmed' ? 'Verified' : verdict === 'failed' ? 'Rejected' : 'Unverified'}
        </span>
      </div>

      <ul className="divide-y divide-border/50 border-t border-border/60">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start gap-3 py-3">
            <StateIcon state={check.state} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-snug">{check.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
            </div>
            <span
              className={cn(
                'mono-label shrink-0 pt-0.5',
                check.state === 'confirmed' && toneHue('verified'),
                check.state === 'failed' && 'text-destructive',
              )}
            >
              {STATE_TEXT[check.state]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
