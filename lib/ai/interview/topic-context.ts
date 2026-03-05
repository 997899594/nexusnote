/**
 * Topic Context Manager
 *
 * 话题上下文管理器
 * - 话题切换与历史
 * - 共享事实识别
 * - 话题回退恢复
 */

import type { PendingFact } from "@/types/interview";

// ============================================
// Types
// ============================================

export interface TopicContext {
  /** 当前活跃话题 */
  currentTopic: string;
  currentTopicId: string;

  /** 话题历史（用于回退） */
  topicHistory: Array<{
    topic: string;
    topicId: string;
    switchedAt: string;
    factCount: number;
  }>;

  /** 共享事实池（跨话题复用） */
  sharedFacts: PendingFact[];

  /** 所有事实（按 topicId 隔离） */
  allFacts: PendingFact[];
}

// ============================================
// Shared Fact Recognition
// ============================================

/**
 * 共享维度定义
 * 这些维度在多个技术主题中都适用，应该标记为 isShared
 */
const SHARED_DIMENSION_PATTERNS = [
  // 设备/环境
  /^设备$/,
  /^环境$/,
  /^操作系统$/,
  /^电脑$/,
  /^开发环境$/,
  /^编辑器$/,
  /^IDE$/,

  // 时间/目标
  /^学习时间$/,
  /^可用时间$/,
  /^时间安排$/,
  /^目标$/,
  /^学习目标$/,
  /^最终目标$/,

  // 基础能力
  /^编程基础$/,
  /^技术背景$/,
  /^英文水平$/,
  /^学习能力$/,
];

/**
 * 判断一个维度是否是共享维度
 */
export function isSharedDimension(dimension: string): boolean {
  return SHARED_DIMENSION_PATTERNS.some((pattern) => pattern.test(dimension));
}

/**
 * 自动标记共享事实
 */
export function autoMarkSharedFacts(facts: PendingFact[]): PendingFact[] {
  return facts.map((fact) => ({
    ...fact,
    isShared: isSharedDimension(fact.dimension),
  }));
}

// ============================================
// Topic Context Manager
// ============================================

export class TopicContextManager {
  private context: TopicContext;

  constructor(initialContext?: Partial<TopicContext>) {
    this.context = {
      currentTopic: "",
      currentTopicId: "",
      topicHistory: [],
      sharedFacts: [],
      allFacts: [],
      ...initialContext,
    };
  }

  /**
   * 获取当前活跃话题的事实
   */
  getActiveFacts(): PendingFact[] {
    const currentTopicFacts = this.context.allFacts.filter(
      (f) => f.topicId === this.context.currentTopicId,
    );
    const sharedFacts = this.context.sharedFacts;

    // 合并：共享事实 + 当前话题事实
    return this.mergeFactsWithShared(currentTopicFacts, sharedFacts);
  }

  /**
   * 获取所有事实
   */
  getAllFacts(): PendingFact[] {
    return this.context.allFacts;
  }

  /**
   * 获取共享事实
   */
  getSharedFacts(): PendingFact[] {
    return this.context.sharedFacts;
  }

  /**
   * 更新事实
   */
  updateFacts(facts: PendingFact[]): void {
    // 自动识别并标记共享事实
    const markedFacts = autoMarkSharedFacts(facts);

    // 提取共享事实到共享池
    const newSharedFacts = markedFacts.filter((f) => f.isShared);
    this.context.sharedFacts = this.mergeFactsWithShared(
      this.context.sharedFacts,
      newSharedFacts,
    );

    // 更新所有事实
    this.context.allFacts = markedFacts;
  }

  /**
   * 切换话题
   * - 保留共享事实
   * - 记录历史
   */
  switchTopic(newTopic: string): void {
    const newTopicId = crypto.randomUUID();

    // 记录历史
    this.context.topicHistory.push({
      topic: this.context.currentTopic,
      topicId: this.context.currentTopicId,
      switchedAt: new Date().toISOString(),
      factCount: this.getActiveFacts().length,
    });

    // 切换到新话题
    this.context.currentTopic = newTopic;
    this.context.currentTopicId = newTopicId;

    // 新话题的初始事实 = 共享事实
    const newTopicFacts = this.context.sharedFacts.map((f) => ({
      ...f,
      topicId: newTopicId,
    }));

    this.context.allFacts = [...this.context.allFacts, ...newTopicFacts];
  }

  /**
   * 回退到历史话题
   */
  revertToTopic(topicId: string): boolean {
    const historyItem = this.context.topicHistory.find((h) => h.topicId === topicId);

    if (!historyItem) {
      return false;
    }

    // 记录当前话题到历史
    this.context.topicHistory.push({
      topic: this.context.currentTopic,
      topicId: this.context.currentTopicId,
      switchedAt: new Date().toISOString(),
      factCount: this.getActiveFacts().length,
    });

    // 切换回历史话题
    this.context.currentTopic = historyItem.topic;
    this.context.currentTopicId = historyItem.topicId;

    return true;
  }

  /**
   * 获取上下文快照
   */
  getSnapshot(): TopicContext {
    return { ...this.context };
  }

  /**
   * 从快照恢复
   */
  restoreFromSnapshot(snapshot: TopicContext): void {
    this.context = { ...snapshot };
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * 合并共享事实与话题事实
   * - 共享事实作为基础
   * - 话题事实覆盖同名维度
   */
  private mergeFactsWithShared(
    topicFacts: PendingFact[],
    sharedFacts: PendingFact[],
  ): PendingFact[] {
    const factMap = new Map<string, PendingFact>();

    // 先放共享事实
    for (const fact of sharedFacts) {
      factMap.set(fact.dimension, fact);
    }

    // 话题事实覆盖
    for (const fact of topicFacts) {
      factMap.set(fact.dimension, fact);
    }

    return Array.from(factMap.values());
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * 创建新的话题上下文
 */
export function createTopicContext(topic: string): TopicContextManager {
  return new TopicContextManager({
    currentTopic: topic,
    currentTopicId: crypto.randomUUID(),
    topicHistory: [],
    sharedFacts: [],
    allFacts: [],
  });
}

/**
 * 从现有数据恢复话题上下文
 */
export function restoreTopicContext(data: {
  currentTopic: string;
  currentTopicId: string;
  extractedFacts: PendingFact[];
}): TopicContextManager {
  const allFacts = data.extractedFacts ?? [];
  const sharedFacts = allFacts.filter((f) => f.isShared);

  return new TopicContextManager({
    currentTopic: data.currentTopic,
    currentTopicId: data.currentTopicId,
    topicHistory: [],
    sharedFacts,
    allFacts,
  });
}
