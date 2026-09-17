/**
 * Evidence design system — pure label/band logic.
 *
 * Client-safe (no React) so it is directly unit-testable and reusable in
 * server components. Visual counterparts live in `components/evidence.tsx`.
 */

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FINDING_STATES = ['verified', 'probable', 'rejected'] as const;
export type FindingState = (typeof FINDING_STATES)[number];

export const WEBSITE_STATES = ['observed', 'recommendation', 'insufficient'] as const;
export type WebsiteState = (typeof WEBSITE_STATES)[number];

/** Canonical display labels — uppercase chip text. */
export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export const FINDING_STATE_LABELS: Record<FindingState, string> = {
  verified: 'Verified',
  probable: 'Probable',
  rejected: 'Rejected',
};

export const WEBSITE_STATE_LABELS: Record<WebsiteState, string> = {
  observed: 'Observed',
  recommendation: 'Recommendation',
  insufficient: 'Insufficient evidence',
};

/** Tolerant coercion of API strings onto the canonical scale. */
export function asSeverity(value: string | null | undefined): Severity {
  const v = (value ?? '').toLowerCase();
  return (SEVERITIES as readonly string[]).includes(v) ? (v as Severity) : 'info';
}

export function asFindingState(value: string | null | undefined): FindingState {
  const v = (value ?? '').toLowerCase();
  return (FINDING_STATES as readonly string[]).includes(v) ? (v as FindingState) : 'probable';
}

export function asWebsiteState(value: string | null | undefined): WebsiteState {
  const v = (value ?? '').toLowerCase();
  if ((WEBSITE_STATES as readonly string[]).includes(v)) return v as WebsiteState;
  // Website findings frequently reuse repository states; map them honestly.
  if (v === 'verified' || v === 'observed') return 'observed';
  if (v === 'probable') return 'recommendation';
  return 'insufficient';
}

/** RepoVeriX analytical score bands (0–100). */
export type ScoreBand = 'strong' | 'moderate' | 'weak' | 'unknown';

export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score == null || Number.isNaN(score)) return 'unknown';
  if (score >= 80) return 'strong';
  if (score >= 55) return 'moderate';
  return 'weak';
}

export const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Needs attention',
  unknown: 'Insufficient data',
};

/** Proof-of-Fix pipeline stage outcomes. */
export const PROOF_STAGES = ['pending', 'running', 'passed', 'failed', 'skipped'] as const;
export type ProofStageState = (typeof PROOF_STAGES)[number];

export const PROOF_STAGE_LABELS: Record<ProofStageState, string> = {
  pending: 'Pending',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
};
