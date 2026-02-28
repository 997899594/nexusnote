/**
 * EMA (Exponential Moving Average) Algorithm
 *
 * Used for smooth updates to style analysis metrics.
 * EMA gives more weight to recent observations while smoothing out fluctuations.
 */

import type { EMAValue } from "@/types/profile";

/**
 * Re-export EMAValue from types/profile for convenience
 */
export type { EMAValue } from "@/types/profile";

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
 * @returns Updated EMA value with lastAnalyzedAt set to current time
 */
export function updateEMA(
  current: { value: number; confidence: number; samples: number; lastAnalyzedAt?: string },
  newValue: number,
  alpha: number = DEFAULT_ALPHA,
): EMAValue {
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
    lastAnalyzedAt: new Date().toISOString(),
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
  current: Record<string, EMAValue>,
  newValues: Record<string, number>,
  alpha: number = DEFAULT_ALPHA,
): Record<string, EMAValue> {
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
        lastAnalyzedAt: new Date().toISOString(),
      };
    }
  }

  return result;
}

/**
 * Reset an EMA value to initial state
 *
 * @param initialValue - Initial value (0-1), default 0.5
 * @returns Reset EMA value with lastAnalyzedAt as empty string (never analyzed)
 */
export function resetEMA(initialValue: number = 0.5): EMAValue {
  return {
    value: Math.max(0, Math.min(1, initialValue)),
    confidence: 0,
    samples: 0,
    lastAnalyzedAt: "",
  };
}

/**
 * Calculate the effective weight given the current sample count
 *
 * @param samples - Number of samples observed
 * @param alpha - Smoothing factor
 * @returns Effective weight of the current EMA value (0-1)
 */
export function getEffectiveWeight(samples: number, alpha: number = DEFAULT_ALPHA): number {
  // After n samples, the effective weight is (1-alpha)^n
  return (1 - alpha) ** samples;
}
