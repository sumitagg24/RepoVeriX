import type {
  FindingCategory,
  FindingSource,
  FindingStatus,
  PatchStatus,
  PlanInfo,
  PlanName,
  ScanConfiguration,
  ScanStatus,
  Severity,
  SourceType,
  VerificationStatus,
} from '@/types/api';

/**
 * One place that turns backend enums into display vocabulary.
 *
 * Severity and status are never communicated by colour alone: every map carries
 * a label (and an index for a stable ordering), so badges always render text.
 */

export type Tone = 'critical' | 'high' | 'medium' | 'low' | 'neutral' | 'verified' | 'primary';

export interface ToneStyle {
  /** Badge classes, includes a border so contrast holds on any surface. */
  badge: string;
  /** Small dot / glyph colour. */
  dot: string;
  /** Left rule used in dense rows. */
  rule: string;
  /** Chart / bar fill. */
  fill: string;
}

export const TONE_STYLES: Record<Tone, ToneStyle> = {
  critical: {
    badge: 'border-critical/30 bg-critical-soft text-critical',
    dot: 'bg-critical',
    rule: 'border-l-critical',
    fill: 'bg-critical',
  },
  high: {
    badge: 'border-high/30 bg-high-soft text-high',
    dot: 'bg-high',
    rule: 'border-l-high',
    fill: 'bg-high',
  },
  medium: {
    badge: 'border-medium/30 bg-medium-soft text-medium',
    dot: 'bg-medium',
    rule: 'border-l-medium',
    fill: 'bg-medium',
  },
  low: {
    badge: 'border-low/30 bg-low-soft text-low',
    dot: 'bg-low',
    rule: 'border-l-low',
    fill: 'bg-low',
  },
  neutral: {
    badge: 'border-line bg-neutral-soft text-ink-muted',
    dot: 'bg-ink-subtle',
    rule: 'border-l-line-strong',
    fill: 'bg-ink-subtle',
  },
  verified: {
    badge: 'border-verified/30 bg-verified-soft text-verified',
    dot: 'bg-verified',
    rule: 'border-l-verified',
    fill: 'bg-verified',
  },
  primary: {
    badge: 'border-primary/30 bg-primary-soft text-primary-ink',
    dot: 'bg-primary',
    rule: 'border-l-primary',
    fill: 'bg-primary',
  },
};

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'neutral',
};

/** Rank for sorting: lower is more urgent. */
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && (SEVERITIES as string[]).includes(value);
}

export function asSeverity(value: unknown): Severity {
  return isSeverity(value) ? value : 'info';
}

export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  verified: 'Verified',
  probable: 'Probable',
  rejected: 'Rejected',
};

export const FINDING_STATUS_TONE: Record<FindingStatus, Tone> = {
  verified: 'verified',
  probable: 'high',
  rejected: 'neutral',
};

/**
 * Finding status carries the evidence verdict: `verified` means the claim
 * survived evidence validation, `rejected` means it did not. The hint is shown
 * as a tooltip / help line so the distinction never depends on colour.
 */
export const FINDING_STATUS_HINT: Record<FindingStatus, string> = {
  verified: 'Evidence validation confirmed this claim against the repository code.',
  probable: 'The claim is grounded in evidence but a counterexample could not be ruled out.',
  rejected: 'Evidence validation refuted this claim, review the evidence chain before acting.',
};

export const CONFIDENCE_LABEL = (value: number) => `${Math.round(value * 100)}% confidence`;

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  pending: 'Verification queued',
  running: 'Verifying',
  verified_repair: 'Verified repair',
  repair_failed: 'Repair failed',
  repair_not_verified: 'Not verified',
};

export const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  pending: 'neutral',
  running: 'primary',
  verified_repair: 'verified',
  repair_failed: 'critical',
  repair_not_verified: 'medium',
};

/** Human sentence for the proof-of-fix decision key from the backend. */
export const PROOF_DECISION_LABEL: Record<string, string> = {
  VERIFIED_FIX: 'Verified fix',
  VERIFIED_FIX_PROOF: 'Verified by reproduction',
  REJECTED_FIX: 'Fix rejected',
  PARTIALLY_VERIFIED: 'Partially verified',
  UNVERIFIABLE: 'Could not verify',
  NO_PROOF: 'No proof yet',
};

