'use client';

import { CheckCircle2, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toneHue } from '@/lib/tone';
import type { ProofCheck } from '@/types/api';

/**
 * RVX VerificationTimeline — Proof of Fix as an honest timeline.
 * Finding → candidate patch → applied → reproduction → tests → static
 * analysis → re-analysis → regression → verdict. Each step carries a real
 * status; the final verdict uses VerificationBadge language. Never shows
 * success unless execution verified it.
 */

export const VERIFY_STEPS = [
  'Candidate patch',
  'Patch applied',
  'Reproduction',
  'Tests',
  'Static analysis',
  'Re-analysis',
  'Regression',
  'Verdict',
] as const;

function StepIcon({ state }: { state: boolean | null | undefined }) {
  if (state === true)
    return <CheckCircle2 className={cn('h-4 w-4', toneHue('verified'))} aria-hidden="true" />;
  if (state === false)
    return <XCircle className={cn('h-4 w-4', toneHue('critical'))} aria-hidden="true" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />;
}

export function VerificationTimeline({
  checks,
  running,
  className,
}: {
  checks: ProofCheck[];
  running?: boolean;
  className?: string;
}) {
  if (!checks.length) {
    return (
      <div className={cn('rounded-xl border border-dashed p-4 text-sm text-muted-foreground', className)} role="status">
        {running ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Verification running — steps appear as the sandbox reports them.
          </span>
        ) : (
          'No verification run yet. Generate a fix, then verify it — the timeline fills in from real sandbox output.'
        )}
      </div>
    );
  }
  return (
    <ol className={cn('relative space-y-0', className)} aria-label="Verification timeline">
      {checks.map((check, i) => (
        <li key={`${check.label}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < checks.length - 1 && (
            <span aria-hidden="true" className="absolute left-[7px] top-6 h-[calc(100%-1.25rem)] w-px bg-border" />
          )}
          <StepIcon state={check.passed} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">{check.label}</p>
            {check.detail && <p className="mt-0.5 break-words text-xs text-muted-foreground">{check.detail}</p>}
          </div>
          <span className="sr-only">{check.passed === true ? 'passed' : check.passed === false ? 'failed' : 'skipped'}</span>
        </li>
      ))}
    </ol>
  );
}
