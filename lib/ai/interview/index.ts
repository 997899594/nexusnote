/**
 * Interview Module Index
 *
 * 动态访谈系统核心架构
 */

// 事实管理
export {
  mergeFacts,
  deduplicateFacts,
  filterFactsByTopic,
  splitFactsOnTopicChange,
  getCoveredDimensions,
  getMissingDimensions,
  calculateDimensionCoverage,
  type FactMergeOptions,
} from "./fact-manager";

// 动态工具构建
export {
  createDynamicCommitAndEvaluateTool,
  type DynamicToolContext,
} from "./tool-builder";

// 话题上下文
export {
  TopicContextManager,
  createTopicContext,
  restoreTopicContext,
  isSharedDimension,
  autoMarkSharedFacts,
  type TopicContext,
} from "./topic-context";