export const PROOF_DECISION_TONE: Record<string, Tone> = {
  VERIFIED_FIX: 'verified',
  VERIFIED_FIX_PROOF: 'verified',
  REJECTED_FIX: 'critical',
  PARTIALLY_VERIFIED: 'medium',
  UNVERIFIABLE: 'neutral',
  NO_PROOF: 'neutral',
};

/** Proof-check state is three-valued: `null` means the check never ran. */
export function checkStateLabel(passed: boolean | null): string {
  if (passed === true) return 'passed';
  if (passed === false) return 'failed';
  return 'not run';
}

export const PATCH_STATUS_LABEL: Record<PatchStatus, string> = {
  candidate: 'Candidate',
  applied: 'Applied',
  verified: 'Verified',
  failed: 'Failed',
  not_verified: 'Not verified',
};

export const PATCH_STATUS_TONE: Record<PatchStatus, Tone> = {
  candidate: 'neutral',
  applied: 'primary',
  verified: 'verified',
  failed: 'critical',
  not_verified: 'medium',
};

export const SCAN_STATUS_LABEL: Record<ScanStatus, string> = {
  pending: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

export const SCAN_STATUS_TONE: Record<ScanStatus, Tone> = {
  pending: 'neutral',
  running: 'primary',
  completed: 'verified',
  failed: 'critical',
};

/** Honest one-line note about what each recorded scan status means. */
export const SCAN_STATUS_NOTE: Record<ScanStatus, string> = {
  pending: 'Queued, the worker has not picked it up yet.',
  running: 'In progress. Stages report as they start and finish.',
  completed: 'Finished. Findings were assembled and validated.',
  failed: 'Stopped before completion. The recorded error explains why.',
};

export const SCAN_CONFIGURATIONS: {
  value: ScanConfiguration;
  label: string;
  blurb: string;
  detail: string;
  needsLlm: boolean;
}[] = [
  {
    value: 'repoverix',
    label: 'RepoVeriX',
    blurb: 'Static analysis + LLM reasoning + evidence validation',
    detail:
      'The full pipeline: deterministic detectors and repository knowledge first, LLM reasoning on top, then evidence validation decides VERIFIED / PROBABLE / REJECTED.',
    needsLlm: true,
  },
  {
    value: 'static_llm',
    label: 'Static + LLM',
    blurb: 'Both engines, no evidence validation stage',
    detail:
      'Runs the deterministic detectors and the LLM analyzer and merges their output without the evidence-validation pass.',
    needsLlm: true,
  },
  {
    value: 'static_only',
    label: 'Static only',
    blurb: 'Deterministic detectors, no model calls',
    detail:
      'Fastest and fully deterministic. Findings come from the built-in detectors plus any available ruff/bandit adapters.',
    needsLlm: false,
  },
  {
    value: 'llm_only',
    label: 'LLM only',
    blurb: 'Model analysis without deterministic detectors',
    detail:
      'Useful for benchmark comparison: isolates what the model finds on its own, without static grounding.',
    needsLlm: true,
  },
];

export const FINDING_CATEGORIES: FindingCategory[] = [
  'security',
  'logic',
  'api_misuse',
  'database',
  'dependency',
  'reliability',
];

export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  security: 'Security',
  logic: 'Logic',
  api_misuse: 'API misuse',
  database: 'Database',
  dependency: 'Dependency',
  reliability: 'Reliability',
};

export const SOURCE_LABEL: Record<FindingSource, string> = {
  static: 'Static analysis',
  llm: 'Model reasoning',
  hybrid: 'Static + model',
};

export const EVIDENCE_KIND_LABEL: Record<string, string> = {
  source_input: 'Source of untrusted input',
  transformation: 'Transformation',
  sink: 'Sink',
  static_analysis: 'Static analysis',
  dependency: 'Dependency',
  test: 'Test',
  llm_reasoning: 'Model reasoning',
  call_relationship: 'Call relationship',
};

/**
 * The rule id the engine recorded on a finding's chain, if any.
 *
 * Findings have no rule column: the detector stamps `metadata.rule` onto the
 * first evidence node of a static chain. Reading it from there keeps the UI
 * honest — a finding whose chain does not carry a rule shows none.
 */
export function ruleIdFromEvidence(
  evidence: { metadata?: Record<string, unknown> | null }[],
): string | null {
  for (const node of evidence) {
    const rule = node.metadata?.rule;
    if (typeof rule === 'string' && rule.trim()) return rule;
  }
  return null;
}

