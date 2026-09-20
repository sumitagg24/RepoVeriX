/**
 * Reusable TypeSafe AI Jev Client using Vercel AI SDK experimental_evaluate API
 * 
 * Strict non-generative System 1 evaluation model:
 * - Model: `typesafe-ai/jev`
 * - Server-side key handling (TYPESAFE_API_KEY / JEV_API_KEY)
 * - Supported primitives: Classification, Routing, Scoring, Boolean decisions
 * - Built-in confidence thresholds & automatic deterministic fallbacks
 */

import { experimental_evaluate as evaluate } from 'ai';
import {
  VulnerabilityCategory,
  VULNERABILITY_CATEGORIES,
  VULNERABILITY_CATEGORY_CRITERIA,
  SeverityLevel,
  SEVERITY_LEVELS,
  SEVERITY_LEVEL_CRITERIA,
  ScanRoutingStrategy,
  SCAN_ROUTING_STRATEGIES,
  SCAN_ROUTING_CRITERIA,
  RISK_SCORE_LEVELS,
  EvaluationStateInput,
  JevDecisionResult,
} from './schemas';
import {
  extractConfidence,
  meetsConfidenceThreshold,
  DEFAULT_CONFIDENCE_THRESHOLD,
  ConfidenceOptions,
} from './confidence';
import { JevFallbackEngine } from './fallback';

export interface JevClientOptions {
  apiKey?: string;
  modelId?: string;
  defaultThreshold?: number;
}

export class JevClient {
  private apiKey: string | undefined;
  private modelId: string;
  private defaultThreshold: number;

  constructor(options: JevClientOptions = {}) {
    // SECURITY REQUIREMENT: Keep API key server-side. Never use NEXT_PUBLIC_ keys for secrets.
    this.apiKey =
      options.apiKey ||
      process.env.TYPESAFE_API_KEY ||
      process.env.JEV_API_KEY ||
      process.env.TYPESAFE_AI_API_KEY;

    this.modelId = options.modelId || 'typesafe-ai/jev';
    this.defaultThreshold = options.defaultThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  }

  /**
   * Helper to check server-side availability of Jev API Key
   */
  public isAvailable(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.trim().length > 0;
  }

  /**
   * STRICT CONSTRAINT GUARD: Block text generation calls.
   * Jev is a System 1 non-generative model.
   */
  public generateText(): never {
    throw new Error(
      'Invalid Operation: Jev is a non-generative decision model (typesafe-ai/jev) ' +
        'and does NOT support text generation. Use the primary LLM pipeline for prose generation.'
    );
  }

  /**
   * 1. CLASSIFY VULNERABILITY CATEGORY
   */
  public async classifyVulnerabilityCategory(
    input: EvaluationStateInput,
    options?: ConfidenceOptions
  ): Promise<JevDecisionResult<VulnerabilityCategory>> {
    const threshold = options?.threshold ?? this.defaultThreshold;

    if (!this.isAvailable()) {
      return {
        decision: JevFallbackEngine.classifyCategory(input),
        confidence: 0.5,
        source: 'fallback',
        fallbackReason: 'API key not configured server-side',
      };
    }

    try {
      const result = await evaluate({
        model: this.modelId as any,
        state: { target: input.target, context: input.context || {} },
        questions: {
          category: {
            type: 'choice',
            instructions: 'Classify the vulnerability category of the code artifact or finding',
            criteria: VULNERABILITY_CATEGORY_CRITERIA,
          },
        },
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      });

      const answer = (result.answers as any)?.category;
      const decision = answer?.choice as VulnerabilityCategory;
      const confidence = extractConfidence(answer);

      if (!decision || !VULNERABILITY_CATEGORIES.includes(decision) || !meetsConfidenceThreshold(confidence, threshold)) {
        return {
          decision: JevFallbackEngine.classifyCategory(input),
          confidence: Math.max(confidence, 0.5),
          source: 'fallback',
          fallbackReason: `Low confidence (${confidence.toFixed(2)} < ${threshold}) or unmapped choice`,
          rawAnswer: answer,
        };
      }

      return {
        decision,
        confidence,
        source: 'jev',
        rawAnswer: answer,
      };
    } catch (err: any) {
      return {
        decision: JevFallbackEngine.classifyCategory(input),
        confidence: 0.5,
        source: 'fallback',
        fallbackReason: `Jev API evaluation error: ${err?.message || err}`,
      };
    }
  }

