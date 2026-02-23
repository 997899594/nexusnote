/**
 * EMA (Exponential Moving Average) Algorithm
 *
 * Used for smooth updates to style analysis metrics.
 * EMA gives more weight to recent observations while smoothing out fluctuations.
 */

/**
 * Re-export EMAValue from profile.ts for convenience
 */
export type { EMAValue } from "../profile";

/**
 * Default smoothing factor (alpha)
 * Lower values = smoother but slower adaptation
 * Higher values = faster response but more volatility
 */
const DEFAULT_ALPHA = 0.3;

/**
 * Update an EMA value with a new observation
 *
 * EMA formula: newEMA = alpha * newValue + (1 - alpha) * oldEMA
 *
 * @param current - Current EMA value with confidence and sample count
 * @param newValue - New observation (0-1)
 * @param alpha - Smoothing factor (0-1), default 0.3
 * @returns Updated EMA value
 */
export function updateEMA(
  current: { value: number; confidence: number; samples: number },
  newValue: number,
  alpha: number = DEFAULT_ALPHA
): { value: number; confidence: number; samples: number } {
  // Clamp input to valid range
  const clampedValue = Math.max(0, Math.min(1, newValue));

  const newSamples = current.samples + 1;

  // EMA formula: newEMA = alpha * newValue + (1 - alpha) * oldEMA
  const newEMA = alpha * clampedValue + (1 - alpha) * current.value;

  // Confidence increases with sample count, capped at 0.95
  // Growth rate: 10% of remaining gap per sample
  const newConfidence = Math.min(0.95, current.confidence + (1 - current.confidence) * 0.1);

  return {
    value: Math.max(0, Math.min(1, newEMA)),
    confidence: newConfidence,
    samples: newSamples,
  };
}

/**
 * Batch update multiple EMA values
 *
 * @param current - Current EMA values as a record
 * @param newValues - New observations as a record
 * @param alpha - Smoothing factor (0-1), default 0.3
 * @returns Updated EMA values record
 */
export function updateEMABatch(
  current: Record<string, { value: number; confidence: number; samples: number }>,
  newValues: Record<string, number>,
  alpha: number = DEFAULT_ALPHA
): Record<string, { value: number; confidence: number; samples: number }> {
  const result = { ...current };

  for (const [key, newValue] of Object.entries(newValues)) {
    if (key in result) {
      result[key] = updateEMA(result[key], newValue, alpha);
    } else {
      // Initialize new metric with low confidence
      result[key] = {
        value: Math.max(0, Math.min(1, newValue)),
        confidence: 0.1,
        samples: 1,
      };
    }
  }

  return result;
}

/**
 * Reset an EMA value to initial state
 *
 * @param initialValue - Initial value (0-1), default 0.5
 * @returns Reset EMA value
 */
export function resetEMA(initialValue: number = 0.5): {
  value: number;
  confidence: number;
  samples: number;
} {
  return {
    value: Math.max(0, Math.min(1, initialValue)),
    confidence: 0,
    samples: 0,
  };
}

/**
 * Calculate the effective weight given the current sample count
 *
 * @param samples - Number of samples observed
 * @param alpha - Smoothing factor
 * @returns Effective weight of the current EMA value (0-1)
 */
export function getEffectiveWeight(
  samples: number,
  alpha: number = DEFAULT_ALPHA
): number {
  // After n samples, the effective weight is (1-alpha)^n
  return Math.pow(1 - alpha, samples);
}
