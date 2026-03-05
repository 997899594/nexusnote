/**
 * Local Saturation Evaluator
 *
 * Zero-latency evaluation using local keyword matching
 * No LLM calls - pure rule-based computation
 */

import type {
  CoreDimension,
  PendingFact,
  SaturationEvaluation,
  TopicBlueprint,
  TopicDrift,
} from "@/types/interview";
import { getBlueprint } from "../blueprint/cache";

// ============================================
// Configuration
// ============================================

const SATURATION_THRESHOLD = 80; // 80% saturation = ready for outline
const HIGH_CONFIDENCE_THRESHOLD = 0.7; // Facts with confidence > 0.7 are high-quality

// ============================================
// Core Evaluation Functions
// ============================================

/**
 * Calculate saturation score for a topic
 * Uses weighted keyword matching - zero latency
 */
export function calculateSaturation(
  blueprint: TopicBlueprint,
  facts: PendingFact[],
): SaturationEvaluation {
  const dimensions = blueprint.coreDimensions;

  // Track matched dimensions
  const matchedDimensions: string[] = [];
  const dimensionScores: Map<string, number> = new Map();

  // Score each dimension
  for (const dim of dimensions) {
    const dimFacts = facts.filter((f) => f.dimension === dim.name);

    if (dimFacts.length > 0) {
      // Calculate dimension coverage
      const uniqueKeywords = new Set(dimFacts.flatMap((f) => String(f.value)));
      const keywordCoverage = Math.min(uniqueKeywords.size / Math.max(dim.keywords.length, 1), 1);

      // Calculate confidence boost
      const avgConfidence = dimFacts.reduce((sum, f) => sum + f.confidence, 0) / dimFacts.length;
      const confidenceBoost = avgConfidence > HIGH_CONFIDENCE_THRESHOLD ? 1.2 : 1.0;

      // Final dimension score
      const score = Math.min(keywordCoverage * confidenceBoost, 1);
      dimensionScores.set(dim.name, score);
      matchedDimensions.push(dim.name);
    } else {
      dimensionScores.set(dim.name, 0);
    }
  }

  // Calculate weighted saturation score
  let totalScore = 0;
  let totalWeight = 0;

  for (const dim of dimensions) {
    const score = dimensionScores.get(dim.name) ?? 0;
    totalScore += score * dim.weight;
    totalWeight += dim.weight;
  }

  const saturationScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;

  // Find missing dimensions
  const missingDimensions = dimensions
    .filter((dim) => (dimensionScores.get(dim.name) ?? 0) < 0.3)
    .map((dim) => dim.name);

  // Generate next questions based on missing dimensions
  const nextQuestions = missingDimensions
    .flatMap((dimName) => {
      const dim = dimensions.find((d) => d.name === dimName);
      return dim ? [dim.suggestion] : [];
    })
    .slice(0, 3);

  return {
    score: Math.round(saturationScore),
    isSaturated: saturationScore >= SATURATION_THRESHOLD,
    isBlueprintPending: false,
    nextQuestions,
    matchedDimensions,
    missingDimensions,
  };
}

/**
 * Quick saturation check (for blueprint-pending state)
 * Returns default low-saturation result
 */
export function createPendingSaturation(): SaturationEvaluation {
  return {
    score: 0,
    isSaturated: false,
    isBlueprintPending: true,
    nextQuestions: ["能否告诉我您对这个主题的现有了解？", "您希望通过学习达到什么目标？"],
    matchedDimensions: [],
    missingDimensions: [],
  };
}

// ============================================
// Fact Extraction Helpers
// ============================================

/**
 * Match text against dimension keywords
 * Returns matched dimension names and extracted facts
 */
export function matchKeywords(
  text: string,
  dimensions: CoreDimension[],
): Array<{ dimension: string; keyword: string }> {
  const matches: Array<{ dimension: string; keyword: string }> = [];
  const lowerText = text.toLowerCase();

  for (const dim of dimensions) {
    for (const keyword of dim.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches.push({ dimension: dim.name, keyword });
      }
    }
  }

  return matches;
}

/**
 * Extract facts from text using keyword matching
 * Creates PendingFact entries for matched dimensions
 */
export function extractFactsFromText(
  text: string,
  dimensions: CoreDimension[],
  topicId: string,
  isShared: boolean = false,
): PendingFact[] {
  const matches = matchKeywords(text, dimensions);
  const facts: PendingFact[] = [];
  const seenDimensions = new Set<string>();

  for (const match of matches) {
    // Deduplicate by dimension
    if (seenDimensions.has(match.dimension)) continue;
    seenDimensions.add(match.dimension);

    facts.push({
      dimension: match.dimension,
      value: match.keyword,
      type: "string",
      confidence: 0.6, // Base confidence for keyword match
      extractedAt: new Date().toISOString(),
      topicId,
      isShared,
    });
  }

  return facts;
}

// ============================================
// Topic Drift Detection
// ============================================

/**
 * Detect if user has changed topic
 * Simple implementation: check if new text matches any blueprint keywords
 */
export function detectTopicDrift(
  text: string,
  blueprint: TopicBlueprint,
  threshold: number = 0.2,
): TopicDrift {
  const matches = matchKeywords(text, blueprint.coreDimensions);
  const matchRatio = matches.length / blueprint.coreDimensions.length;

  // If less than 20% of dimensions match, topic has drifted
  if (matchRatio < threshold && matches.length === 0) {
    return {
      isChanged: true,
      newTopic: undefined, // Will be detected by LLM in commitAndEvaluate
    };
  }

  return { isChanged: false };
}

// ============================================
// Main Evaluation Entry Point
// ============================================

/**
 * Evaluate topic saturation with blueprint lookup
 * Handles both ready and pending blueprint states
 */
export async function evaluateSaturation(
  topic: string,
  facts: PendingFact[],
): Promise<SaturationEvaluation> {
  const blueprint = await getBlueprint(topic);

  if (!blueprint) {
    // Blueprint not ready yet
    return createPendingSaturation();
  }

  if (blueprint.status === "pending") {
    return createPendingSaturation();
  }

  if (blueprint.status === "failed") {
    return {
      score: 0,
      isSaturated: false,
      isBlueprintPending: false,
      nextQuestions: [],
      matchedDimensions: [],
      missingDimensions: [],
    };
  }

  return calculateSaturation(blueprint, facts);
}
