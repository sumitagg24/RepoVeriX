'use client';

import { CheckCircle2, XCircle, MinusCircle, ShieldCheck, FileCode, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProofOfFix } from '@/hooks/useAudit';
import type { ProofCheck } from '@/types/api';

const DECISION_STYLES: Record<string, string> = {
  VERIFIED_FIX: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  REJECTED_FIX: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  PARTIALLY_VERIFIED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  UNVERIFIABLE: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
};

function CheckRow({ check }: { check: ProofCheck }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {check.passed === true ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
      ) : check.passed === false ? (
        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      ) : (
        <MinusCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      )}
      <div>
        <span className="font-medium">{check.label}</span>
        {check.detail && <p className="text-xs text-muted-foreground">{check.detail}</p>}
      </div>
    </li>
  );
}

export function ProofOfFixPanel({ findingId }: { findingId: string }) {
  const { data: proof, isLoading, isError } = useProofOfFix(findingId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Proof of Fix
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading proof record…</p>
        ) : isError || !proof ? (
          <p className="text-sm text-muted-foreground">
            Proof record unavailable — run a validation to build one.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {proof.decision ? (
                <Badge variant="outline" className={DECISION_STYLES[proof.decision] ?? ''}>
                  {proof.decision}
                </Badge>
              ) : (
                <Badge variant="outline">No validated fix yet</Badge>
              )}
              {proof.reproduction && (
                <Badge variant="outline" className="gap-1">
                  <FlaskConical className="h-3 w-3" />
                  Reproduction: {proof.reproduction.outcome ?? 'not run'}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {proof.patches.length} patch{proof.patches.length === 1 ? '' : 'es'} ·{' '}
                {proof.evidence_before.length} evidence nodes
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{proof.decision_reason}</p>

            {proof.checks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Validation checks
                </p>
                <ul className="space-y-1.5">
                  {proof.checks.map((c) => (
                    <CheckRow key={c.key} check={c} />
                  ))}
                </ul>
              </div>
            )}

            {proof.patches.map((patch) => (
              <div key={patch.patch_id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs">{patch.generated_by}</span>
                  {patch.decision && (
                    <Badge variant="outline" className={DECISION_STYLES[patch.decision] ?? ''}>
                      {patch.decision}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {patch.changed_files.length} file(s), {patch.changed_line_count} lines
                  </span>
                </div>
                {patch.changed_files.length > 0 && (
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {patch.changed_files.join(', ')}
                  </p>
                )}
                {patch.runs.map((run) => (
                  <details key={run.id} className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">
                      Run {run.status} — {run.decision ?? '—'} · tests{' '}
                      {run.tests_passed === null ? 'n/a' : run.tests_passed ? 'passed' : 'failed'} ·
                      static {run.static_passed === null ? 'n/a' : run.static_passed ? 'clean' : 'issues'} ·
                      finding {run.finding_still_detected === null ? 'n/a' : run.finding_still_detected ? 'still detected' : 'gone'} ·{' '}
                      {run.test_count} test result(s)
                    </summary>
                    {run.log_excerpt && (
                      <pre className="mt-2 p-2 bg-muted rounded whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {run.log_excerpt}
                      </pre>
                    )}
                  </details>
                ))}
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
