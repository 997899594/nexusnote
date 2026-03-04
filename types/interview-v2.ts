/**
 * 动态访谈系统类型定义
 *
 * 基于信息熵的连续状态评估架构
 * 包含三个生产级补丁：冷启动竞态、蓝图感知提取、Topic Drift 软删除
 */

/**
 * 提取的事实 (EAV 模型 + 补丁)
 */
export interface ExtractedFact {
  dimension: string;                    // 维度名，如 "编程基础"、"学习目标"
  value: string | number | boolean;     // 值
  type: 'string' | 'number' | 'boolean';
  confidence: number;                   // 置信度 (0-1)
  extractedAt: string;                  // ISO 时间戳

  // 补丁 3：归属主题（软删除支持）
  topicId: string;

  // 补丁 3：全局共享标记（如设备、操作系统在所有主题都适用）
  isShared: boolean;
}

/**
 * 评分蓝图维度
 */
export interface BlueprintDimension {
  name: string;                         // 维度名
  keywords: string[];                   // 匹配关键词（备用）
  weight: number;                       // 权重 (0-100)
  suggestion: string;                   // 建议提问
}

/**
 * 主题评分蓝图
 */
export interface TopicBlueprint {
  id: string;
  topic: string;
  topicHash: string;                    // topic 的 hash，用于快速匹配
  coreDimensions: BlueprintDimension[];
  generatedAt: string;
  modelUsed: string;
}

/**
 * 蓝图状态（补丁 1：冷启动竞态处理）
 */
export interface BlueprintState {
  topicHash: string;
  status: 'pending' | 'ready' | 'failed';
  pendingFacts: ExtractedFact[];        // 冷启动期暂存的事实
  blueprint?: TopicBlueprint;
}

/**
 * 动态课程状态
 */
export interface DynamicCourseProfile {
  currentTopic: string;
  currentTopicId: string;               // 补丁 3：当前主题 ID

  // EAV 事实集合
  extractedFacts: ExtractedFact[];

  // 信息饱和度 (0-100)
  saturationScore: number;

  // 系统建议的下一步提问方向
  nextHighValueDimensions: string[];

  // 蓝图 ID
  blueprintId?: string;

  // 补丁 1：蓝图状态
  blueprintStatus: 'pending' | 'ready' | 'failed';
}

/**
 * 评估结果
 */
export interface SaturationEvaluation {
  score: number;                        // 0-100
  isSaturated: boolean;                 // score >= 80
  isBlueprintPending: boolean;          // 补丁 1：蓝图是否还在生成中
  nextQuestions: string[];              // 建议提问列表
  matchedDimensions: string[];          // 已匹配的维度
  missingDimensions: string[];          // 缺失的维度
}

/**
 * 话题漂移检测
 */
export interface TopicDrift {
  isChanged: boolean;
  newTopic?: string;
}

/**
 * 工具返回结果
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
 * 生成大纲结果
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
