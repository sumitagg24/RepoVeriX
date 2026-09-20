import * as React from 'react';
import {
  AlertTriangle,
  Check,
  CircleDashed,
  CircleSlash,
  Clock,
  HelpCircle,
  Loader2,
  MinusCircle,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Status vocabulary.
 *
 * Colour is never the only signal: every badge carries a written label, and the
 * geometric ones (severity dots, verdict icons) add a shape difference that
 * survives greyscale printing and colour-blind viewing.
 */
type Tone =
  | 'neutral'
  | 'accent'
  /* Alias of `accent`. The domain tone maps in lib/domain.ts call the same
     intent "primary", and a badge should not have to translate it. */
  | 'primary'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info'
  | 'verified'
  | 'probable'
  | 'rejected';

const TONES: Record<Tone, string> = {
  neutral: 'border-hairline bg-surface text-body',
  accent: 'border-accent-line bg-accent-soft text-accent',
  primary: 'border-accent-line bg-accent-soft text-accent',
  critical: 'border-critical-line bg-critical-soft text-critical',
  high: 'border-high-line bg-high-soft text-high',
  medium: 'border-medium-line bg-medium-soft text-medium',
  low: 'border-low-line bg-low-soft text-low',
  info: 'border-info-line bg-info-soft text-info',
  verified: 'border-verified-line bg-verified-soft text-verified',
  probable: 'border-probable-line bg-probable-soft text-probable',
  rejected: 'border-rejected-line bg-rejected-soft text-rejected',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  mono = false,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-px text-[12px] font-medium leading-5',
        mono && 'font-mono text-2xs',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- severity

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'info',
};

const SEVERITY_DOT: Record<Severity, string> = {
  critical: 'bg-critical',
  high: 'bg-high',
  medium: 'bg-medium',
  low: 'bg-low',
  info: 'bg-info',
};

export function SeverityBadge({
  severity,
  className,
  compact = false,
}: {
  severity: Severity;
  className?: string;
  /** Dot plus label without the filled background, for dense tables. */
  compact?: boolean;
}) {
  const known: Severity = SEVERITY_TONE[severity] ? severity : 'info';
  const tone = SEVERITY_TONE[known];
  const dot = SEVERITY_DOT[known];
  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium text-ink', className)}>
        <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
        {SEVERITY_LABEL[known]}
      </span>
    );
  }
  return (
    <Badge tone={tone} className={className}>
      <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
      {SEVERITY_LABEL[known]}
    </Badge>
  );
}

// ----------------------------------------------------------------- verdict

export function VerdictBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const value = (status ?? '').toLowerCase();
  if (value === 'verified') {
    return (
      <Badge tone="verified" className={className}>
        <Check className="size-3" aria-hidden="true" />
        Verified
      </Badge>
    );
  }
  if (value === 'probable') {
    return (
      <Badge tone="probable" className={className}>
        <HelpCircle className="size-3" aria-hidden="true" />
        Probable
      </Badge>
    );
  }
  if (value === 'rejected') {
    return (
      <Badge tone="rejected" className={className}>
        <X className="size-3" aria-hidden="true" />
        Rejected
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" className={className}>
      <CircleDashed className="size-3" aria-hidden="true" />
      Unverified
    </Badge>
  );
}

// --------------------------------------------------------------- scan state

const SCAN_STATES: Record<string, { tone: Tone; label: string; icon: React.ReactNode }> = {
  pending: { tone: 'info', label: 'Pending', icon: <Clock className="size-3" aria-hidden="true" /> },
  queued: { tone: 'info', label: 'Queued', icon: <Clock className="size-3" aria-hidden="true" /> },
  running: {
    tone: 'accent',
    label: 'Running',
    icon: <Loader2 className="size-3 animate-spin" aria-hidden="true" />,
  },
  completed: {
    tone: 'verified',
    label: 'Completed',
    icon: <Check className="size-3" aria-hidden="true" />,
  },
  failed: {
    tone: 'critical',
    label: 'Failed',
    icon: <AlertTriangle className="size-3" aria-hidden="true" />,
  },
  cancelled: {
    tone: 'rejected',
    label: 'Cancelled',
    icon: <CircleSlash className="size-3" aria-hidden="true" />,
  },
};

export function ScanStateBadge({ status, className }: { status: string; className?: string }) {
  const state = SCAN_STATES[status] ?? {
    tone: 'neutral' as Tone,
    label: status,
    icon: <CircleDashed className="size-3" aria-hidden="true" />,
  };
  return (
    <Badge tone={state.tone} className={className}>
      {state.icon}
      {state.label}
    </Badge>
  );
}

// ---------------------------------------------------------- repository state

const REPO_STATES: Record<string, { tone: Tone; label: string }> = {
  registered: { tone: 'info', label: 'Registered' },
  ingesting: { tone: 'accent', label: 'Ingesting' },
  ingested: { tone: 'verified', label: 'Ingested' },
  error: { tone: 'critical', label: 'Error' },
  failed: { tone: 'critical', label: 'Failed' },
  archived: { tone: 'neutral', label: 'Archived' },
};

export function RepoStateBadge({ state, className }: { state: string; className?: string }) {
  const value = REPO_STATES[state] ?? { tone: 'neutral' as Tone, label: state };
  return (
    <Badge tone={value.tone} className={className}>
      {value.label}
    </Badge>
  );
}

// -------------------------------------------------------------- provider

const PROVIDERS: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  git: 'Git',
  zip: 'ZIP upload',
  archive: 'Archive URL',
};

export function ProviderBadge({ provider, className }: { provider: string; className?: string }) {
  const label = PROVIDERS[provider] ?? provider;
  return (
    <span className={cn('chip', className)} title={label}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------- lifecycle

const FINDING_STATUSES: Record<string, { tone: Tone; label: string }> = {
  open: { tone: 'high', label: 'Open' },
  triaged: { tone: 'info', label: 'Triaged' },
  in_progress: { tone: 'accent', label: 'In progress' },
  fixed: { tone: 'verified', label: 'Fixed' },
  verified: { tone: 'verified', label: 'Verified' },
  probable: { tone: 'probable', label: 'Probable' },
  rejected: { tone: 'rejected', label: 'Rejected' },
  wont_fix: { tone: 'rejected', label: 'Wont fix' },
  ignored: { tone: 'neutral', label: 'Ignored' },
  resolved: { tone: 'verified', label: 'Resolved' },
};

export function FindingStatusBadge({ status, className }: { status: string; className?: string }) {
  const value = FINDING_STATUSES[status] ?? { tone: 'neutral' as Tone, label: status };
  return (
    <Badge tone={value.tone} className={className}>
      {value.label}
    </Badge>
  );
}

export function PlanBadge({ plan, className }: { plan: string; className?: string }) {
  const labels: Record<string, string> = { free: 'Free', pro: 'Pro', team: 'Team' };
  const tone: Tone = plan === 'free' ? 'neutral' : 'accent';
  return (
    <Badge tone={tone} className={className}>
      {labels[plan] ?? plan}
    </Badge>
  );
}

/** Neutral inline marker for "not available" values. */
export function NotAvailable({ label = 'Not recorded' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-faint">
      <MinusCircle className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
