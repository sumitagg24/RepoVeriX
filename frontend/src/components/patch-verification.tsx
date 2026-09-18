'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, ShieldX, Terminal, CheckCircle2, XCircle, MinusCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePatchVerifications, useVerificationRun, useVerifyPatch } from '@/hooks/usePatches';
import { getApiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { toneCallout, toneHue, toneInk, type Tone } from '@/lib/tone';
import type { Patch, VerificationRun } from '@/types/api';

/** Verification-run status → tone. Surfaces come from the shared token layer. */
const runStatusMeta: Record<string, { label: string; tone: Tone; icon: React.ReactNode }> = {
  pending: { label: 'Pending', tone: 'probable', icon: <MinusCircle className="h-4 w-4" /> },
  running: { label: 'Running', tone: 'observed', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  verified_repair: {
    label: 'Verified Repair',
    tone: 'verified',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  repair_failed: {
    label: 'Repair Failed',
    tone: 'critical',
    icon: <ShieldX className="h-4 w-4" />,
  },
  repair_not_verified: {
    label: 'Not Verified',
    tone: 'high',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

function statusFace(tone: Tone): string {
  return cn(toneCallout(tone), toneInk(tone));
}

const stepMeta = [
  { key: 'patch_applied', label: 'Patch Applied', ok: (r: VerificationRun) => r.patch_applied === true },
  { key: 'deps', label: 'Dependencies', ok: (r: VerificationRun) => r.deps_installed === true },
  { key: 'tests', label: 'Tests', ok: (r: VerificationRun) => r.tests_passed === true },
  { key: 'static', label: 'Static Analysis', ok: (r: VerificationRun) => r.static_passed === true },
  {
    key: 'finding',
    label: 'Finding Resolved',
    ok: (r: VerificationRun) => r.finding_still_detected === false,
  },
];

function StepRow({ run, step }: { run: VerificationRun; step: (typeof stepMeta)[number] }) {
  // tri-state: done / failed / not-run-yet
  let state: 'done' | 'failed' | 'pending' | 'skipped';
  const value = step.ok(run);
  if (value === true) state = 'done';
  else if (value === false) state = 'failed';
  else if (run.status === 'running' || run.status === 'pending') state = 'pending';
  else state = 'skipped';

  return (
    <div className="flex items-center gap-2 text-sm">
      {state === 'done' && <CheckCircle2 className={cn('h-4 w-4', toneHue('verified'))} />}
      {state === 'failed' && <XCircle className={cn('h-4 w-4', toneHue('critical'))} />}
      {state === 'pending' && (
        <Loader2 className={cn('h-4 w-4 animate-spin', toneHue('observed'))} />
      )}
      {state === 'skipped' && <MinusCircle className="h-4 w-4 text-muted-foreground/50" />}
      <span
        className={cn(
          state === 'failed' && 'text-destructive',
          state === 'done' && toneInk('verified'),
          state === 'skipped' && 'text-muted-foreground',
        )}
      >
        {step.label}
      </span>
    </div>
  );
}

function RunLogs({ verificationId }: { verificationId: string }) {
  const { data: detail } = useVerificationRun(verificationId);
  const [open, setOpen] = useState(false);
  if (!detail) return null;
  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Execution Logs
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {detail.logs && (
            <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/30">
              <pre className="p-3 font-mono text-xs overflow-x-auto max-h-72 whitespace-pre-wrap break-all leading-relaxed">
                <code>{detail.logs}</code>
              </pre>
            </div>
          )}
          {detail.test_results && detail.test_results.length > 0 && (
            <div className="border border-border/50 rounded-lg overflow-hidden">
              <div className="px-3 py-2.5 bg-muted/20 text-xs font-semibold uppercase tracking-wide border-b border-border/50">
                Test Results ({detail.test_results.length})
              </div>
              <ul className="divide-y divide-border/30">
                {detail.test_results.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-xs hover:bg-muted/15 transition-colors">
                    <span className="font-mono truncate">{t.test_name}</span>
                    <Badge
                      variant="outline"
                      className={cn('flex-shrink-0', statusFace(testOutcomeTone(t.outcome)))}
                    >
                      {t.outcome}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Test outcome → tone. `error` is not a pass and must not read as neutral. */
function testOutcomeTone(outcome: string | null | undefined): Tone {
  switch ((outcome ?? '').toLowerCase()) {
    case 'passed':
      return 'verified';
    case 'failed':
    case 'error':
      return 'critical';
    default:
      return 'neutral';
  }
}

function VerificationRunCard({ run }: { run: VerificationRun }) {
  const meta = runStatusMeta[run.status] || runStatusMeta.pending;
  return (
    <div className="border border-border/50 rounded-lg p-4 bg-muted/5 hover:bg-muted/10 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={statusFace(meta.tone)}>
            {meta.icon}
            <span className="font-semibold">{meta.label}</span>
          </Badge>
          {run.started_at && (
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(run.started_at).toLocaleString()}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-6 gap-y-3">
          {stepMeta.map((step) => (
            <StepRow key={step.key} run={run} step={step} />
          ))}
        </div>
      </div>
      <RunLogs verificationId={run.id} />
    </div>
  );
}

export function VerificationSection({ patch }: { patch: Patch }) {
  const { data: runs, isLoading } = usePatchVerifications(patch.id);
  const verify = useVerifyPatch();
  const busy = runs?.some((r) => r.status === 'pending' || r.status === 'running') || verify.isPending;
  const runsDesc = runs ? [...runs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [];
  const verifiable = patch.status === 'candidate' || patch.status === 'failed' || patch.status === 'not_verified';

  return (
    <div className="border-t border-border/50 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Terminal className="h-4.5 w-4.5 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wide">Fix Verification</span>
        </div>
        {verifiable && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => verify.mutate(patch.id)}
            className="gap-2"
          >
            {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify Fix
          </Button>
        )}
      </div>

      {verify.isError && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2.5 font-medium">
          {getApiErrorMessage(verify.error)}
        </p>
      )}

      {isLoading ? (
        <div className="h-16 bg-muted/20 animate-pulse rounded-lg border border-border/50" />
      ) : runsDesc.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-relaxed italic">
          No verification runs yet. Verification applies this patch to an isolated copy of the repository, runs the test suite, and re-analyzes the finding before declaring the repair verified.
        </p>
      ) : (
        <div className="space-y-3">
          {runsDesc.map((run) => (
            <VerificationRunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
