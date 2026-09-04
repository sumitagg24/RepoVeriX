export type UUID = string;

export interface User {
  id: UUID;
  email: string;
  full_name: string;
  is_active: boolean;
  plan: PlanName;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type SourceType = 'github' | 'gitlab' | 'git' | 'archive' | 'zip';

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

export type FindingCategory = 'security' | 'logic' | 'api_misuse' | 'database' | 'dependency' | 'reliability';
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

export type VerificationStatus = 'pending' | 'running' | 'verified_repair' | 'repair_failed' | 'repair_not_verified';
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

export interface FindingSummary {
  total: number;
  by_category: Record<FindingCategory, number>;
  by_severity: Record<Severity, number>;
  by_status: Record<FindingStatus, number>;
}

export interface DashboardSummary {
  total_repositories: number;
  total_scans: number;
  findings: FindingSummary;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiError {
  detail: string;
}

export type PlanName = 'free' | 'pro' | 'team';

export interface PlanInfo {
  name: PlanName;
  display_name: string;
  price_monthly: number;
  max_repositories: number;
  scans_per_month: number;
  fixes_per_month: number;
  verifications_per_month: number;
  llm_enabled: boolean;
  sandbox_enabled: boolean;
  collaborators: number;
}

export interface BillingUsage {
  repositories: number;
  scans_used: number;
  fixes_used: number;
  verifications_used: number;
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
  distribution: Record<'1-3' | '4-6' | '7-8' | '9-10', number>;
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

export interface ArchitectureNode {
  id: string;
  label: string;
  files: number;
  symbols: number;
  imports: number;
  layer: number;
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  weight: number;
}

export interface ArchitectureGraph {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
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

export interface WikiProseResult {
  file_path: string;
  content: string;
  model: string | null;
  provider: string;
  usage: Record<string, unknown>;
}

// ---------------------------------------------------------------- Tier-1 audit features

export interface ChangedSymbol {
  name: string;
  kind: string;
  line_start: number;
  line_end: number;
}

export interface ChangeAuditResult {
  changed_files: string[];
  added_lines: number;
  removed_lines: number;
  changed_symbols: ChangedSymbol[];
  blast_radius: {
    caller_files: Record<string, number>;
    importing_files: string[];
    caller_count: number;
  };
  tests_to_run: string[];
  missing_companion_files: string[];
  untested_changed_files: string[];
  risk_score: number;
  risk_level: string;
  risk_components: Record<string, number>;
  risk_factors?: RiskFactor[];
  risk_formula?: string;
  affected_apis?: { file: string; line: number; route: string }[];
  security_context?: {
    auth_and_security_symbols: { name: string; file: string; line_start: number; line_end: number }[];
    database_symbols: { name: string; file: string; line_start: number; line_end: number }[];
    unhealthy_changed_files: string[];
  };
  directives: string[];
  mode: 'refs' | 'diff' | 'commit';
  base: string | null;
  head: string | null;
  audit_id?: string;
}

export interface GraphNode {
  id: string;
  kind: 'finding' | 'evidence' | 'file';
  label: string;
  file?: string;
  line?: number;
  severity?: string;
  status?: string;
  subkind?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: string;
}

export interface EvidenceGraph {
  scan_id: string;
  configuration: string;
  finding_count: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AttackPathStep {
  function: string;
  file: string;
  line: number;
}

export interface AttackPath {
  source: string;
  source_kind: string;
  sink: string;
  sink_kind: string;
  file: string;
  steps: AttackPathStep[];
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

export interface DependencyVulnerability {
  id?: string | null;
  cvss?: number | string | null;
  summary?: string | null;
  affected?: string | null;
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
  reachability_status?: 'DIRECTLY_REACHABLE' | 'INDIRECTLY_REACHABLE' | 'NOT_REACHABLE' | 'UNKNOWN';
  reachability_evidence?: string[];
  top_level?: boolean;
  recommendation?: string;
  vulnerabilities?: DependencyVulnerability[];
}

export interface DependencyReachability {
  dependencies: DependencyRow[];
  reachable_count: number;
  unreachable_count: number;
  vulnerable_reachable: number;
  status_counts?: Record<string, number>;
}

export interface RegressionFinding {
  external_id: string;
  title: string;
  file_path: string;
  severity: string;
  status?: string;
  confidence?: number;
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
  moved?: { external_id: string; title: string; file_path: string; line_before?: number | null; line_after?: number | null; reason?: string }[];
  changed_status: { external_id: string; title: string; file_path: string; status_before: string; status_after: string }[];
  changed_severity: { external_id: string; title: string; file_path: string; severity_before: string; severity_after: string }[];
  confidence_deltas: { external_id: string; title: string; file_path: string; confidence_before: number; confidence_after: number }[];
  items?: RegressionItem[];
  from_scan: string;
  to_scan: string;
  from_scan_created: string;
  to_scan_created: string;
  previous_scan: string | null;
  new_findings: RegressionFinding[];
  reintroduced_findings: RegressionFinding[];
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

export interface GeneratedTest {
  id: string;
  finding_id: string;
  language: string;
  test_code: string;
  generated_by: string;
  status: string;
  result: Record<string, unknown> | null;
}

export interface RunTestResponse {
  id: string;
  status: string;
  result: {
    outcome?: string;
    outcome_detail?: string;
    patch_applied?: boolean;
    patched_files?: string[];
    summary?: string;
    passed?: boolean;
  } | null;
  patch?: { patch_id?: string; patch_status?: string } | null;
  proof_of_fix?: {
    verdict: string;
    baseline_outcome?: string;
    patched_outcome?: string;
    explanation?: string;
  } | null;
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

export interface CounterexampleResult {
  finding_id: string;
  counterexample: CounterexampleProof | null;
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
  source_nodes?: { kind: string; file_path?: string | null; line_start?: number | null; description: string }[];
  sink_nodes?: { kind: string; file_path?: string | null; line_start?: number | null; description: string }[];
}

export interface ValidationStats {
  candidates: number;
  before: Record<string, number>;
  after: Record<string, number>;
  transitions: Record<string, number>;
  false_positive_reduction: number;
  fp_reduction_rate: number;
  by_rule: Record<string, Record<string, number>>;
  method?: string;
  note?: string;
}

// --------------------------------------------------------------------------- Tier 2

export interface QuerySource {
  kind: string;
  file?: string;
  line_start?: number | null;
}

export interface RepositoryQueryResult {
  question: string;
  intent: string;
  intent_title: string;
  answer: string;
  sources: QuerySource[];
  mode: 'deterministic' | 'llm';
  model?: string | null;
}

export interface ArchitectureSmell {
  smell: string;
  severity: 'high' | 'medium' | 'low';
  modules: string[];
  detail: string;
  remediation: string;
}

export interface ArchitectureSmellsResult {
  module_count: number;
  edge_count: number;
  smell_count: number;
  by_type: Record<string, number>;
  smells: ArchitectureSmell[];
}

export interface HealthTimelinePoint {
  commit_sha: string | null;
  average_score: number | null;
  files_scored: number;
  distribution: Record<string, number> | null;
  worst_files: string[] | null;
  recorded_at: string;
}

export interface HealthTimeline {
  repository_id: string;
  count: number;
  points: HealthTimelinePoint[];
}

export interface PatchQualityCriterion {
  criterion: string;
  points: number;
  detail: string;
}

export interface PatchQuality {
  score: number;
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  verified: boolean;
  verification_status: string | null;
  breakdown: PatchQualityCriterion[];
  stats: { files: string[]; added: number; removed: number };
}

export interface ImpactEvidenceNode {
  kind: string;
  file?: string | null;
  line_start?: number | null;
  line_end?: number | null;
  description: string;
}

export interface ImpactAnalysis {
  finding_id: string;
  summary: string;
  why_it_matters: string[];
  worst_case: string;
  callers: string[];
  entrypoint_reachable: boolean;
  evidence_chain: ImpactEvidenceNode[];
  source: ImpactEvidenceNode | null;
  sink: ImpactEvidenceNode | null;
  fix_direction: string;
  category: string;
  severity: string;
}

export interface ChangeExplanationFile {
  path: string;
  symbols_changed: string[];
  note: string | null;
}

export interface ChangeExplanation {
  risk_score: number;
  risk_label: string;
  summary: string;
  bullets: string[];
  per_file: ChangeExplanationFile[];
  risk_components: string[];
  directives: string[];
  llm_narrative?: string;
  model?: string | null;
}

export interface FindingChatResult {
  question: string;
  intent: string;
  intent_title: string;
  answer: string;
  sources: QuerySource[];
  mode: 'deterministic' | 'llm';
  model?: string | null;
}

// --------------------------------------------------------------------------- Tier 3 (research)

export interface AgentReport {
  agent: string;
  verdict: 'ok' | 'attention' | 'critical';
  score: number;
  signals: string[];
  confidence: number;
  flagged_files?: string[];
}

export interface MultiAgentResult {
  repository_id?: string;
  agent_count: number;
  overall_risk: number;
  overall_verdict: 'ok' | 'attention' | 'critical';
  agents: AgentReport[];
  converging_evidence: { file: string; agents: string[] }[];
  recommendations: string[];
  method: string;
}

export interface RuleStat {
  rule: string;
  total: number;
  verified: number;
  probable: number;
  rejected: number;
  patches: number;
  verified_repairs: number;
  precision: number;
  false_positive_rate: number;
}

export interface SelfImprovementResult {
  repository_id: string;
  scans_analyzed: number;
  finding_samples: number;
  stats: { rule_count: number; rules: RuleStat[] };
  recommendation: {
    exploring: boolean;
    mode: string;
    recommended_context_strategy: string;
    rule_profile: Record<string, number>;
    deweighted_rules: string[];
    sample_total: number;
    strategy_scores: Record<string, number>;
  };
}

export interface VulnMiningFinding {
  rule: string;
  severity: string;
  file_path: string;
  line_start: number;
  status: string;
  author?: string;
  introducing_commit?: string;
  introduced_at?: string;
  age_days?: number | null;
}

export interface VulnMiningResult {
  available: boolean;
  reason?: string;
  findings_analyzed: number;
  introduced_findings?: number;
  top_introducing_authors?: { author: string; introduced_findings: number }[];
  fix_commits_in_window?: number;
  median_finding_age_days?: number | null;
  oldest_finding_age_days?: number | null;
  repeated_vulnerable_roles?: { file_role: string; findings: number }[];
  findings?: VulnMiningFinding[];
  method?: string;
}

export interface RiskModelResult {
  repository_id?: string;
  available: boolean;
  reason?: string;
  samples?: number;
  positive_files?: number;
  features?: string[];
  coefficients?: { feature: string; weight: number }[];
  predictions?: { path: string; predicted_risk: number; actual_finding: boolean }[];
  top_risk_files?: string[];
  evaluation?: {
    method: string;
    precision_at_k: number;
    k: number;
    flagged_in_top_k: number;
    caveat: string;
  };
  model?: string;
}

export interface LearningPatternsResult {
  repositories_analyzed: number;
  total_findings?: number;
  recurring_patterns?: { rule: string; language: string; occurrences: number }[];
  category_distribution?: { category: string; language: string; findings: number }[];
  risky_file_roles?: { file_role: string; category: string; hits: number }[];
  rule_co_occurrence?: { rules: string[]; repositories: number }[];
  transfer_suggestions?: { rule: string; verified_in: string[]; check_also: string[] }[];
  repositories_with_verified_findings?: string[];
  message?: string;
  method?: string;
}

// --------------------------------------------------------------------------- PR auditor / impact / regression v2

export interface RiskFactor {
  key: string;
  label: string;
  weight: number;
  value: number;
  contribution: number;
}

export interface PullRequestAuditSummary {
  id: string;
  repository_id: string;
  repository_name?: string;
  pr_number: number;
  pr_title?: string;
  pr_url?: string;
  author?: string;
  base_ref?: string;
  base_sha?: string;
  head_ref?: string;
  head_sha?: string;
  risk_score: number;
  risk_level: string;
  changed_files: string[];
  finding_count: number;
  comment_count: number;
  posted: boolean;
  posted_at?: string | null;
  created_at: string;
}

export interface PrAuditFinding {
  external_id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  confidence: number;
  file_path: string;
  function_name?: string | null;
  line_start?: number | null;
  line_end?: number | null;
  description: string;
  recommendation?: string;
  rule?: string | null;
  evidence: {
    kind: string;
    file_path?: string | null;
    line_start?: number | null;
    snippet?: string | null;
    description: string;
  }[];
}

export interface PrAuditComment {
  path: string;
  line: number;
  body: string;
}

export interface PrRegressionRisk {
  external_id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  file_path: string;
  line_start?: number | null;
  line_end?: number | null;
  line_touched: boolean;
  note: string;
}

export interface PullRequestAuditDetail {
  pr: {
    number: number;
    title?: string;
    author?: string;
    state?: string;
    html_url?: string;
    base_ref: string;
    base_sha: string;
    head_ref: string;
    head_sha: string;
  };
  risk_score: number;
  risk_level: string;
  risk_components: Record<string, number>;
  risk_factors: RiskFactor[];
  risk_formula?: string;
  summary?: string;
  summary_lines?: string[];
  stats: {
    files: number;
    added_lines: number;
    removed_lines: number;
    findings: number;
    verified_findings: number;
    probable_findings: number;
    comments: number;
    regression_risks: number;
  };
  changed_files: string[];
  changed_symbols?: { name: string; kind?: string; file: string; line_start?: number; line_end?: number }[];
  blast_radius: {
    caller_files: Record<string, number>;
    importing_files: string[];
    caller_count: number;
  };
  affected_apis?: { file: string; line: number; route: string }[];
  security_context?: {
    auth_and_security_symbols: { name: string; file: string; line_start: number; line_end: number }[];
    database_symbols: { name: string; file: string; line_start: number; line_end: number }[];
    unhealthy_changed_files: string[];
  };
  tests_to_run: string[];
  missing_companion_files: string[];
  findings: PrAuditFinding[];
  regression_risks: PrRegressionRisk[];
  comments: PrAuditComment[];
  directives: string[];
  audit_id: string;
  repository_id?: string;
  repository_name?: string;
  posted?: boolean;
  posted_at?: string | null;
}

export interface ChangeAuditMeta {
  id: string;
  mode: string;
  base: string | null;
  head: string | null;
  risk_score: number;
  risk_level?: string | null;
  changed_file_count: number;
  created_at: string;
}

// Regression v2 rows

export interface RegressionEvidenceRow {
  kind: string;
  file_path?: string | null;
  line_start?: number | null;
  snippet?: string | null;
  description?: string;
}

export interface RegressionItem {
  state: 'still_present' | 'severity_changed' | 'resolved' | 'new' | 'reintroduced';
  external_id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  confidence: number;
  file_path: string;
  line_start?: number | null;
  line_end?: number | null;
  function_name?: string | null;
  rule?: string | null;
  source?: string;
  evidence?: RegressionEvidenceRow[];
  before?: {
    severity: string;
    status: string;
    confidence: number;
    file_path: string;
    line_start?: number | null;
    evidence?: RegressionEvidenceRow[];
  };
}