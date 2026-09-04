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
  risk_components: {
    size: number;
    blast_radius: number;
    risky_files: number;
    missing_tests: number;
    missing_companions: number;
  };
  directives: string[];
  mode: 'refs' | 'diff';
  base: string | null;
  head: string | null;
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

export interface AttackPath {
  source: string;
  source_kind: string;
  sink: string;
  sink_kind: string;
  file: string;
  steps: { function: string; file: string; line: number }[];
}

export interface AttackPaths {
  source_count: number;
  path_count: number;
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
}

export interface DependencyReachability {
  dependencies: DependencyRow[];
  reachable_count: number;
  unreachable_count: number;
  vulnerable_reachable: number;
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
  new: string[];
  resolved: string[];
  still_present: string[];
  reintroduced: string[];
  changed_status: { external_id: string; title: string; file_path: string; status_before: string; status_after: string }[];
  changed_severity: { external_id: string; title: string; file_path: string; severity_before: string; severity_after: string }[];
  confidence_deltas: { external_id: string; title: string; file_path: string; confidence_before: number; confidence_after: number }[];
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