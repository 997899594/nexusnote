/**
 * Dynamic Tool Builder
 *
 * 动态构建工具描述和参数
 * - 注入已有维度到 description（解决维度膨胀）
 * - 注入蓝图维度到 description（Blueprint-Aware Extraction）
 * - 让 LLM 自动对齐
 */

import { tool } from "ai";
import { z } from "zod";
import type { TopicBlueprint, PendingFact, CommitAndEvaluateResult } from "@/types/interview";
import type { FactMergeOptions } from "./fact-manager";
import { mergeFacts, getCoveredDimensions } from "./fact-manager";

// ============================================
// Schema Definitions
// ============================================

const FactSchema = z.object({
  dimension: z.string().describe("维度名称"),
  value: z.union([z.string(), z.number(), z.boolean()]),
  type: z.enum(["string", "number", "boolean"]),
  confidence: z.number().min(0).max(1).describe("提取置信度"),
  // 【修复漏洞二】让 LLM 判断是否是全局跨学科属性
  isGlobalContext: z
    .boolean()
    .describe(
      "该事实是否具有全局通用性？(如: 操作系统、设备、时间预算 → true。具体技术经验 → false)",
    ),
});

const TopicDriftSchema = z.object({
  isChanged: z.boolean().describe("用户是否改变了想学的主题？"),
  newTopic: z.string().optional().describe("如果改变了，新主题是什么？"),
});

const CommitAndEvaluateSchema = z.object({
  facts: z.array(FactSchema).describe("本次对话提取到的事实"),
  topicDrift: TopicDriftSchema.describe("话题漂移检测"),
});

// ============================================
// Description Builder
// ============================================

/**
 * 构建动态工具描述
 *
 * 核心思想：在源头约束，而非事后清洗
 * LLM 极其擅长阅读理解，告诉它已有维度，它会自动对齐
 */
function buildToolDescription(params: {
  existingDimensions: string[];
  blueprintDimensions: string[];
  blueprintStatus: "pending" | "ready" | "failed";
}): string {
  const { existingDimensions, blueprintDimensions, blueprintStatus } = params;

  const parts: string[] = [
    "从用户的最新回复中提取事实并评估信息饱和度。",
    "",
    "## 核心规则",
    "",
  ];

  // 规则 1：已有维度对齐
  if (existingDimensions.length > 0) {
    parts.push(
      `⚠️ **维度对齐（极端重要）**`,
      `当前对话中已存在以下维度：`,
      `【${existingDimensions.join("、")}】`,
      "",
      `如果用户的新信息属于上述已有维度，你必须【严格使用完全一致的维度名称】。`,
      `例如：已有"编程基础"时，用户说"我写过 Python"，应提取为 dimension: "编程基础" 而非 "Python经验"。`,
      "",
    );
  }

  // 规则 2：蓝图维度优先
  if (blueprintStatus === "ready" && blueprintDimensions.length > 0) {
    parts.push(
      `📋 **蓝图维度优先**`,
      `系统已定义该主题的核心评估维度：`,
      `【${blueprintDimensions.join("、")}】`,
      "",
      `你必须优先将用户信息归类到上述标准维度中。`,
      `只有当信息极其特殊且重要，且无法归入任何标准维度时，才允许自创维度。`,
      "",
    );
  }

  // 规则 3：蓝图待生成
  if (blueprintStatus === "pending") {
    parts.push(
      `⏳ **蓝图生成中**`,
      `系统正在分析该主题，暂时无法提供维度建议。`,
      `请自由提取用户提到的关键信息。`,
      "",
    );
  }

  // 规则 4：话题漂移
  parts.push(
    `🔄 **话题漂移**`,
    `如果用户明确表示想学习其他主题，将 topicDrift.isChanged 设为 true。`,
    `**重要**：即使话题漂移，仍需提取用户同时提供的新事实！`,
  );

  return parts.join("\n");
}

// ============================================
// Tool Factory
// ============================================

export interface DynamicToolContext {
  sessionId: string;
  currentTopic: string;
  currentTopicId: string;
  existingFacts: PendingFact[];
  blueprint: TopicBlueprint | null;
  onFactsUpdate: (facts: PendingFact[]) => Promise<string | void>; // 返回新的 topicId（漂移时）
  onTopicChange: (newTopic: string) => Promise<string>; // 返回新的 topicId
  mergeOptions?: FactMergeOptions;
}

/**
 * 创建动态注入上下文的 commitAndEvaluate 工具
 */
