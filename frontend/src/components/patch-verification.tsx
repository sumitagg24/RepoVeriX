'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, ShieldX, Terminal, CheckCircle2, XCircle, MinusCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePatchVerifications, useVerificationRun, useVerifyPatch } from '@/hooks/usePatches';
import { getApiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import type { Patch, VerificationRun } from '@/types/api';

const runStatusMeta: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    badge: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    icon: <MinusCircle className="h-4 w-4" />,
  },
  running: {
    label: 'Running',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
  },
  verified_repair: {
    label: 'Verified Repair',
    badge: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  repair_failed: {
    label: 'Repair Failed',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    icon: <ShieldX className="h-4 w-4" />,
  },
  repair_not_verified: {
    label: 'Not Verified',
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

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
      {state === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
      {state === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
      {state === 'pending' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
      {state === 'skipped' && <MinusCircle className="h-4 w-4 text-muted-foreground/50" />}
      <span
        className={cn(
          state === 'failed' && 'text-destructive',
          state === 'done' && 'text-green-600 dark:text-green-400',
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
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Execution Logs
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {detail.logs && (
            <pre className="p-3 bg-muted rounded text-xs overflow-x-auto max-h-72 whitespace-pre-wrap break-all">
              <code>{detail.logs}</code>
            </pre>
          )}
          {detail.test_results && detail.test_results.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 text-xs font-medium border-b">Test Results ({detail.test_results.length})</div>
              <ul className="divide-y">
                {detail.test_results.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                    <span className="font-mono truncate">{t.test_name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'flex-shrink-0',
                        t.outcome === 'passed' && 'bg-green-500/10 text-green-600 border-green-500/20',
                        t.outcome === 'failed' && 'bg-red-500/10 text-red-600 border-red-500/20',
                        t.outcome === 'error' && 'bg-red-500/10 text-red-600 border-red-500/20',
                        t.outcome === 'skipped' && 'bg-gray-500/10 text-gray-600 border-gray-500/20',
                      )}
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

function VerificationRunCard({ run }: { run: VerificationRun }) {
  const meta = runStatusMeta[run.status] || runStatusMeta.pending;
  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={meta.badge}>
            {meta.icon}
            {meta.label}
          </Badge>
          {run.started_at && (
            <span className="text-xs text-muted-foreground">
              {new Date(run.started_at).toLocaleString()}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-6 gap-y-2">
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
    <div className="border-t p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Fix Verification</span>
        </div>
        {verifiable && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => verify.mutate(patch.id)}
          >
            {verify.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Verify Fix
          </Button>
        )}
      </div>

      {verify.isError && (
        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded px-3 py-2">
          {getApiErrorMessage(verify.error)}
        </p>
      )}

      {isLoading ? (
        <div className="h-16 bg-muted animate-pulse rounded-lg" />
      ) : runsDesc.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No verification runs yet. Verification applies this patch to an isolated copy of the
          repository, runs the test suite, and re-analyses the finding before declaring the repair verified.
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
