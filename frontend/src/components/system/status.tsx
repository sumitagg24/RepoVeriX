'use client';

import { cn } from '@/lib/utils';
import { decisionTone, scanTone, toneBar, toneCallout, toneHue, toneInk } from '@/lib/tone';
import { CheckCircle2, XCircle, MinusCircle, Loader2, AlertTriangle } from 'lucide-react';

/**
 * RVX verification + scan status language.
 * One mapping for verdicts everywhere: VERIFIED FIX / PARTIALLY VERIFIED /
 * REJECTED FIX / UNVERIFIABLE + scan lifecycle. Never color-alone: every
 * status pairs hue + icon + text (WCAG 2.2 AA-oriented).
 */

/** Decision → label + icon. The *surface* comes from `decisionTone`, so the
 *  colours cannot drift from the tokens the rest of the app uses. */
const DECISION_META: Record<string, { label: string; icon: typeof CheckCircle2 }> = {
  VERIFIED_FIX: { label: 'Verified fix', icon: CheckCircle2 },
  VERIFIED_FIX_PROOF: { label: 'Verified fix', icon: CheckCircle2 },
  VERIFIED_REPAIR: { label: 'Verified fix', icon: CheckCircle2 },
  PARTIALLY_VERIFIED: { label: 'Partially verified', icon: AlertTriangle },
  REJECTED_FIX: { label: 'Rejected fix', icon: XCircle },
  REPAIR_FAILED: { label: 'Rejected fix', icon: XCircle },
  UNVERIFIABLE: { label: 'Unverifiable', icon: MinusCircle },
  NOT_VERIFIED: { label: 'Not verified', icon: MinusCircle },
};

function decisionFace(decision: string): string {
  const tone = decisionTone(decision);
  return cn(toneCallout(tone), toneInk(tone));
}

export function VerificationBadge({ decision, className }: { decision?: string | null; className?: string }) {
  const key = (decision ?? '').toUpperCase();
  const meta = DECISION_META[key];
  if (!meta) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground',
          className
        )}
      >
        <MinusCircle className="h-3 w-3" aria-hidden="true" /> No validated fix yet
      </span>
    );
  }
  const Icon = meta.icon;
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        decisionFace(key),
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" /> {meta.label}
    </span>
  );
}

const SCAN_LABELS: Record<string, string> = {
  completed: 'Completed',
  running: 'Running',
  pending: 'Queued',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** Lifecycle dot colour, from the shared `scanTone` mapping. */
function scanDot(status: string | null | undefined): string {
  return cn(toneBar(scanTone(status)), (status ?? '').toLowerCase() === 'running' && 'animate-pulse');
}

function scanLabel(status: string | null | undefined): string {
  const key = (status ?? '').toLowerCase();
  return SCAN_LABELS[key] ?? status ?? 'Unknown';
}

export function ScanStatus({ status, className }: { status?: string | null; className?: string }) {
  const label = scanLabel(status);
  const spinning = (status ?? '').toLowerCase() === 'running';
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground', className)}
    >
      {spinning ? (
        <Loader2 className={cn('h-3 w-3 animate-spin', toneHue('observed'))} aria-hidden="true" />
      ) : (
        <span className={cn('h-1.5 w-1.5 rounded-full', scanDot(status))} aria-hidden="true" />
      )}
      {label}
      <span className="sr-only">{`Scan status: ${label}`}</span>
    </span>
  );
}
