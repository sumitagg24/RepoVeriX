/**
 * Confidence Thresholds & Evaluation Logic for TypeSafe AI Jev
 */

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.70;

export interface ConfidenceOptions {
  /** Minimum confidence threshold required to accept Jev decision (0.0 - 1.0) */
  threshold?: number;
}

/**
 * Extracts and validates the confidence score from a Jev evaluation answer.
 * Jev probability or confidence is normalized between 0.0 and 1.0.
 */
export function extractConfidence(answer: any): number {
  if (!answer || typeof answer !== 'object') {
    return 0;
  }

  // If explicit confidence is present
  if (typeof answer.confidence === 'number' && !isNaN(answer.confidence)) {
    return Math.max(0, Math.min(1, answer.confidence));
  }

  // For boolean evaluation with P(true)
  if (answer.type === 'boolean') {
    if (typeof answer.probability === 'number' && !isNaN(answer.probability)) {
      // Distance from uncertain (0.5) to certain (0.0 or 1.0)
      const p = answer.value ? answer.probability : 1 - answer.probability;
      return Math.max(0, Math.min(1, p));
    }
  }

  // For choice answer with probability distribution
  if (answer.type === 'choice' && answer.probabilities && answer.choice) {
    const prob = answer.probabilities[answer.choice];
    if (typeof prob === 'number' && !isNaN(prob)) {
      return Math.max(0, Math.min(1, prob));
    }
  }

  // For score answer with probability distribution
  if (answer.type === 'score' && Array.isArray(answer.probabilities) && typeof answer.score === 'number') {
    const idx = answer.score - 1; // 1-indexed to 0-indexed
    const prob = answer.probabilities[idx];
    if (typeof prob === 'number' && !isNaN(prob)) {
      return Math.max(0, Math.min(1, prob));
    }
  }

  // Default high confidence if answer is valid but missing raw probability metrics
  return 0.85;
}

/**
 * Validates if the extracted confidence meets or exceeds the given threshold.
 */
export function meetsConfidenceThreshold(
  confidence: number,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): boolean {
  return confidence >= threshold;
}
