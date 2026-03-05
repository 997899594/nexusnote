/**
 * Fact Manager
 *
 * 统一事实管理器
 * - 去重（Upsert 语义）
 * - 合并（置信度加权）
 * - 话题隔离
 */

import type { PendingFact } from "@/types/interview";

// ============================================
// Types
// ============================================

export interface FactMergeOptions {
  /** 覆盖策略：higher-confidence 保留更高置信度，latest 保留最新 */
  strategy: "higher-confidence" | "latest";
}

// ============================================
// Core Functions
// ============================================

/**
 * Upsert 合并事实
 *
 * 核心规则：
 * 1. 相同 dimension → 覆盖或合并
 * 2. 根据 strategy 决定保留哪个
 */
export function mergeFacts(
  existing: PendingFact[],
  incoming: PendingFact[],
  options: FactMergeOptions = { strategy: "higher-confidence" },
): PendingFact[] {
  const factMap = new Map<string, PendingFact>();

  // 1. 加入现有事实
  for (const fact of existing) {
    factMap.set(fact.dimension, fact);
  }

  // 2. Upsert 新事实
  for (const newFact of incoming) {
    const existingFact = factMap.get(newFact.dimension);

    if (!existingFact) {
      // 新维度，直接加入
      factMap.set(newFact.dimension, newFact);
    } else {
      // 已有维度，根据策略决定
      if (options.strategy === "higher-confidence") {
        if (newFact.confidence > existingFact.confidence) {
          factMap.set(newFact.dimension, newFact);
        }
      } else {
        // latest 策略，直接覆盖
        factMap.set(newFact.dimension, newFact);
      }
    }
  }

  return Array.from(factMap.values());
}

/**
 * 获取已覆盖的维度列表
 */
export function getCoveredDimensions(facts: PendingFact[]): string[] {
  return [...new Set(facts.map((f) => f.dimension))];
}

/**
 * 计算缺失的维度
 */
export function getMissingDimensions(
  facts: PendingFact[],
  requiredDimensions: string[],
): string[] {
  const covered = new Set(getCoveredDimensions(facts));
  return requiredDimensions.filter((d) => !covered.has(d));
}

/**
 * 计算维度覆盖分数（加权）
 */
export function calculateDimensionCoverage(
  facts: PendingFact[],
  requiredDimensions: Array<{ name: string; weight: number }>,
): { score: number; covered: string[]; missing: string[] } {
  const coveredDimensions = new Set(getCoveredDimensions(facts));
  const covered: string[] = [];
  const missing: string[] = [];
  let totalWeight = 0;
  let coveredWeight = 0;

  for (const dim of requiredDimensions) {
    totalWeight += dim.weight;
    if (coveredDimensions.has(dim.name)) {
      coveredWeight += dim.weight;
      covered.push(dim.name);
    } else {
      missing.push(dim.name);
    }
  }

  const score = totalWeight > 0 ? Math.round((coveredWeight / totalWeight) * 100) : 0;

  return { score, covered, missing };
}

// ============================================
// Topic Management Functions
// ============================================

/**
 * 去重事实（基于 dimension）
 * 保留置信度最高的事实
 */
export function deduplicateFacts(facts: PendingFact[]): PendingFact[] {
  const factMap = new Map<string, PendingFact>();

  for (const fact of facts) {
    const existing = factMap.get(fact.dimension);
    if (!existing || fact.confidence > existing.confidence) {
      factMap.set(fact.dimension, fact);
    }
  }

  return Array.from(factMap.values());
}

/**
 * 按话题 ID 过滤事实
 */
export function filterFactsByTopic(facts: PendingFact[], topicId: string): PendingFact[] {
  return facts.filter((f) => f.topicId === topicId);
}

/**
 * 话题切换时分割事实
 * 返回 [共享事实, 旧话题独有事实, 新话题初始事实]
 */
export function splitFactsOnTopicChange(
  facts: PendingFact[],
  oldTopicId: string,
  newTopicId: string,
): {
  sharedFacts: PendingFact[];
  oldTopicFacts: PendingFact[];
  newTopicInitialFacts: PendingFact[];
} {
  const sharedFacts = facts.filter((f) => f.isShared);
  const oldTopicFacts = facts.filter((f) => f.topicId === oldTopicId && !f.isShared);

  // 新话题的初始事实 = 共享事实（复制到新 topicId）
  const newTopicInitialFacts = sharedFacts.map((f) => ({
    ...f,
    topicId: newTopicId,
    extractedAt: new Date().toISOString(),
  }));

  return { sharedFacts, oldTopicFacts, newTopicInitialFacts };
}
