/**
 * Rule-based Fallback Engine for TypeSafe AI Jev
 * 
 * Provides deterministic, guaranteed fallback answers when:
 * 1. API key is unconfigured or server environment variable is missing
 * 2. External Jev network / gateway request fails
 * 3. Confidence threshold check fails
 */

import {
  VulnerabilityCategory,
  SeverityLevel,
  ScanRoutingStrategy,
  EvaluationStateInput,
} from './schemas';

export class JevFallbackEngine {
  /**
   * Fallback for Vulnerability Category Classification
   */
  static classifyCategory(input: EvaluationStateInput): VulnerabilityCategory {
    const text = (input.target + ' ' + JSON.stringify(input.context || {})).toLowerCase();

    if (text.includes('select') || text.includes('sql') || text.includes('where') || text.includes('query')) {
      return 'SQL_INJECTION';
    }
    if (text.includes('exec') || text.includes('system(') || text.includes('spawn') || text.includes('subprocess') || text.includes('shell')) {
      return 'COMMAND_INJECTION';
    }
    if (text.includes('script') || text.includes('xss') || text.includes('innerhtml') || text.includes('dom')) {
      return 'CROSS_SITE_SCRIPTING';
    }
    if (text.includes('auth') || text.includes('token') || text.includes('jwt') || text.includes('password') || text.includes('session')) {
      return 'AUTHENTICATION_BYPASS';
    }
    if (text.includes('path') || text.includes('../') || text.includes('directory') || text.includes('file')) {
      return 'PATH_TRAVERSAL';
    }
    if (text.includes('pickle') || text.includes('deserialize') || text.includes('unmarshal') || text.includes('yaml.load')) {
      return 'INSECURE_DESERIALIZATION';
    }
    if (text.includes('md5') || text.includes('sha1') || text.includes('secret') || text.includes('cipher') || text.includes('key')) {
      return 'WEAK_CRYPTOGRAPHY';
    }

    return 'OTHER';
  }

  /**
   * Fallback for Vulnerability Severity Level Classification
   */
  static classifySeverity(input: EvaluationStateInput): SeverityLevel {
    const text = (input.target + ' ' + JSON.stringify(input.context || {})).toLowerCase();

    if (text.includes('rce') || text.includes('arbitrary code') || text.includes('critical') || text.includes('unauthenticated admin')) {
      return 'CRITICAL';
    }
    if (text.includes('injection') || text.includes('bypass') || text.includes('high') || text.includes('leak')) {
      return 'HIGH';
    }
    if (text.includes('medium') || text.includes('warning') || text.includes('deprecated') || text.includes('unhandled')) {
      return 'MEDIUM';
    }
    if (text.includes('low') || text.includes('minor') || text.includes('style') || text.includes('linter')) {
      return 'LOW';
    }

    return 'INFO';
  }

  /**
   * Fallback for Scan Routing Strategy
   */
  static routeScan(input: EvaluationStateInput): ScanRoutingStrategy {
    const text = (input.target + ' ' + JSON.stringify(input.context || {})).toLowerCase();

    if (text.includes('fix') || text.includes('patch') || text.includes('repair') || text.includes('autofix')) {
      return 'AUTOMATED_REPAIR';
    }
    if (text.includes('graph') || text.includes('dependency') || text.includes('multi-file') || text.includes('full audit')) {
      return 'DEEP_EVIDENCE_GRAPH';
    }

    return 'FAST_STATIC_ONLY';
  }

  /**
   * Fallback for Exploitability Risk Score (1 to 5 scale)
   */
  static scoreRisk(input: EvaluationStateInput): number {
    const text = (input.target + ' ' + JSON.stringify(input.context || {})).toLowerCase();

    if (text.includes('remote code execution') || text.includes('zero day') || text.includes('critical')) {
      return 5;
    }
    if (text.includes('high severity') || text.includes('exploit') || text.includes('sql injection')) {
      return 4;
    }
    if (text.includes('moderate') || text.includes('medium') || text.includes('xss')) {
      return 3;
    }
    if (text.includes('low') || text.includes('minor')) {
      return 2;
    }

    return 1;
  }

  /**
   * Fallback for Boolean Questions
   */
  static evaluateBoolean(input: EvaluationStateInput, questionInstructions: string): boolean {
    const text = (input.target + ' ' + questionInstructions + ' ' + JSON.stringify(input.context || {})).toLowerCase();

    // Check positive indicator keywords vs negative keywords
    const positiveKeywords = ['true', 'yes', 'valid', 'vulnerable', 'is patchable', 'escalate', 'urgent', 'repairable'];
    const negativeKeywords = ['false', 'no', 'safe', 'secure', 'unpatchable', 'ignore', 'harmless'];

    let posCount = 0;
    let negCount = 0;

    for (const kw of positiveKeywords) {
      if (text.includes(kw)) posCount++;
    }
    for (const kw of negativeKeywords) {
      if (text.includes(kw)) negCount++;
    }

    return posCount >= negCount;
  }
}