export function createDynamicCommitAndEvaluateTool(ctx: DynamicToolContext) {
  // 提取维度列表
  const existingDimensions = getCoveredDimensions(ctx.existingFacts);
  const blueprintDimensions = ctx.blueprint?.coreDimensions.map((d) => d.name) ?? [];
  const blueprintStatus = ctx.blueprint?.status ?? "pending";

  // 动态构建描述
  const description = buildToolDescription({
    existingDimensions,
    blueprintDimensions,
    blueprintStatus,
  });

  return {
    commitAndEvaluate: tool({
      description,
      inputSchema: CommitAndEvaluateSchema,
      execute: async (args: z.infer<typeof CommitAndEvaluateSchema>): Promise<CommitAndEvaluateResult> => {
        const { facts, topicDrift } = args;

        try {
          // ============================================
          // 【修复漏洞一】动态确定当前使用的 Topic ID
          // 不要在漂移时直接 return，先获取新 topicId 继续处理
          // ============================================
          let activeTopicId = ctx.currentTopicId;
          let activeTopic = ctx.currentTopic;
          let baseFacts = ctx.existingFacts;
          let isDrifting = false;

          if (topicDrift.isChanged && topicDrift.newTopic) {
            isDrifting = true;
            activeTopic = topicDrift.newTopic;
            // 获取新的 topicId
            activeTopicId = await ctx.onTopicChange(topicDrift.newTopic);

            // 保留共享事实
            const sharedFacts = ctx.existingFacts
              .filter((f) => f.isShared)
              .map((f) => ({
                ...f,
                topicId: activeTopicId,
                extractedAt: new Date().toISOString(),
              }));
            baseFacts = sharedFacts;
          }

          // ============================================
          // 【修复漏洞二】转换 Facts，使用 LLM 判定的 isGlobalContext
          // ============================================
          const newFacts: PendingFact[] = facts.map((f) => ({
            dimension: f.dimension,
            value: f.value,
            type: f.type,
            confidence: f.confidence,
            extractedAt: new Date().toISOString(),
            topicId: activeTopicId, // 可能是旧的，也可能是漂移后全新的
            isShared: f.isGlobalContext, // 使用 LLM 判断的全局属性
          }));

          // 合并事实（Upsert 语义）
          const mergedFacts = mergeFacts(baseFacts, newFacts, {
            strategy: "higher-confidence",
          });

          // 更新存储
          await ctx.onFactsUpdate(mergedFacts);

          // ============================================
          // 如果发生漂移，直接返回引导语（蓝图还未就绪）
          // ============================================
          if (isDrifting) {
            return {
              success: true,
              currentSaturation: 0,
              isReadyForOutline: false,
              isBlueprintPending: true,
              suggestedNextQuestions: [
                `好的，让我们转向【${activeTopic}】。关于这个新领域，您目前掌握到什么程度了？`,
              ],
              matchedDimensions: getCoveredDimensions(mergedFacts),
              missingDimensions: [],
            };
          }

          // ============================================
          // 真实的加权饱和度计算
          // ============================================
          let saturationScore = 0;
          const matchedDimensions: string[] = [];
          const missingDimensions: string[] = [];
          const missingSuggestions: string[] = [];

          if (ctx.blueprint?.status === "ready" && ctx.blueprint.coreDimensions) {
            for (const dim of ctx.blueprint.coreDimensions) {
              const isMatched = mergedFacts.some((f) => f.dimension === dim.name);
              if (isMatched) {
                saturationScore += dim.weight; // 例如 +30 分
                matchedDimensions.push(dim.name);
              } else {
                missingDimensions.push(dim.name);
                if (dim.suggestion) {
                  missingSuggestions.push(dim.suggestion);
                }
              }
            }
          }

          // 归一化限制最高 100
          saturationScore = Math.min(100, Math.round(saturationScore));

          return {
            success: true,
            currentSaturation: saturationScore,
            isReadyForOutline: saturationScore >= 80, // 80 分万岁
            isBlueprintPending: blueprintStatus === "pending",
            // 如果饱和了就不用建议了，否则优先问权重最高的缺失维度
            suggestedNextQuestions: saturationScore >= 80 ? [] : missingSuggestions.slice(0, 2),
            matchedDimensions,
            missingDimensions,
          };
        } catch (error) {
          console.error("[commitAndEvaluate] Error:", error);
          return {
            success: false,
            currentSaturation: 0,
            isReadyForOutline: false,
            isBlueprintPending: false,
            suggestedNextQuestions: [],
            matchedDimensions: [],
            missingDimensions: [],
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    }),
  };
}
