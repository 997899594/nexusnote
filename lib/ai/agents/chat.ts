/**
 * Conversation Agent - 面向对话型 profile 的统一工厂
 */

import { stepCountIs, ToolLoopAgent } from "ai";
import {
  formatGrowthGenerationContext,
  type GrowthGenerationContext,
} from "@/lib/growth/generation-context-format";
import {
  formatLearningGuidancePromptContext,
  getLearningGuidance,
  type LearningGuidance,
} from "@/lib/learning/guidance";
import { type ChatMetadata, isLearnMetadata } from "@/types/metadata";
import { type AgentProfile, getCapabilityProfile } from "../core/capability-profiles";
import { getModelForPolicy, getToolCallingModelForPolicy } from "../core/model-policy";
import { buildPromptInstructions } from "../core/prompt-registry";
import { type AITelemetryContext, recordAIUsage } from "../core/telemetry";
import { buildToolsForProfile } from "../tools";

export interface PersonalizationOptions {
  behaviorPrompt?: string;
  skinPrompt?: string;
  userContext?: string;
  userId?: string;
  courseId?: string;
  generationContext?: GrowthGenerationContext;
  learningGuidance?: LearningGuidance | null;
  metadata?: ChatMetadata;
  profile?: Extract<AgentProfile, "CHAT_BASIC" | "LEARN_ASSIST" | "NOTE_ASSIST">;
  telemetry?: AITelemetryContext;
}

/**
 * 创建对话型 Agent
 *
 * 学习页面：只注入轻量 outline hint（~200 字符），
 * 详细内容由 agent 按需调用 loadLearnContext 工具获取。
 */
export async function createChatAgent(options: PersonalizationOptions = {}) {
  const startedAt = Date.now();
  const profileId =
    options.profile ??
    (options.courseId && isLearnMetadata(options.metadata) ? "LEARN_ASSIST" : "CHAT_BASIC");
  const profile = getCapabilityProfile(profileId);

  if (profile.authRequired && !options.userId) {
    throw new Error(`${profileId} requires authenticated user`);
  }
  if (profile.resourceRequired && !options.courseId) {
    throw new Error(`${profileId} requires resourceId`);
  }

  const userContextParts = options.userContext ? [options.userContext] : [];

  // 学习页面：只注入统一 guidance 契约产出的轻量上下文，不再在这里重复拼 learn 语义。
  if (profileId === "LEARN_ASSIST" && options.courseId && isLearnMetadata(options.metadata)) {
    const learningGuidance =
      options.learningGuidance ??
      (options.userId
        ? await getLearningGuidance({
            userId: options.userId,
            courseId: options.courseId,
            chapterIndex: options.metadata.chapterIndex,
          })
        : null);

    if (!learningGuidance) {
      throw new Error("LEARN_ASSIST requires learning guidance");
    }

    userContextParts.push(formatLearningGuidancePromptContext(learningGuidance));
  }

  if (options.generationContext && profileId !== "LEARN_ASSIST") {
    userContextParts.push(
      [
        "## 当前成长上下文",
        formatGrowthGenerationContext(options.generationContext, {
          style: "detailed",
        }),
      ].join("\n"),
    );
  }

  const instructions = buildPromptInstructions(profile.promptKey, {
    behaviorPrompt: options.behaviorPrompt,
    skinPrompt: options.skinPrompt,
    userContext: userContextParts.length > 0 ? userContextParts.join("\n\n") : undefined,
  });
  const tools = buildToolsForProfile(profileId, {
    userId: options.userId,
    resourceId: options.courseId,
  });
  const model =
    profileId === "LEARN_ASSIST"
      ? getToolCallingModelForPolicy(profile.modelPolicy)
      : getModelForPolicy(profile.modelPolicy);

  return new ToolLoopAgent({
    id: `nexusnote-${profileId.toLowerCase()}`,
    model,
    instructions,
    tools,
    stopWhen: stepCountIs(profile.maxSteps),
    onFinish: async ({ totalUsage, steps, finishReason }) => {
      if (!options.telemetry) {
        return;
      }

      const toolNames = Array.from(
        new Set(
          steps.flatMap((step) =>
            (step.toolCalls ?? []).map((toolCall) => String(toolCall.toolName)),
          ),
        ),
      );

      await recordAIUsage({
        ...options.telemetry,
        usage: totalUsage,
        durationMs: Date.now() - startedAt,
        success: true,
        metadata: {
          ...options.telemetry.metadata,
          finishReason,
          stepCount: steps.length,
          toolNames,
        },
      });
    },
  });
}
