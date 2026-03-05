/**
 * Dynamic Interview System Types
 *
 * 熵驱动动态访谈系统类型定义
 */

/**
 * Core dimension stored in JSONB
 */
export interface CoreDimension {
  name: string;
  keywords: string[];
  weight: number;
  suggestion: string;
}

/**
 * Pending fact stored during cold-start phase
 */
export interface PendingFact {
  dimension: string;
  value: string | number | boolean;
  type: "string" | "number" | "boolean";
  confidence: number;
  extractedAt: string;
  topicId: string;
  isShared: boolean;
}

/**
 * Topic Blueprint database record
 */
export interface TopicBlueprint {
  id: string;
  topic: string;
  topicHash: string;
  coreDimensions: CoreDimension[];
  status: "pending" | "ready" | "failed";
  pendingFacts: PendingFact[] | null;
  modelUsed: string;
  errorMessage: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * commitAndEvaluate tool result
 */
export interface CommitAndEvaluateResult {
  success: boolean;
  currentSaturation: number;
  isReadyForOutline: boolean;
  isBlueprintPending: boolean;
  suggestedNextQuestions: string[];
  matchedDimensions: string[];
  missingDimensions: string[];
  error?: string;
}

/**
 * generateOutline tool result
 */
export interface GenerateOutlineResult {
  success: boolean;
  outline?: {
    title: string;
    description?: string;
    estimatedMinutes: number;
    chapters: Array<{
      title: string;
      description?: string;
      topics: string[];
      order: number;
    }>;
  };
  message?: string;
  error?: string;
}

/**
 * Saturation evaluation result
 * Zero-latency local evaluation result
 */
export interface SaturationEvaluation {
  score: number;
  isSaturated: boolean;
  isBlueprintPending: boolean;
  nextQuestions: string[];
  matchedDimensions: string[];
  missingDimensions: string[];
}

/**
 * Topic drift detection result
 */
export interface TopicDrift {
  isChanged: boolean;
  newTopic?: string;
}
