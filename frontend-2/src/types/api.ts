/**
 * Backend contract types.
 *
 * These mirror the FastAPI response models the interface consumes. They are the
 * only place the shapes live: services import from here, hooks return them, and
 * screens render them. Field names match the API exactly (snake_case), so a
 * backend rename shows up as a compile error rather than a blank cell.
 */

// ------------------------------------------------------------------ primitives

export type SourceType = 'github' | 'gitlab' | 'git' | 'archive' | 'zip';
export type RepositoryStatus = 'ready' | 'pending' | 'ingesting' | 'error';
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ScanConfiguration = 'repoverix' | 'static_only' | 'llm_only' | 'static_llm';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
/** The validation verdict: there is no third "open" state to fall back to. */
export type FindingStatus = 'verified' | 'probable' | 'rejected';
export type FindingCategory =
  | 'security'
  | 'logic'
  | 'api_misuse'
  | 'database'
  | 'dependency'
  | 'reliability';
/** Which analyser produced the claim. */
export type FindingSource = 'static' | 'llm' | 'hybrid';
export type EvidenceKind =
  | 'source_input'
  | 'transformation'
  | 'sink'
  | 'static_analysis'
  | 'dependency'
  | 'test'
  | 'llm_reasoning'
  | 'call_relationship';
export type VerificationStatus =
  | 'pending'
  | 'running'
  | 'verified_repair'
  | 'repair_failed'
  | 'repair_not_verified';
export type PatchStatus = 'candidate' | 'applied' | 'verified' | 'failed' | 'not_verified';
export type PlanName = 'free' | 'pro' | 'team';
export type OrgRole = 'member' | 'admin' | 'owner';

/**
 * One plan as the API reports it. Only the fields the interface reads are
 * named; the catalogue itself lives in `lib/plans.ts` for signed-out pages.
 */
export interface PlanInfo {
  name: PlanName;
  price_monthly: number;
  max_repositories: number;
  scans_per_month: number;
  fixes_per_month: number;
  verifications_per_month: number;
  website_audits_per_month: number;
  collaborators: number;
  llm_enabled: boolean;
  sandbox_enabled: boolean;
}

export interface Timestamped {
  id: string;
  created_at: string;
  updated_at?: string;
}

// ------------------------------------------------------------------------ auth

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  email_verified: boolean;
  email_verified_at: string | null;
  plan: PlanName;
  role?: OrgRole | null;
  organization_id?: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  email_verified?: boolean;
  /** Present only on deployments that log mail instead of sending it. */
  dev_verification_url?: string | null;
}

export interface SecurityEvent {
  event: string;
  at: string;
  ip: string | null;
  detail: Record<string, unknown>;
}

export interface SecurityOverview {
  email_verified: boolean;
  account_status: string;
  mfa_status: string;
  last_login_at: string | null;
  active_sessions: number;
  password_changed_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  recent_events: SecurityEvent[];
}

// ------------------------------------------------------------------ repositories

export interface Repository extends Timestamped {
  name: string;
  source_type: SourceType;
  source_url: string | null;
  default_branch: string;
  status: RepositoryStatus;
  storage_path: string | null;
  primary_languages: string[] | null;
  last_scan_at?: string | null;
  scan_count?: number;
  finding_count?: number;
}

export interface RepositoryCreate {
  name: string;
  source_type: SourceType;
  source_url?: string | null;
  default_branch?: string;
}

export interface ArchiveImport {
  url: string;
  name?: string;
  default_branch?: string;
}

export interface OAuthImport {
  provider: 'github' | 'gitlab';
  repo_path: string;
  name?: string;
  default_branch?: string;
}

export interface RepositoryHealthFile {
  path: string;
  score: number;
  issues: { detector: string; lens: string; title: string }[];
}

