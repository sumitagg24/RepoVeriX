/** Shared API shapes — mirrors backend/app/schemas. UUIDs are strings. */

export type ScanConfiguration =
  | "static_only"
  | "llm_only"
  | "static_llm"
  | "repoverix";
export type ScanStatus = "pending" | "running" | "completed" | "failed";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
/** Backend FindingStatus enum — lowercase, three values (see backend/app/db/models.py). */
export type FindingStatus = "verified" | "probable" | "rejected";
export type PatchStatus =
  | "candidate"
  | "applied"
  | "verified"
  | "failed"
  | "not_verified";
export type VerificationStatus =
  | "pending"
  | "running"
  | "verified_repair"
  | "repair_failed"
  | "repair_not_verified";

export interface UserRead {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  plan: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  email_verified?: boolean | null;
  /** Console-mail dev shortcut (local dev only — null with SMTP). */
  dev_verification_url?: string | null;
}

export interface RepositoryRead {
  id: string;
  owner_id: string;
  name: string;
  source_type: string;
  source_url: string | null;
  default_branch: string;
  storage_path: string | null;
  primary_languages: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRunRead {
  id: string;
  scan_id: string;
  stage: string;
  tool_name: string | null;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  output: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ScanRead {
  id: string;
  repository_id: string;
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

export interface ScanDetail extends ScanRead {
  analysis_runs: AnalysisRunRead[];
}

export interface EvidenceRead {
  id: string;
  finding_id: string;
  kind: string;
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

export interface PatchRead {
  id: string;
  finding_id: string;
  diff: string;
  explanation: string | null;
  generated_by: string;
  status: PatchStatus;
  created_at: string;
  updated_at: string;
}

export interface FindingRead {
  id: string;
  scan_id: string;
  external_id: string;
  category: string;
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
  source: string;
  created_at: string;
  updated_at: string;
}

export interface FindingDetail extends FindingRead {
  evidence: EvidenceRead[];
  patches: PatchRead[];
}

export interface TestResultRead {
  id: string;
  verification_run_id: string;
  test_name: string;
  outcome: string;
  duration_ms: number | null;
  output: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationRunRead {
  id: string;
  patch_id: string;
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

export interface VerificationRunDetail extends VerificationRunRead {
  test_results: TestResultRead[];
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
