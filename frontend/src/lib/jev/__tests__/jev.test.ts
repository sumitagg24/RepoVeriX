import { JevClient } from '../client';
import { extractConfidence, meetsConfidenceThreshold } from '../confidence';
import { JevFallbackEngine } from '../fallback';
import {
  VULNERABILITY_CATEGORIES,
  SEVERITY_LEVELS,
  SCAN_ROUTING_STRATEGIES,
} from '../schemas';

// Mock AI SDK experimental_evaluate
jest.mock('ai', () => ({
  experimental_evaluate: jest.fn(),
}));

import { experimental_evaluate } from 'ai';

describe('TypeSafe AI Jev Integration', () => {
  const mockEvaluate = experimental_evaluate as jest.MockedFunction<typeof experimental_evaluate>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Server-side Security & Configuration', () => {
    it('does not expose API keys to browser window context', () => {
      const globalEnv = process.env;
      expect(globalEnv.NEXT_PUBLIC_TYPESAFE_API_KEY).toBeUndefined();
      expect(globalEnv.NEXT_PUBLIC_JEV_API_KEY).toBeUndefined();
    });

    it('instantiates client and reports availability based on server key presence', () => {
      const clientWithKey = new JevClient({ apiKey: 'test-secret-key' });
      expect(clientWithKey.isAvailable()).toBe(true);

      const clientWithoutKey = new JevClient({ apiKey: '' });
      expect(clientWithoutKey.isAvailable()).toBe(false);
    });

    it('strictly forbids text generation attempts', () => {
      const client = new JevClient({ apiKey: 'test-key' });
      expect(() => client.generateText()).toThrow(
        /non-generative decision model.*typesafe-ai\/jev/
      );
    });
  });

  describe('Confidence Thresholds', () => {
    it('extracts confidence from different answer types', () => {
      expect(extractConfidence({ type: 'choice', confidence: 0.92 })).toBe(0.92);
      expect(
        extractConfidence({
          type: 'choice',
          choice: 'SQL_INJECTION',
          probabilities: { SQL_INJECTION: 0.88 },
        })
      ).toBe(0.88);
      expect(
        extractConfidence({
          type: 'boolean',
          value: true,
          probability: 0.95,
        })
      ).toBe(0.95);
      expect(
        extractConfidence({
          type: 'score',
          score: 4,
          probabilities: [0.05, 0.05, 0.1, 0.7, 0.1],
        })
      ).toBe(0.7);
    });

    it('evaluates whether confidence meets threshold correctly', () => {
      expect(meetsConfidenceThreshold(0.85, 0.7)).toBe(true);
      expect(meetsConfidenceThreshold(0.65, 0.7)).toBe(false);
      expect(meetsConfidenceThreshold(0.7, 0.7)).toBe(true);
    });
  });

  describe('Deterministic Fallback Engine', () => {
    it('correctly classifies vulnerability category via fallbacks', () => {
      expect(
        JevFallbackEngine.classifyCategory({ target: 'SELECT * FROM users WHERE id = ' + 'input' })
      ).toBe('SQL_INJECTION');

      expect(
        JevFallbackEngine.classifyCategory({ target: 'exec("rm -rf " + user_input)' })
      ).toBe('COMMAND_INJECTION');

      expect(
        JevFallbackEngine.classifyCategory({ target: 'innerHTML = userInput' })
      ).toBe('CROSS_SITE_SCRIPTING');

      expect(
        JevFallbackEngine.classifyCategory({ target: 'unknown code block' })
      ).toBe('OTHER');
    });

    it('correctly classifies severity level via fallbacks', () => {
      expect(
        JevFallbackEngine.classifySeverity({ target: 'Unauthenticated RCE vulnerability' })
      ).toBe('CRITICAL');

      expect(
        JevFallbackEngine.classifySeverity({ target: 'SQL injection leak' })
      ).toBe('HIGH');
    });

    it('correctly routes scan strategy via fallbacks', () => {
      expect(
        JevFallbackEngine.routeScan({ target: 'Generate patch and repair flaw' })
      ).toBe('AUTOMATED_REPAIR');

      expect(
        JevFallbackEngine.routeScan({ target: 'Multi-file dependency graph analysis' })
      ).toBe('DEEP_EVIDENCE_GRAPH');

      expect(
        JevFallbackEngine.routeScan({ target: 'Quick static check' })
      ).toBe('FAST_STATIC_ONLY');
    });

    it('correctly rates risk scores via fallbacks', () => {
      expect(JevFallbackEngine.scoreRisk({ target: 'Critical zero day RCE' })).toBe(5);
      expect(JevFallbackEngine.scoreRisk({ target: 'Low impact warning' })).toBe(2);
    });

    it('correctly evaluates boolean decisions via fallbacks', () => {
      expect(
        JevFallbackEngine.evaluateBoolean(
          { target: 'Vulnerable code' },
          'Is this finding patchable?'
        )
      ).toBe(true);
    });
  });

  describe('JevClient Evaluation with typesafe-ai/jev', () => {
    let client: JevClient;

    beforeEach(() => {
      client = new JevClient({ apiKey: 'test-jev-key', defaultThreshold: 0.7 });
    });

    it('evaluates vulnerability category classification using AI SDK evaluate API', async () => {
      mockEvaluate.mockResolvedValueOnce({
        answers: {
          category: {
            type: 'choice',
            choice: 'SQL_INJECTION',
            confidence: 0.94,
          },
        },
      } as any);

      const res = await client.classifyVulnerabilityCategory({
        target: 'SELECT * FROM users WHERE id = user_id',
      });

      expect(mockEvaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'typesafe-ai/jev',
          state: {
            target: 'SELECT * FROM users WHERE id = user_id',
            context: {},
          },
        })
      );
      expect(res.decision).toBe('SQL_INJECTION');
      expect(res.source).toBe('jev');
      expect(res.confidence).toBe(0.94);
    });

    it('falls back when confidence is below threshold', async () => {
      mockEvaluate.mockResolvedValueOnce({
        answers: {
          category: {
            type: 'choice',
            choice: 'SQL_INJECTION',
            confidence: 0.45, // below 0.7 threshold
          },
        },
      } as any);

      const res = await client.classifyVulnerabilityCategory({
        target: 'exec(cmd)',
      });

      expect(res.source).toBe('fallback');
      expect(res.decision).toBe('COMMAND_INJECTION');
      expect(res.fallbackReason).toContain('Low confidence');
    });

    it('falls back automatically when Jev API call throws an error', async () => {
      mockEvaluate.mockRejectedValueOnce(new Error('Network timeout'));

      const res = await client.classifySeverity({
        target: 'Critical RCE bug',
      });

      expect(res.source).toBe('fallback');
      expect(res.decision).toBe('CRITICAL');
      expect(res.fallbackReason).toContain('Jev API evaluation error');
    });

    it('falls back automatically when API key is missing', async () => {
      const clientNoKey = new JevClient({ apiKey: '' });

      const res = await clientNoKey.routeScanStrategy({
        target: 'Need automated patch repair',
      });

      expect(res.source).toBe('fallback');
      expect(res.decision).toBe('AUTOMATED_REPAIR');
      expect(res.fallbackReason).toBe('API key not configured server-side');
    });

    it('evaluates risk score on 1-5 scale using AI SDK evaluate API', async () => {
      mockEvaluate.mockResolvedValueOnce({
        answers: {
          riskScore: {
            type: 'score',
            score: 4,
            confidence: 0.85,
          },
        },
      } as any);

      const res = await client.scoreRisk({
        target: 'High severity SQL injection',
      });

      expect(res.decision).toBe(4);
      expect(res.source).toBe('jev');
      expect(res.confidence).toBe(0.85);
    });

    it('evaluates boolean decision using AI SDK evaluate API', async () => {
      mockEvaluate.mockResolvedValueOnce({
        answers: {
          decision: {
            type: 'boolean',
            value: true,
            confidence: 0.91,
          },
        },
      } as any);

      const res = await client.evaluateBoolean(
        { target: 'Vulnerable function' },
        'Is this finding auto-fixable?'
      );

      expect(res.decision).toBe(true);
      expect(res.source).toBe('jev');
      expect(res.confidence).toBe(0.91);
    });
  });
});