export interface RepositoryIntelligence {
  repository_id: string;
  status: 'pending' | 'running' | 'ready' | 'failed';
  error: string | null;
  generated_at: string | null;
  health: {
    files_scored: number;
    detector_count: number;
    average_score: number | null;
    worst_files: string[];
    files: { path: string; score: number }[];
    refactor_targets: { path: string; score: number; issues: { detector: string; lens: string; title: string }[] }[];
  };
  git: {
    available: boolean;
    reason?: string | null;
    commits_analyzed?: number;
    authors?: number;
    commits_last_30d?: number;
    hotspots?: { path: string; hotspot_score: number }[];
  };
  architecture: {
    nodes: { id: string; label: string; files: number; symbols: number }[];
    edges: { source: string; target: string; weight: number }[];
  };
}

export interface AttackPath {
  id: string;
  entry_point: string;
  sink: string;
  severity: Severity;
  steps: string[];
}

export interface AttackPaths {
  repository_id: string;
  paths: AttackPath[];
}

export interface DependencyReachability {
  repository_id: string;
  vulnerable_packages: {
    name: string;
    version: string;
    severity: Severity;
    reachable: boolean;
    dependents: string[];
  }[];
}

export interface EvidenceGraph {
  repository_id: string;
  nodes: { id: string; kind: string; label: string }[];
  edges: { source: string; target: string; kind: string }[];
}

export interface RegressionReport {
  repository_id: string;
  new_findings: Finding[];
  resolved_findings: Finding[];
}

export interface ChangeAuditResult {
  verdict: 'pass' | 'warn' | 'fail';
  summary: string;
  findings: Finding[];
}

// ------------------------------------------------------------------------- scans

export interface Scan extends Timestamped {
  repository_id: string;
  status: ScanStatus;
  configuration: ScanConfiguration;
  started_at: string | null;
  finished_at: string | null;
  error?: string | null;
  progress?: number | null;
}

export interface AnalysisRun {
  id: string;
  scan_id: string;
  stage: string;
  tool_name: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  started_at: string | null;
  finished_at: string | null;
  output: Record<string, unknown> | null;
}

export interface ScanDetail extends Scan {
  analysis_runs?: AnalysisRun[];
  finding_count?: number;
}

export interface ScanCreate {
  repository_id: string;
  configuration?: ScanConfiguration;
}

export interface FindingSummary {
  scan_id: string;
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
}

export interface DedupReport {
  scan_id: string;
  duplicates: { kept: string; dropped: string[]; reason: string }[];
}

export interface ReportShare {
  id: string;
  scan_id: string;
  token: string;
  url?: string;
  expires_at: string | null;
  created_at: string;
}

// --------------------------------------------------------------------- findings

export interface Evidence {
  id: string;
  finding_id: string;
  kind: EvidenceKind;
  description: string;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  snippet: string | null;
  order_index: number;
  /**
   * Detector bookkeeping. `rule` (the RVX-* rule id) and `tool` are attached to
   * the first node of a chain; findings themselves carry no rule column, so
   * this is where a rule id comes from when the engine recorded one.
   */
  metadata?: Record<string, unknown> | null;
}

/**
 * A finding, exactly as `GET /api/v1/findings` returns it.
 *
 * There is deliberately no `rule_id`, `language` or `repository_id` here: the
 * database has no such columns. Rule identity, when recorded, lives in the
 * evidence metadata; repository identity comes from the finding's scan.
 */
export interface Finding extends Timestamped {
  scan_id: string;
  title: string;
  description: string;
  impact: string | null;
  recommendation: string | null;
  severity: Severity;
  status: FindingStatus;
  category: FindingCategory;
  source: FindingSource;
  confidence: number;
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  function_name: string | null;
  /** Hash of rule, file and line: stable within a scan, not a rule identity. */
  external_id: string;
}

/** `GET /api/v1/findings/{id}`: the finding plus its chain and patches. */
export interface FindingDetail extends Finding {
  evidence: Evidence[];
  patches: Patch[];
}

