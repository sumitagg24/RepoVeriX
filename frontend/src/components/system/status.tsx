'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, MinusCircle, Loader2, AlertTriangle } from 'lucide-react';

/**
 * RVX verification + scan status language.
 * One mapping for verdicts everywhere: VERIFIED FIX / PARTIALLY VERIFIED /
 * REJECTED FIX / UNVERIFIABLE + scan lifecycle. Never color-alone: every
 * status pairs hue + icon + text (WCAG 2.2 AA-oriented).
 */

const DECISION_META: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  VERIFIED_FIX: {
    label: 'Verified fix',
    icon: CheckCircle2,
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  VERIFIED_REPAIR: {
    label: 'Verified fix',
    icon: CheckCircle2,
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  PARTIALLY_VERIFIED: {
    label: 'Partially verified',
    icon: AlertTriangle,
    className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  REJECTED_FIX: {
    label: 'Rejected fix',
    icon: XCircle,
    className: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
  },
  REPAIR_FAILED: {
    label: 'Rejected fix',
    icon: XCircle,
    className: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
  },
  UNVERIFIABLE: {
    label: 'Unverifiable',
    icon: MinusCircle,
    className: 'border-border bg-muted text-muted-foreground',
  },
  NOT_VERIFIED: {
    label: 'Not verified',
    icon: MinusCircle,
    className: 'border-border bg-muted text-muted-foreground',
  },
};

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
        meta.className,
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" /> {meta.label}
    </span>
  );
}

const SCAN_META: Record<string, { label: string; dot: string }> = {
  completed: { label: 'Completed', dot: 'bg-emerald-500' },
  running: { label: 'Running', dot: 'bg-sky-500 animate-pulse' },
  pending: { label: 'Queued', dot: 'bg-amber-500' },
  failed: { label: 'Failed', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', dot: 'bg-muted-foreground/60' },
};

export function ScanStatus({ status, className }: { status?: string | null; className?: string }) {
  const meta = SCAN_META[(status ?? '').toLowerCase()] ?? {
    label: status ?? 'Unknown',
    dot: 'bg-muted-foreground/60',
  };
  const spinning = (status ?? '').toLowerCase() === 'running';
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground', className)}
    >
      {spinning ? (
        <Loader2 className="h-3 w-3 animate-spin text-sky-500" aria-hidden="true" />
      ) : (
        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden="true" />
      )}
      {meta.label}
      <span className="sr-only">{`Scan status: ${meta.label}`}</span>
    </span>
  );
}