  /**
   * 2. CLASSIFY SEVERITY LEVEL
   */
  public async classifySeverity(
    input: EvaluationStateInput,
    options?: ConfidenceOptions
  ): Promise<JevDecisionResult<SeverityLevel>> {
    const threshold = options?.threshold ?? this.defaultThreshold;

    if (!this.isAvailable()) {
      return {
        decision: JevFallbackEngine.classifySeverity(input),
        confidence: 0.5,
        source: 'fallback',
        fallbackReason: 'API key not configured server-side',
      };
    }

    try {
      const result = await evaluate({
        model: this.modelId as any,
        state: { target: input.target, context: input.context || {} },
        questions: {
          severity: {
            type: 'choice',
            instructions: 'Evaluate the severity level of the finding',
            criteria: SEVERITY_LEVEL_CRITERIA,
          },
        },
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      });

      const answer = (result.answers as any)?.severity;
      const decision = answer?.choice as SeverityLevel;
      const confidence = extractConfidence(answer);

      if (!decision || !SEVERITY_LEVELS.includes(decision) || !meetsConfidenceThreshold(confidence, threshold)) {
        return {
          decision: JevFallbackEngine.classifySeverity(input),
          confidence: Math.max(confidence, 0.5),
          source: 'fallback',
          fallbackReason: `Low confidence (${confidence.toFixed(2)} < ${threshold}) or invalid choice`,
          rawAnswer: answer,
        };
      }

      return {
        decision,
        confidence,
        source: 'jev',
        rawAnswer: answer,
      };
    } catch (err: any) {
      return {
        decision: JevFallbackEngine.classifySeverity(input),
        confidence: 0.5,
        source: 'fallback',
        fallbackReason: `Jev API evaluation error: ${err?.message || err}`,
      };
    }
  }

  /**
   * 3. ROUTE SCAN STRATEGY
   */
  public async routeScanStrategy(
    input: EvaluationStateInput,
    options?: ConfidenceOptions
  ): Promise<JevDecisionResult<ScanRoutingStrategy>> {
    const threshold = options?.threshold ?? this.defaultThreshold;

    if (!this.isAvailable()) {
      return {
        decision: JevFallbackEngine.routeScan(input),
        confidence: 0.5,
        source: 'fallback',
        fallbackReason: 'API key not configured server-side',
      };
    }

    try {
      const result = await evaluate({
        model: this.modelId as any,
        state: { target: input.target, context: input.context || {} },
        questions: {
          strategy: {
            type: 'choice',
            instructions: 'Determine the optimal scan execution strategy for this repository state',
            criteria: SCAN_ROUTING_CRITERIA,
          },
        },
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      });

      const answer = (result.answers as any)?.strategy;
      const decision = answer?.choice as ScanRoutingStrategy;
      const confidence = extractConfidence(answer);

      if (!decision || !SCAN_ROUTING_STRATEGIES.includes(decision) || !meetsConfidenceThreshold(confidence, threshold)) {
        return {
          decision: JevFallbackEngine.routeScan(input),
          confidence: Math.max(confidence, 0.5),
          source: 'fallback',
          fallbackReason: `Low confidence (${confidence.toFixed(2)} < ${threshold}) or invalid strategy`,
          rawAnswer: answer,
        };
      }

      return {
        decision,
        confidence,
        source: 'jev',
        rawAnswer: answer,
      };
    } catch (err: any) {
      return {
        decision: JevFallbackEngine.routeScan(input),
        confidence: 0.5,
        source: 'fallback',
        fallbackReason: `Jev API evaluation error: ${err?.message || err}`,
      };
    }
  }

