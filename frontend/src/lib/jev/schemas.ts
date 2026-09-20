/**
 * Typed Decision Schemas for TypeSafe AI Jev
 * 
 * Jev is specifically used for fast System 1 structured evaluations:
 * - Classification
 * - Routing
 * - Scoring
 * - Boolean decisions
 * 
 * Non-generative only.
 */

/**
 * 1. CLASSIFICATION SCHEMAS
 */

export const VULNERABILITY_CATEGORIES = [
  'SQL_INJECTION',
  'COMMAND_INJECTION',
  'CROSS_SITE_SCRIPTING',
  'AUTHENTICATION_BYPASS',
  'PATH_TRAVERSAL',
  'INSECURE_DESERIALIZATION',
  'WEAK_CRYPTOGRAPHY',
  'OTHER',
] as const;

export type VulnerabilityCategory = (typeof VULNERABILITY_CATEGORIES)[number];

export const VULNERABILITY_CATEGORY_CRITERIA: Record<VulnerabilityCategory, string> = {
  SQL_INJECTION: 'Unsanitized user input formatted into database SQL queries',
  COMMAND_INJECTION: 'Unsanitized input passed directly to OS shell or subprocess execution',
  CROSS_SITE_SCRIPTING: 'Unescaped user input rendered directly into DOM or HTML response',
  AUTHENTICATION_BYPASS: 'Improper token validation, weak auth checks or authorization flaws',
  PATH_TRAVERSAL: 'Unsanitized file paths allowing directory traversal or unauthorized file access',
  INSECURE_DESERIALIZATION: 'Unsafe deserialization of untrusted data payloads',
  WEAK_CRYPTOGRAPHY: 'Use of deprecated hashes (MD5/SHA1), weak ciphers, or hardcoded secret keys',
  OTHER: 'General code defect, code quality issue, or unclassified security vulnerability',
};

export const SEVERITY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const SEVERITY_LEVEL_CRITERIA: Record<SeverityLevel, string> = {
  CRITICAL: 'Remote code execution, authentication bypass, or full database compromise',
  HIGH: 'Sensitive data exposure, privilege escalation, or high-impact injection',
  MEDIUM: 'Limited data exposure, unhandled error leaks, or misconfigurations',
  LOW: 'Minor security weakness, non-critical exposure, or best practice deviation',
  INFO: 'Informational finding, code hygiene note, or hardening suggestion',
};

/**
 * 2. ROUTING SCHEMAS
 */

export const SCAN_ROUTING_STRATEGIES = [
  'FAST_STATIC_ONLY',
  'DEEP_EVIDENCE_GRAPH',
  'AUTOMATED_REPAIR',
] as const;

export type ScanRoutingStrategy = (typeof SCAN_ROUTING_STRATEGIES)[number];

export const SCAN_ROUTING_CRITERIA: Record<ScanRoutingStrategy, string> = {
  FAST_STATIC_ONLY: 'Small change, low risk repository, or quick pull request sanity check',
  DEEP_EVIDENCE_GRAPH: 'Multi-file dependency graph analysis needed for deep threat modeling',
  AUTOMATED_REPAIR: 'Known fixable vulnerability requiring Docker verification and automated patch generation',
};

/**
 * 3. SCORING SCHEMAS
 */

export const RISK_SCORE_LEVELS = [
  '1 - Minimal Risk: Low severity, limited exposure, unexploitable in production context',
  '2 - Low Risk: Minor impact, requires specific preconditions to trigger',
  '3 - Moderate Risk: Standard vulnerability requiring attention during routine maintenance',
  '4 - High Risk: Severe flaw exploitable with low complexity',
  '5 - Critical Risk: Catastrophic impact requiring immediate emergency remediation',
] as const;

/**
 * 4. BOOLEAN DECISION SCHEMAS
 */

export interface BooleanDecisionQuestion {
  type: 'boolean';
  instructions: string;
}

export interface ChoiceDecisionQuestion<T extends string = string> {
  type: 'choice';
  instructions: string;
  criteria: Record<T, string>;
}

export interface ScoreDecisionQuestion {
  type: 'score';
  instructions: string;
  criteria: string[];
}

export type EvaluationQuestion =
  | BooleanDecisionQuestion
  | ChoiceDecisionQuestion
  | ScoreDecisionQuestion;

/**
 * Jev Decision Request Wrapper
 */
export interface EvaluationStateInput {
  target: string;
  context?: Record<string, unknown>;
}

export interface JevDecisionResult<T> {
  decision: T;
  confidence: number;
  source: 'jev' | 'fallback';
  fallbackReason?: string;
  rawAnswer?: unknown;
}
