/**
 * Backend API contracts.
 *
 * These types mirror the FastAPI response schemas in `backend/app/schemas/*`
 * exactly — field names, nullability and enum values. Nothing here is invented:
 * if a field is not in this file, the backend does not return it yet.
 */

export type UUID = string;

// ------------------------------------------------------------------ identity

export type PlanName = 'free' | 'pro' | 'team';

export interface User {
  id: UUID;
  email: string;
  full_name: string;
  is_active: boolean;
  plan: PlanName;
  /** False while a password account still needs its verification link opened. */
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  email_verified?: boolean | null;
  /** Dev-only: present when the backend mailer runs in console mode. */
  dev_verification_url?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface SecurityEvent {
  event: string;
  ip: string | null;
  at: string | null;
  detail: Record<string, string>;
}

export interface SecurityOverview {
  email_verified: boolean;
  account_status: string;
  mfa_status: string;
  recent_events: SecurityEvent[];
}

// ------------------------------------------------------------------ oauth

export type OAuthProviderName = 'google' | 'github' | 'gitlab';

export interface OAuthProviderInfo {
  configured: boolean;
  display_name: string;
  supports_repo_import: boolean;
  supports_signin: boolean;
}

export interface OAuthProviders {
  google: OAuthProviderInfo;
  github: OAuthProviderInfo;
  gitlab: OAuthProviderInfo;
}

export interface ProviderRepository {
  id: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  private: boolean;
}

export interface OAuthConnection {
  provider: OAuthProviderName;
  provider_email: string | null;
  provider_name: string | null;
  connected_at: string;
}

// ------------------------------------------------------------ repositories

export type SourceType = 'github' | 'gitlab' | 'git' | 'archive' | 'zip';

export interface Repository {
  id: UUID;
  owner_id: UUID;
  name: string;
  source_type: SourceType;
  source_url: string | null;
  default_branch: string;
  storage_path: string | null;
  primary_languages: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RepositoryCreate {
  name: string;
  source_type: SourceType;
  source_url?: string;
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

// ------------------------------------------------------------------ scans

export type ScanConfiguration = 'static_only' | 'llm_only' | 'static_llm' | 'repoverix';
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Scan {
  id: UUID;
  repository_id: UUID;
  status: ScanStatus;
  configuration: ScanConfiguration;
  started_at: string | null;
  finished_at: string | null;
  summary: Record<string, unknown> | null;
  llm_token_usage: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScanCreate {
  repository_id: UUID;
  configuration?: ScanConfiguration;
}

export interface AnalysisRun {
  id: UUID;
  scan_id: UUID;
  stage: string;
  tool_name: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  output: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ScanDetail extends Scan {
  analysis_runs: AnalysisRun[];
}

export interface FindingSummary {
  total: number;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
}

export interface DashboardSummary {
  total_repositories: number;
  total_scans: number;
  findings: FindingSummary;
}

// --------------------------------------------------------------- findings

export type FindingCategory =
  | 'security'
  | 'logic'
  | 'api_misuse'
  | 'database'
  | 'dependency'
  | 'reliability';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'verified' | 'probable' | 'rejected';
export type FindingSource = 'static' | 'llm' | 'hybrid';

export interface Finding {
  id: UUID;
  scan_id: UUID;
  external_id: string;
  category: FindingCategory;
  severity: Severity;
  status: FindingStatus;
  confidence: number;
  title: string;
  description: string;
  impact: string | null;
  recommendation: string | null;
  file_path: string;
  function_name: string | null;
  line_start: number | null;
  line_end: number | null;
  source: FindingSource;
  created_at: string;
  updated_at: string;
}

export type EvidenceKind =
  | 'source_input'
  | 'transformation'
  | 'sink'
  | 'static_analysis'
  | 'dependency'
  | 'test'
  | 'llm_reasoning'
  | 'call_relationship';

export interface Evidence {
  id: UUID;
  finding_id: UUID;
  kind: EvidenceKind;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  snippet: string | null;
  description: string;
  order_index: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FindingDetail extends Finding {
  evidence: Evidence[];
  patches: Patch[];
}

export interface FindingListParams {
  scan_id?: UUID;
  repository_id?: UUID;
  category?: string;
  severity?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------- patches

export type PatchStatus = 'candidate' | 'applied' | 'verified' | 'failed' | 'not_verified';

export interface Patch {
  id: UUID;
  finding_id: UUID;
  diff: string;
  explanation: string | null;
  generated_by: string;
  status: PatchStatus;
  created_at: string;
  updated_at: string;
}

export type VerificationStatus =
  | 'pending'
  | 'running'
  | 'verified_repair'
  | 'repair_failed'
  | 'repair_not_verified';
export type TestOutcome = 'passed' | 'failed' | 'error' | 'skipped';

export interface VerificationRun {
  id: UUID;
  patch_id: UUID;
  status: VerificationStatus;
  patch_applied: boolean;
  deps_installed: boolean;
  tests_passed: boolean | null;
  static_passed: boolean | null;
  finding_still_detected: boolean | null;
  logs: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  id: UUID;
  verification_run_id: UUID;
  test_name: string;
  outcome: TestOutcome;
  duration_ms: number | null;
  output: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationRunDetail extends VerificationRun {
  test_results: TestResult[];
}

export interface ProofCheck {
  key: string;
  label: string;
  passed: boolean | null;
  detail?: string;
}

export interface ProofRun {
  id: string;
  status: string;
  decision: string | null;
  patch_applied: boolean | null;
  deps_installed: boolean | null;
  tests_passed: boolean | null;
  static_passed: boolean | null;
  finding_still_detected: boolean | null;
  started_at: string | null;
  finished_at: string | null;
  log_excerpt?: string;
  test_count: number;
}

export interface ProofOfFixPatch {
  patch_id: string;
  patch_status: string;
  generated_by: string;
  changed_files: string[];
  changed_line_count: number;
  decision: string | null;
  state?: string;
  decision_reason?: string;
  checks: ProofCheck[];
  runs: ProofRun[];
}

export interface ProofEvidenceNode {
  kind: string;
  description: string;
  file: string | null;
  line: number | null;
  snippet?: string | null;
}

export interface ProofOfFix {
  finding_id: string;
  external_id: string;
  title: string;
  severity: string;
  status: string;
  confidence: number;
  file_path: string;
  function_name: string | null;
  line_start: number | null;
  base_version: string | null;
  evidence_before: ProofEvidenceNode[];
  reproduction: {
    test_id: string;
    generated_by: string;
    outcome: string | null;
    outcome_detail: string | null;
    patch_applied?: boolean;
    patched_files?: string[];
    summary?: string;
  } | null;
  decision: string | null;
  decision_reason: string;
  checks: ProofCheck[];
  patches: ProofOfFixPatch[];
  recorded_at: string;
}

export interface GeneratedTest {
  id: string;
  finding_id: string;
  language: string;
  test_code: string;
  generated_by: string;
  status: string;
  result: Record<string, unknown> | null;
}

export interface ImpactAnalysis {
  finding_id: string;
  summary: string;
  why_it_matters: string[];
  worst_case: string;
  callers: string[];
  entrypoint_reachable: boolean;
  evidence_chain: {
    kind: string;
    file?: string | null;
    line_start?: number | null;
    line_end?: number | null;
    description: string;
  }[];
  source: { kind: string; file?: string | null; line_start?: number | null; description: string } | null;
  sink: { kind: string; file?: string | null; line_start?: number | null; description: string } | null;
  fix_direction: string;
  category: string;
  severity: string;
}

export interface ValidationCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ValidationEvidence {
  kind: string;
  label: string;
  detail: string;
  sanitizer?: string;
  sanitizer_line?: number;
}

export interface CounterexampleProof {
  found: boolean;
  sanitizer: string;
  sanitizer_line: number;
  sanitizer_snippet: string;
  sink_line: number;
  sink_snippet: string;
  flow: { identifier: string; sanitized_at: number }[];
  explanation: string;
}

export interface FindingValidationResult {
  validation_run_id: string;
  claim: string;
  rule?: string | null;
  original_status: string;
  original_confidence: number;
  final_status: string;
  confidence: number;
  explanation: string;
  checks: ValidationCheck[];
  supporting_evidence: ValidationEvidence[];
  contradicting_evidence: ValidationEvidence[];
  counterexample: CounterexampleProof | null;
}

export interface FindingFeedback {
  id: UUID;
  finding_id: UUID;
  user_id: UUID;
  verdict: 'correct' | 'incorrect' | 'already_fixed' | 'not_useful';
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackSummary {
  total: number;
  correct: number;
  incorrect: number;
  already_fixed: number;
  not_useful: number;
  false_positive_share: number | null;
}

// -------------------------------------------------------------- billing

export interface PlanInfo {
  name: PlanName;
  display_name: string;
  price_monthly: number;
  max_repositories: number;
  scans_per_month: number;
  fixes_per_month: number;
  verifications_per_month: number;
  website_audits_per_month: number;
  llm_enabled: boolean;
  sandbox_enabled: boolean;
  collaborators: number;
}

export interface BillingUsage {
  repositories: number;
  scans_used: number;
  fixes_used: number;
  verifications_used: number;
  website_audits_used: number;
  period_ends_at: string;
}

export interface BillingOverview {
  plan: PlanInfo;
  usage: BillingUsage;
  subscription: {
    status: string | null;
    stripe_customer_id: string | null;
    period_end: string | null;
  };
  demo_mode: boolean;
}

export interface CheckoutResult {
  url: string;
  demo: boolean;
}

// -------------------------------------------------- organizations / teams

export type OrgRole = 'member' | 'admin' | 'owner';

export interface OrgRead {
  id: UUID;
  name: string;
  slug: string;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
  role: OrgRole;
}

export interface OrgMember {
  id: UUID;
  organization_id: UUID;
  user_id: UUID;
  email: string | null;
  full_name: string | null;
  role: OrgRole;
  created_at: string;
}

export interface OrgRepo {
  id: UUID;
  name: string;
  status: string;
  source_type: string;
  languages: string[];
  created_at: string | null;
}

export interface TeamDashboard {
  organization_id: UUID;
  repositories: { id: UUID; name: string; status: string; default_branch: string }[];
  repository_count: number;
  member_counts: Record<string, number>;
  scans: { total: number; completed: number; last_scan_at: string | null };
  findings: {
    total: number;
    by_severity: Record<string, number>;
    by_status: Record<string, number>;
    verified_critical_high: number;
  };
  fixes: { verified: number; failed_or_unverified: number };
}

export interface SecurityCenter {
  organization_id: UUID;
  posture_score: number;
  risk_level: string;
  findings: TeamDashboard['findings'];
  coverage: {
    repositories: number;
    scanned_repositories: number;
    per_repository: { repository_id: UUID; repository_name: string; findings_total: number }[];
  };
  detection_quality: {
    feedback_total: number;
    verdicts: Record<string, number>;
    agreement_ratio: number | null;
  };
  fix_pipeline: { patches_total: number; patches_verified: number };
}

// ------------------------------------------------------------- onboarding

export type OnboardingStepKey = 'connect_provider' | 'add_repository' | 'run_first_scan';

export interface OnboardingStepStatus {
  done: boolean;
  detail?: string | null;
}

export interface OnboardingRepositoryHint {
  id: UUID;
  name: string;
}

export interface OnboardingStatus {
  completed: boolean;
  completed_at?: string | null;
  steps: Record<OnboardingStepKey, OnboardingStepStatus>;
  latest_repository?: OnboardingRepositoryHint | null;
}

// ------------------------------------------------------------- reports

export interface ReportShare {
  share_id: UUID;
  url: string;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  created_at: string | null;
}

export interface DedupCluster {
  file_path: string;
  line_start: number | null;
  size: number;
  primary_finding_id: string;
  primary_title: string;
  primary_severity: string;
  members: { id: string; title: string; rule: string | null; severity: string; status: string }[];
}

export interface DedupReport {
  scan_id: string;
  total_findings: number;
  cluster_count: number;
  duplicated_findings: number;
  clusters: DedupCluster[];
}

// --------------------------------------------------- repository intelligence

export interface FileHealthIssue {
  lens: 'defect_risk' | 'maintainability' | 'performance';
  detector: string;
  title: string;
  detail: string;
}

export interface FileHealth {
  path: string;
  language: string;
  lines: number;
  symbols: number;
  score: number;
  lenses: { defect_risk: number; maintainability: number; performance: number };
  issues: FileHealthIssue[];
}

export interface HealthReport {
  detector_count: number;
  files_scored: number;
  average_score: number | null;
  distribution: Record<string, number>;
  files: FileHealth[];
  worst_files: string[];
  refactor_targets: { path: string; score: number; lenses: FileHealth['lenses']; issues: FileHealthIssue[] }[];
}

export interface GitFileStats {
  path: string;
  churn: number;
  commits: number;
  bug_fixes: number;
  hotspot_score: number;
  bus_factor: number;
  top_author: string;
  top_author_share: number;
  last_touched: string;
}

export interface GitInsights {
  available: boolean;
  reason?: string;
  commits_analyzed?: number;
  authors?: number;
  top_authors?: { name: string; commits: number }[];
  commits_last_30d?: number;
  files?: GitFileStats[];
  hotspots?: GitFileStats[];
  co_change?: { files: [string, string]; co_changes: number }[];
  bus_factor_worst?: GitFileStats[];
}

export interface WikiSymbol {
  name: string;
  kind: string;
  line_start: number;
  line_end: number;
  params?: string | null;
}

export interface WikiPage {
  path: string;
  language: string;
  title: string;
  docstring: string | null;
  summary: string;
  symbols: WikiSymbol[];
  imports: string[];
  top_calls: { callee: string; calls: number }[];
  lines: number;
}

export interface WikiReport {
  files: number;
  total_parseable: number;
  pages: WikiPage[];
}

export interface ArchitectureGraph {
  nodes: { id: string; label: string; files: number; symbols: number; imports: number; layer: number }[];
  edges: { from: string; to: string; weight: number }[];
}

export interface RepositoryIntelligence {
  status: string;
  generated_at: string | null;
  error: string | null;
  health: HealthReport;
  git: GitInsights;
  wiki: WikiReport;
  architecture: ArchitectureGraph;
}

// ----------------------------------------------------------- audit extras

export interface EvidenceGraph {
  scan_id: string;
  configuration: string;
  finding_count: number;
  nodes: { id: string; kind: 'finding' | 'evidence' | 'file'; label: string; file?: string; line?: number; severity?: string; status?: string; subkind?: string }[];
  edges: { from: string; to: string; kind: string }[];
}

export interface AttackPath {
  source: string;
  source_kind: string;
  sink: string;
  sink_kind: string;
  file: string;
  steps: { function: string; file: string; line: number }[];
  entry_point?: { type: string; label?: string };
  sink_call?: string;
  sink_category?: string;
  impact?: string;
  status?: string;
  risk_score?: number;
  risk_level?: string;
  note?: string;
}

export interface AttackPaths {
  source_count: number;
  path_count: number;
  verified_count?: number;
  probable_count?: number;
  by_risk_level?: Record<string, number>;
  paths: AttackPath[];
}

export interface DependencyRow {
  name: string;
  version: string | null;
  ecosystem: string | null;
  reachable: boolean;
  importer_count: number;
  importers: string[];
  known_vulnerabilities: number;
  triage: string;
  reachability_status?: string;
  reachability_evidence?: string[];
  top_level?: boolean;
  recommendation?: string;
}

export interface DependencyReachability {
  dependencies: DependencyRow[];
  reachable_count: number;
  unreachable_count: number;
  vulnerable_reachable: number;
  status_counts?: Record<string, number>;
}

export interface RegressionReport {
  total_before: number;
  total_after: number;
  summary?: {
    new: number;
    resolved: number;
    still_present: number;
    reintroduced: number;
    severity_changed: number;
    status_changed: number;
  };
  new: string[];
  resolved: string[];
  still_present: string[];
  reintroduced: string[];
  from_scan: string;
  to_scan: string;
  from_scan_created: string;
  to_scan_created: string;
  previous_scan: string | null;
}

export interface ChangeAuditResult {
  changed_files: string[];
  added_lines: number;
  removed_lines: number;
  changed_symbols: { name: string; kind: string; line_start: number; line_end: number }[];
  blast_radius: { caller_files: Record<string, number>; importing_files: string[]; caller_count: number };
  tests_to_run: string[];
  missing_companion_files: string[];
  untested_changed_files: string[];
  risk_score: number;
  risk_level: string;
  risk_components: Record<string, number>;
  directives: string[];
  mode: 'refs' | 'diff' | 'commit';
  base: string | null;
  head: string | null;
  audit_id?: string;
}