/** The tool that produced a chain (`repoverix-builtin`, `semgrep`, …). */
export function toolFromEvidence(
  evidence: { metadata?: Record<string, unknown> | null }[],
): string | null {
  for (const node of evidence) {
    const tool = node.metadata?.tool;
    if (typeof tool === 'string' && tool.trim()) return tool;
  }
  return null;
}

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  git: 'Git',
  archive: 'Archive URL',
  zip: 'ZIP upload',
};

export const REPOSITORY_STATUS_LABEL: Record<string, string> = {
  ready: 'Ready',
  pending: 'Pending',
  ingesting: 'Importing',
  error: 'Error',
  failed: 'Failed',
};

export function repositoryStatusTone(status: string): Tone {
  if (status === 'ready') return 'verified';
  if (status === 'ingesting' || status === 'pending') return 'primary';
  if (status === 'error' || status === 'failed') return 'critical';
  return 'neutral';
}

export const PLAN_LABEL: Record<PlanName, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
};

/**
 * Plan limits mirror `backend/app/services/billing.py`. The server is the
 * enforcement point; this copy exists only so pricing and billing screens agree
 * with it. Live entitlement values always come from `GET /billing`.
 */
export interface PlanFacts {
  name: PlanName;
  displayName: string;
  priceMonthly: number;
  blurb: string;
  limits: {
    maxRepositories: number;
    scansPerMonth: number;
    fixesPerMonth: number;
    verificationsPerMonth: number;
    collaborators: number;
    llmEnabled: boolean;
    sandboxEnabled: boolean;
  };
  highlights: string[];
  popular?: boolean;
}

export const PLAN_CATALOG: Record<PlanName, PlanFacts> = {
  free: {
    name: 'free',
    displayName: 'Free',
    priceMonthly: 0,
    blurb: 'Evaluate RepoVeriX on a small repository. No card required.',
    limits: {
      maxRepositories: 3,
      scansPerMonth: 5,
      fixesPerMonth: 2,
      verificationsPerMonth: 2,
      collaborators: 1,
      llmEnabled: false,
      sandboxEnabled: false,
    },
    highlights: [
      '3 repositories',
      '5 scans per month',
      'Deterministic static findings',
      '2 candidate fixes',
      '2 sandbox verifications',
    ],
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    priceMonthly: 29,
    blurb: 'For developers auditing repositories every week.',
    limits: {
      maxRepositories: 20,
      scansPerMonth: 60,
      fixesPerMonth: 30,
      verificationsPerMonth: 30,
      collaborators: 1,
      llmEnabled: true,
      sandboxEnabled: true,
    },
    highlights: [
      '20 repositories',
      '60 scans per month',
      'Model reasoning included',
      'Unlimited findings and evidence',
      'Sandboxed repair verification',
      'Markdown and SARIF exports',
    ],
    popular: true,
  },
  team: {
    name: 'team',
    displayName: 'Team',
    priceMonthly: 99,
    blurb: 'For teams reviewing and fixing together.',
    limits: {
      maxRepositories: 100,
      scansPerMonth: 400,
      fixesPerMonth: 200,
      verificationsPerMonth: 200,
      collaborators: 5,
      llmEnabled: true,
      sandboxEnabled: true,
    },
    highlights: [
      '100 repositories',
      '400 scans per month',
      '5 collaborators',
      'Team dashboard and security center',
      'Everything in Pro',
    ],
  },
};

export const PLAN_ORDER: PlanName[] = ['free', 'pro', 'team'];

export function formatPlanLimit(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : String(value);
}

/** Usage ratio for a limit row; `null` when the plan is unlimited. */
export function usageRatio(used: number, limit: number): number | null {
  if (!Number.isFinite(limit) || limit <= 0) return null;
  return Math.min(1, used / limit);
}

export function planFromInfo(info: PlanInfo): PlanFacts {
  return PLAN_CATALOG[info.name] ?? PLAN_CATALOG.free;
}

/** Ordered, deduplicated language list for repository chips. */
export function languageList(languages: string[] | null | undefined): string[] {
  if (!languages) return [];
  return Array.from(new Set(languages.filter(Boolean))).slice(0, 4);
}

export const RISK_LEVEL_TONE: Record<string, Tone> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  none: 'verified',
};
