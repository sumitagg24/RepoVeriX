import { cn } from '@/lib/utils';
import {
  asFindingState,
  asWebsiteState,
  FINDING_STATE_LABELS,
  WEBSITE_STATE_LABELS,
} from '@/lib/evidence';
import { AlertTriangle, CheckCircle2, Eye, HelpCircle, Lightbulb, MinusCircle } from 'lucide-react';

/**
 * VerdictBadge — the compact face of RepoVeriX's verdict vocabulary.
 *
 * Labels come from lib/evidence (the same source `components/evidence.tsx`
 * uses for its chip-lg solids), and surfaces come from the `.state-*` tokens.
 * Every badge pairs an icon with its label: status is never colour-only.
 *
 *   verified · probable · rejected   → finding status
 *   observed · recommendation · insufficient → website audit state
 */

const VERDICT_ICON = {
  verified: CheckCircle2,
  probable: AlertTriangle,
  rejected: MinusCircle,
  observed: Eye,
  recommendation: Lightbulb,
  insufficient: HelpCircle,
} as const;

const FINDING_STATES = ['verified', 'probable', 'rejected'] as const;
type VerdictKey = keyof typeof VERDICT_ICON;

function normalizeVerdict(status: string | null | undefined): VerdictKey {
  const key = (status ?? '').toLowerCase();
  if ((FINDING_STATES as readonly string[]).includes(key)) {
    return asFindingState(key);
  }
  if (key in VERDICT_ICON) return key as VerdictKey;
  return asWebsiteState(key);
}

function labelFor(key: VerdictKey): string {
  if ((FINDING_STATES as readonly string[]).includes(key)) {
    return FINDING_STATE_LABELS[asFindingState(key)];
  }
  if (key in WEBSITE_STATE_LABELS) {
    return WEBSITE_STATE_LABELS[asWebsiteState(key)];
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function VerdictBadge({
  status,
  variant = 'soft',
  size = 'sm',
  withIcon = true,
  className,
}: {
  status: string | null | undefined;
  variant?: 'soft' | 'solid';
  size?: 'sm' | 'lg';
  withIcon?: boolean;
  className?: string;
}) {
  const key = normalizeVerdict(status);
  const Icon = VERDICT_ICON[key];
  return (
    <span
      className={cn(
        'chip',
        size === 'lg' && 'chip-lg',
        variant === 'solid' ? `state-${key}` : `state-${key}-soft`,
        className
      )}
    >
      {withIcon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {labelFor(key)}
    </span>
  );
}

/** Scan lifecycle — same icon + label discipline, honest about failure. */
const SCAN_META: Record<string, { label: string; face: string }> = {
  completed: { label: 'Completed', face: 'state-verified-soft' },
  running: { label: 'Running', face: 'state-observed-soft' },
  pending: { label: 'Pending', face: 'state-probable-soft' },
  failed: { label: 'Failed', face: 'sev-critical-soft' },
};

export function ScanStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const key = (status ?? '').toLowerCase();
  const meta = SCAN_META[key] ?? {
    label: key ? key.replace(/_/g, ' ') : 'Unknown',
    face: 'chip-outline',
  };
  return (
    <span className={cn('chip capitalize', meta.face, className)}>
      <span className="chip-dot" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
