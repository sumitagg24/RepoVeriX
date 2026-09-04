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