export interface FindingListParams {
  repository_id?: string;
  scan_id?: string;
  severity?: string;
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface ImpactAnalysis {
  finding_id: string;
  reachable: boolean;
  affected_files: string[];
  call_chain: { file: string; symbol: string; line: number | null }[];
  summary: string;
}

/**
 * Proof-of-Fix record.
 *
 * The backend derives the decision from recorded verification runs and
 * reproduction outcomes, never from a model's self-assessment, so the frontend
 * renders `decision` and `decision_reason` verbatim and lets the reader see the
 * checks and runs that produced them.
 */
export type ProofDecision =
  | 'VERIFIED_FIX'
  | 'REJECTED_FIX'
  | 'PARTIALLY_VERIFIED'
  | 'UNVERIFIABLE'
  | null;

export interface ProofCheck {
  key: string;
  label: string;
  /** `null` means the check could not run, which is not the same as failing. */
  passed: boolean | null;
  detail: string;
}

export interface ProofRun {
  id: string;
  status: string;
  decision: ProofDecision;
  patch_applied: boolean | null;
  deps_installed: boolean | null;
  tests_passed: boolean | null;
  static_passed: boolean | null;
  finding_still_detected: boolean | null;
  started_at: string | null;
  finished_at: string | null;
  log_excerpt: string;
  test_count: number;
}

export interface ProofPatch {
  patch_id: string;
  patch_status: PatchStatus;
  generated_by: string;
  changed_files: string[];
  changed_line_count: number;
  decision: ProofDecision;
  state: 'verified' | 'rejected' | 'partial' | 'unverifiable' | 'pending' | string;
  decision_reason: string;
  checks: ProofCheck[];
  runs: ProofRun[];
}

export interface ProofReproduction {
  test_id: string;
  generated_by: string;
  outcome: string | null;
  outcome_detail: string | null;
  patch_applied: boolean | null;
  patched_files: string[] | null;
  summary: string;
}

export interface ProofEvidenceBefore {
  kind: string;
  description: string;
  file: string | null;
  line: number | null;
  snippet: string | null;
}

export interface ProofOfFix {
  finding_id: string;
  external_id: string | null;
  title: string;
  severity: Severity;
  status: string;
  confidence: number | null;
  file_path: string | null;
  function_name: string | null;
  line_start: number | null;
  base_version: string | null;
  evidence_before: ProofEvidenceBefore[];
  reproduction: ProofReproduction | null;
  decision: ProofDecision;
  decision_reason: string;
  checks: ProofCheck[];
  patches: ProofPatch[];
  recorded_at: string;
}

export interface GeneratedTest {
  id: string;
  finding_id: string;
  language: string;
  test_code: string;
  generated_by: string;
  status: 'generated' | 'running' | 'passed' | 'failed';
  result: Record<string, unknown> | null;
}

export interface GeneratedTestRun {
  id: string;
  status: string;
  result: Record<string, unknown> | null;
  patch: { id: string; status: PatchStatus; generated_by: string } | null;
  proof_of_fix:
    | {
        verdict: 'VERIFIED_FIX_PROOF' | 'NO_PROOF';
        baseline_outcome: string | null;
        patched_outcome: string | null;
        explanation: string;
      }
    | null;
}

export interface ValidationVerdict {
  claim: string;
  rule: string | null;
  original_status: string;
  final_status: string;
  confidence: number;
  explanation: string;
  checks: { key: string; label: string; passed: boolean | null; detail: string }[];
  validation_run_id: string;
}

export interface FindingFeedback {
  id: string;
  finding_id: string;
  verdict: 'correct' | 'incorrect' | 'already_fixed' | 'not_useful';
  note: string | null;
  created_at: string;
}

export interface FeedbackSummary {
  finding_id: string;
  counts: Record<string, number>;
  last_note: string | null;
}

export interface Patch extends Timestamped {
  finding_id: string;
  status: PatchStatus;
  diff: string;
  explanation: string | null;
  generated_by: string;
}

export interface VerificationRun extends Timestamped {
  patch_id: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error';
  started_at: string | null;
  finished_at: string | null;
}

export interface VerificationCheck {
  label: string;
  passed: boolean;
  detail: string | null;
}

export interface VerificationRunDetail extends VerificationRun {
  exit_code: number | null;
  duration_seconds: number | null;
  stdout: string | null;
  stderr: string | null;
  checks: VerificationCheck[];
}

// -------------------------------------------------------------------- dashboard

export interface DashboardSummary {
  total_repositories: number;
  total_scans: number;
  total_findings?: number;
  active_scans?: number;
  findings: {
    total: number;
    by_severity?: Partial<Record<Severity, number>>;
    by_status?: Partial<Record<FindingStatus, number>>;
    by_category?: Record<string, number>;
  };
  recent_scans?: Scan[];
  recent_findings?: Finding[];
  repositories?: Repository[];
}

// ---------------------------------------------------------------------- billing

export interface PlanLimits {
  repositories: number | null;
  scans_per_month: number | null;
  members: number | null;
  llm_reasoning: boolean;
  sandbox_verification: boolean;
  sarif_export: boolean;
}

export interface BillingSubscription {
  plan?: PlanName;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id?: string | null;
  period_end?: string | null;
  cancel_at_period_end?: boolean;
}

export interface BillingUsage {
  repositories: number;
  scans_used: number;
  fixes_used: number;
  verifications_used: number;
  period_start?: string | null;
  period_ends_at?: string | null;
}

export interface BillingOverview {
  /** The live plan, including the entitlements each gate reads. */
  plan: PlanInfo;
  /** True when billing runs without a payment provider configured. */
  demo_mode: boolean;
  subscription: BillingSubscription;
  usage: BillingUsage;
  limits?: PlanLimits;
}

export interface CheckoutResult {
  /** Provider checkout URL, absent in demo mode. */
  url?: string | null;
  demo?: boolean;
  session_id?: string | null;
  detail?: string;
}

// ------------------------------------------------------------------ teams / orgs

export interface OrgRead extends Timestamped {
  name: string;
  slug: string;
  plan?: PlanName;
  role?: OrgRole;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: OrgRole;
  created_at: string;
}

export interface OrgRepo {
  id: string;
  organization_id: string;
  repository_id: string;
  name: string;
  source_type: SourceType;
  status: RepositoryStatus;
  languages: string[];
}

export interface TeamDashboard {
  organization_id: string;
  repository_count: number;
  member_count?: number;
  scans: { total: number; completed?: number };
  findings: { total: number; verified_critical_high?: number; by_severity?: Record<string, number> };
  fixes: { verified: number; failed_or_unverified?: number };
}

export interface SecurityCenter {
  organization_id: string;
  risk_level: string;
  posture_score: number;
  findings: { by_severity: Record<string, number> };
  coverage: {
    repositories: number;
    scanned_repositories: number;
    per_repository: {
      repository_id: string;
      repository_name: string;
      findings_total: number;
    }[];
  };
  fix_pipeline: {
    patches_total: number;
    patches_verified: number;
  };
  detection_quality: {
    feedback_total: number;
    agreement_ratio: number | null;
    verdicts: Record<string, number>;
  };
  repositories?: { id: string; name: string; critical: number; high: number; verified: number }[];
  top_rules?: { rule_id: string; count: number }[];
}

// ------------------------------------------------------------------- onboarding

export interface OnboardingStatus {
  completed: boolean;
  completed_at: string | null;
  /** One entry per onboarding step, keyed by the step the API records. */
  steps: {
    connect_provider: { done: boolean };
    add_repository: { done: boolean };
    run_first_scan: { done: boolean };
  };
}

// ------------------------------------------------------------------- oauth

export type OAuthProviderName =
  | 'github'
  | 'gitlab'
  | 'google'
  | 'microsoft'
  | 'bitbucket'
  | 'auth0'
  | 'oracle';

export interface OAuthConnection {
  provider: OAuthProviderName;
  connected: boolean;
  provider_name: string;
  provider_email: string | null;
  account_login?: string | null;
  connected_at: string | null;
  scopes?: string[] | null;
}

/** Provider availability, keyed by provider so a switch can read one flag. */
export type OAuthProviders = Record<
  OAuthProviderName,
  {
    configured: boolean;
    label: string;
    display_name: string;
    supports_signin: boolean;
    supports_repo_import: boolean;
  }
>;

export interface ProviderRepository {
  id: string;
  name: string;
  description: string | null;
  full_name: string;
  private: boolean;
  default_branch: string;
  updated_at: string | null;
}
