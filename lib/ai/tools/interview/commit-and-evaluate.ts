/**
 * commitAndEvaluate Tool
 *
 * 动态访谈系统核心工具
 * - 提取事实（EAV 模式）
 * - 本地评估饱和度
 * - 检测话题漂移
 * - 动态上下文注入
 *
 * 【架构原则】使用依赖注入模式，DB 操作通过回调传入
 */

import { tool } from "ai";
import { z } from "zod";
import { getCoveredDimensions, mergeFacts } from "@/lib/ai/interview";
import type { CommitAndEvaluateResult, PendingFact, TopicBlueprint } from "@/types/interview";

// ============================================
// Tool Schema
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
  facts: z.array(FactSchema).describe("从用户消息中提取的事实"),
  topicDrift: TopicDriftSchema.describe("话题漂移检测"),
});

// ============================================
// Dynamic Description Builder
// ============================================

/**
 * 构建动态工具描述
 * 注入已有维度和蓝图维度，引导 LLM 对齐
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

  // 规则 2：蓝图维度优先（对 Agent 隐藏"蓝图"术语）
  if (blueprintStatus === "ready" && blueprintDimensions.length > 0) {
    parts.push(
      `📋 **核心评估维度**`,
      `系统已定义该主题的核心评估维度：`,
      `【${blueprintDimensions.join("、")}】`,
      "",
      `你必须优先将用户信息归类到上述标准维度中。`,
      `只有当信息极其特殊且重要，且无法归入任何标准维度时，才允许自创维度。`,
      "",
    );
  }

  // 规则 3：蓝图待生成（对 Agent 隐藏内部术语）
  if (blueprintStatus === "pending") {
    parts.push(
      `⏳ **系统分析中**`,
      `正在后台分析该主题的知识图谱，暂时无法提供维度建议。`,
      `请自由提取用户提到的关键信息。`,
      "",
    );
  }

  // 规则 4：话题漂移
  parts.push(
    `🔄 **话题漂移**`,
    `如果用户明确表示想学习其他主题，将 topicDrift.isChanged 设为 true。`,
    `**【极端重要】即使发生话题漂移，你也必须在 facts 数组中提取用户当前回复里附带的所有新事实信息！绝对不能留空！**`,
  );

  return parts.join("\n");
}

// ============================================
// Tool Factory (依赖注入模式)
// ============================================

export interface InterviewToolsInput {
  sessionId: string;
  currentTopic: string;
  currentTopicId: string;
  existingFacts?: PendingFact[];
  blueprint: TopicBlueprint | null;
  blueprintStatus?: "pending" | "ready" | "failed";

  // 依赖注入：DB 操作回调（保证 Agent 层的纯函数特性）
  onFactsUpdate: (facts: PendingFact[]) => Promise<void>;
  onTopicChange: (newTopic: string) => Promise<string>; // 返回新的 topicId
}

export function createInterviewTools(params: InterviewToolsInput) {
  const {
    sessionId,
    currentTopic,
    currentTopicId,
    existingFacts = [],
    blueprint,
    blueprintStatus = "pending",
    onFactsUpdate,
    onTopicChange,
  } = params;

  // 构建动态描述
  const existingDimensions = getCoveredDimensions(existingFacts);
  const blueprintDimensions = blueprint?.coreDimensions.map((d) => d.name) ?? [];
  const currentBlueprintStatus = blueprint?.status ?? blueprintStatus;

  // 构建动态描述
  const description = buildToolDescription({
    existingDimensions,
    blueprintDimensions,
    blueprintStatus: currentBlueprintStatus,
  });

  return {
    commitAndEvaluate: tool({
      description,
      inputSchema: CommitAndEvaluateSchema,
      execute: async (
        args: z.infer<typeof CommitAndEvaluateSchema>,
      ): Promise<CommitAndEvaluateResult> => {
        const { facts, topicDrift } = args;

        try {
          // ============================================
          // 【修复漏洞一】动态确定当前使用的 Topic ID
          // 不要在漂移时直接 return，先获取新 topicId 继续处理
          // ============================================
          let activeTopic = currentTopic;
          let activeTopicId = currentTopicId;
          let baseFacts = existingFacts;
          let isDrifting = false;

          if (topicDrift.isChanged && topicDrift.newTopic) {
            isDrifting = true;
            activeTopic = topicDrift.newTopic;

            // 【依赖注入】通过回调获取新的 topicId
            activeTopicId = await onTopicChange(activeTopic);

            console.log("[commitAndEvaluate] Topic drift:", currentTopic, "->", activeTopic);

            // 保留共享事实
            const sharedFacts = existingFacts
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

          // 【依赖注入】通过回调保存事实
          await onFactsUpdate(mergedFacts);

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
          // 蓝图未就绪（pending 或不存在）
          // ============================================
          if (currentBlueprintStatus !== "ready" || !blueprint?.coreDimensions) {
            return {
              success: true,
              currentSaturation: 0,
              isReadyForOutline: false,
              isBlueprintPending: currentBlueprintStatus === "pending",
              // 【优化】不暴露"蓝图"等内部术语，引导 Agent 用通用问题填补冷启动延迟
              suggestedNextQuestions:
                currentBlueprintStatus === "pending"
                  ? [
                      "您可以问问用户：为什么突然想学这个？是为了工作还是纯兴趣？",
                      "您可以问问用户：在这个领域里，有没有什么特别想做出的成品？",
                    ]
                  : [
                      "您可以问问用户：您希望通过学习达到什么具体目标？",
                      "您可以问问用户：您目前对这个主题有哪些了解？",
                    ],
              matchedDimensions: getCoveredDimensions(mergedFacts),
              missingDimensions: blueprintDimensions.filter(
                (d) => !getCoveredDimensions(mergedFacts).includes(d),
              ),
            };
          }

          // ============================================
          // 系统就绪 - 完整评估（真实的加权饱和度计算）
          // ============================================
          let saturationScore = 0;
          const matchedDimensions: string[] = [];
          const missingDimensions: string[] = [];
          const missingSuggestions: string[] = [];

          for (const dim of blueprint.coreDimensions) {
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

          // 归一化限制最高 100
          saturationScore = Math.min(100, Math.round(saturationScore));

          return {
            success: true,
            currentSaturation: saturationScore,
            isReadyForOutline: saturationScore >= 80, // 80 分万岁
            isBlueprintPending: false,
            // 如果饱和了就不用建议了，否则优先问权重最高的缺失维度
            suggestedNextQuestions:
              saturationScore >= 80 ? [] : missingSuggestions.slice(0, 2),
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