  /**
   * 4. SCORE EXPLOITABILITY RISK (1-5 Scale)
   */
  public async scoreRisk(
    input: EvaluationStateInput,
    options?: ConfidenceOptions
  ): Promise<JevDecisionResult<number>> {
    const threshold = options?.threshold ?? this.defaultThreshold;

    if (!this.isAvailable()) {
      return {
        decision: JevFallbackEngine.scoreRisk(input),
        confidence: 0.5,
        source: 'fallback',
        fallbackReason: 'API key not configured server-side',
      };
    }

    try {
      const result = await evaluate({
        model: this.modelId as any,
        state: { target: input.target, context: input.context || {} },
        questions: {
          riskScore: {
            type: 'score',
            instructions: 'Rate the exploitability risk score of the target from 1 (minimal) to 5 (critical)',
            criteria: [...RISK_SCORE_LEVELS],
          },
        },
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      });

      const answer = (result.answers as any)?.riskScore;
      const rawScore = answer?.score; // 1 to 5
      const confidence = extractConfidence(answer);

      if (typeof rawScore !== 'number' || rawScore < 1 || rawScore > 5 || !meetsConfidenceThreshold(confidence, threshold)) {
        return {
          decision: JevFallbackEngine.scoreRisk(input),
          confidence: Math.max(confidence, 0.5),
          source: 'fallback',
          fallbackReason: `Low confidence (${confidence.toFixed(2)} < ${threshold}) or score out of range`,
          rawAnswer: answer,
        };
      }

      return {
        decision: rawScore,
        confidence,
        source: 'jev',
        rawAnswer: answer,
      };
    } catch (err: any) {
      return {
        decision: JevFallbackEngine.scoreRisk(input),
        confidence: 0.5,
        source: 'fallback',
        fallbackReason: `Jev API evaluation error: ${err?.message || err}`,
      };
    }
  }

  /**
   * 5. EVALUATE BOOLEAN DECISION
   */
  public async evaluateBoolean(
    input: EvaluationStateInput,
    instructions: string,
    options?: ConfidenceOptions
  ): Promise<JevDecisionResult<boolean>> {
    const threshold = options?.threshold ?? this.defaultThreshold;

    if (!this.isAvailable()) {
      return {
        decision: JevFallbackEngine.evaluateBoolean(input, instructions),
        confidence: 0.5,
        source: 'fallback',
        fallbackReason: 'API key not configured server-side',
      };
    }

    try {
      const result = await evaluate({
        model: this.modelId as any,
        state: { target: input.target, context: input.context || {} },
        questions: {
          decision: {
            type: 'boolean',
            instructions,
          },
        },
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      });

      const answer = (result.answers as any)?.decision;
      const boolValue = answer?.value;
      const confidence = extractConfidence(answer);

      if (typeof boolValue !== 'boolean' || !meetsConfidenceThreshold(confidence, threshold)) {
        return {
          decision: JevFallbackEngine.evaluateBoolean(input, instructions),
          confidence: Math.max(confidence, 0.5),
          source: 'fallback',
          fallbackReason: `Low confidence (${confidence.toFixed(2)} < ${threshold}) or invalid boolean response`,
          rawAnswer: answer,
        };
      }

      return {
        decision: boolValue,
        confidence,
        source: 'jev',
        rawAnswer: answer,
      };
    } catch (err: any) {
      return {
        decision: JevFallbackEngine.evaluateBoolean(input, instructions),
        confidence: 0.5,
        source: 'fallback',
        fallbackReason: `Jev API evaluation error: ${err?.message || err}`,
      };
    }
  }
}
