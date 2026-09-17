import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  asFindingState,
  asSeverity,
  asWebsiteState,
  FINDING_STATE_LABELS,
  PROOF_STAGE_LABELS,
  scoreBand,
  SEVERITY_LABELS,
  WEBSITE_STATE_LABELS,
  type FindingState,
  type ProofStageState,
  type Severity,
  type WebsiteState,
} from '@/lib/evidence';
import { CheckCircle2, HelpCircle, Loader2, MinusCircle, ShieldAlert } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Severity chips — the canonical severity language across the product.       */
/* -------------------------------------------------------------------------- */

const SEVERITY_CHIP: Record<Severity, { solid: string; soft: string }> = {
  critical: { solid: 'sev-critical', soft: 'sev-critical-soft' },
  high: { solid: 'sev-high', soft: 'sev-high-soft' },
  medium: { solid: 'sev-medium', soft: 'sev-medium-soft' },
  low: { solid: 'sev-low', soft: 'sev-low-soft' },
  info: { solid: 'sev-info', soft: 'sev-info-soft' },
};

export function SeverityChip({
  severity,
  variant = 'soft',
  className,
}: {
  severity: string | null | undefined;
  variant?: 'solid' | 'soft';
  className?: string;
}) {
  const sev = asSeverity(severity);
  const face = SEVERITY_CHIP[sev];
  return (
    <span className={cn('chip', variant === 'solid' ? face.solid : face.soft, className)}>
      <span className="chip-dot" aria-hidden="true" />
      {SEVERITY_LABELS[sev]}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Finding state chips — VERIFIED / PROBABLE / REJECTED (repository)          */
/* -------------------------------------------------------------------------- */

const STATE_CHIP: Record<FindingState, { solid: string; soft: string; icon: typeof CheckCircle2 }> = {
  verified: { solid: 'state-verified', soft: 'state-verified-soft', icon: CheckCircle2 },
  probable: { solid: 'state-probable', soft: 'state-probable-soft', icon: HelpCircle },
  rejected: { solid: 'state-rejected', soft: 'state-rejected-soft', icon: MinusCircle },
};

export function FindingStateChip({
  state,
  variant = 'soft',
  withIcon = true,
  className,
}: {
  state: string | null | undefined;
  variant?: 'solid' | 'soft';
  withIcon?: boolean;
  className?: string;
}) {
  const st = asFindingState(state);
  const face = STATE_CHIP[st];
  const Icon = face.icon;
  return (
    <span className={cn('chip', variant === 'solid' ? face.solid : face.soft, className)}>
      {withIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {FINDING_STATE_LABELS[st]}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Website finding states — OBSERVED / RECOMMENDATION / INSUFFICIENT          */
/* -------------------------------------------------------------------------- */

const WEBSITE_CHIP: Record<WebsiteState, { solid: string; soft: string; icon: typeof CheckCircle2 }> = {
  observed: { solid: 'state-observed', soft: 'state-observed-soft', icon: CheckCircle2 },
  recommendation: {
    solid: 'state-recommendation',
    soft: 'state-recommendation-soft',
    icon: ShieldAlert,
  },
  insufficient: { solid: 'state-insufficient', soft: 'state-insufficient-soft', icon: HelpCircle },
};

export function WebsiteStateChip({
  state,
  variant = 'soft',
  withIcon = true,
  className,
}: {
  state: string | null | undefined;
  variant?: 'solid' | 'soft';
  withIcon?: boolean;
  className?: string;
}) {
  const st = asWebsiteState(state);
  const face = WEBSITE_CHIP[st];
  const Icon = face.icon;
  return (
    <span className={cn('chip', variant === 'solid' ? face.solid : face.soft, className)}>
      {withIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {WEBSITE_STATE_LABELS[st]}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Dimension score meter — analytical score with honest "no data" state.      */
/* -------------------------------------------------------------------------- */

export function ScoreMeter({
  label,
  score,
  hint,
  className,
}: {
  label: string;
  score: number | null | undefined;
  hint?: string;
  className?: string;
}) {
  const band = scoreBand(score);
  const hasScore = score != null && !Number.isNaN(score);
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="mono-label">{label}</span>
        <span className={cn('text-sm font-semibold tabular-nums', `band-${band}`)}>
          {hasScore ? Math.round(score) : '—'}
        </span>
      </div>
      <div
        className={cn('score-meter mt-1.5', `band-${band}`)}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hasScore ? Math.round(score) : undefined}
        aria-label={`${label} score`}
      >
        {hasScore ? <span style={{ width: `${Math.max(2, Math.min(100, score))}%` }} /> : null}
      </div>
      {(hint || !hasScore) && (
        <p className="mt-1 text-xs text-muted-foreground">{hint ?? 'Insufficient data to score'}</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Proof-of-Fix pipeline — stage rail mirroring the backend verification run. */
/* -------------------------------------------------------------------------- */

const PROOF_ICON: Record<ProofStageState, typeof CheckCircle2> = {
  pending: MinusCircle,
  running: Loader2,
  passed: CheckCircle2,
  failed: ShieldAlert,
  skipped: MinusCircle,
};

const PROOF_FACE: Record<ProofStageState, string> = {
  pending: 'text-muted-foreground',
  running: 'text-primary',
  passed: 'text-foreground',
  failed: 'text-destructive',
  skipped: 'text-muted-foreground/60',
};

export function ProofStageRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: string | null | undefined;
  detail?: string | null;
}) {
  const st = (
    ['pending', 'running', 'passed', 'failed', 'skipped'].includes((state ?? '').toLowerCase())
      ? (state as ProofStageState).toLowerCase()
      : 'pending'
  ) as ProofStageState;
  const Icon = PROOF_ICON[st];
  return (
    <li className="flex items-start gap-3">
      <span className={cn('chain-node mt-0.5', st === 'passed' && 'chain-node-active', PROOF_FACE[st])}>
        <Icon className={cn('h-3.5 w-3.5', st === 'running' && 'animate-spin')} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {(detail || st === 'pending') && (
          <p className="truncate text-xs text-muted-foreground">{detail ?? PROOF_STAGE_LABELS[st]}</p>
        )}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Evidence chain — Source → Flow → Sink → Evidence → Finding                 */
/* -------------------------------------------------------------------------- */

export interface ChainNode {
  label: string;
  detail?: string | null;
  href?: string;
}

export function EvidenceChain({
  nodes,
  ariaLabel = 'Evidence chain',
  className,
}: {
  nodes: ChainNode[];
  ariaLabel?: string;
  className?: string;
}) {
  if (nodes.length === 0) return null;
  return (
    <ol className={cn('flex flex-wrap items-center gap-y-2', className)} aria-label={ariaLabel}>
      {nodes.map((node, i) => (
        <li key={`${node.label}-${i}`} className="flex items-center">
          {i > 0 && <span className="chain-line mx-2 h-px w-6" aria-hidden="true" />}
          <span className="flex items-center gap-2">
            <span className="chain-node text-[10px] font-bold tabular-nums">{i + 1}</span>
            {node.href ? (
              <a
                href={node.href}
                className="focus-ring rounded text-sm font-medium text-foreground underline-offset-4 hover:underline"
              >
                {node.label}
              </a>
            ) : (
              <span className="text-sm font-medium text-foreground">{node.label}</span>
            )}
            {node.detail && <span className="text-xs text-muted-foreground">{node.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Trust badge — "this score is RepoVeriX's analysis, not a third party's"    */
/* -------------------------------------------------------------------------- */

export function AnalyticalScoreBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', className)}>
      RepoVeriX analytical score
    </Badge>
  );
}
