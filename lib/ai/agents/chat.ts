/**
 * Conversation Agent - 面向对话型 profile 的统一工厂
 */

import { stepCountIs, ToolLoopAgent } from "ai";
import { getCourseOutline } from "@/lib/cache/course-context";
import {
  formatGrowthGenerationContext,
  type GrowthGenerationContext,
} from "@/lib/growth/generation-context-format";
import {
  buildLearningAlignmentBrief,
  formatLearningAlignmentBrief,
} from "@/lib/learning/alignment";
import type { ResolvedChatMetadata } from "@/types/metadata";
import { isResolvedLearnMetadata } from "@/types/metadata";
import {
  type AITelemetryContext,
  buildPromptInstructions,
  getCapabilityProfile,
  getModelForPolicy,
  getToolCallingModelForPolicy,
  recordAIUsage,
} from "../core";
import type { AgentProfile } from "../core/capability-profiles";
import { buildToolsForProfile } from "../tools";

export interface PersonalizationOptions {
  behaviorPrompt?: string;
  skinPrompt?: string;
  userContext?: string;
  userId?: string;
  courseId?: string;
  generationContext?: GrowthGenerationContext;
  metadata?: ResolvedChatMetadata;
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
    (options.courseId && isResolvedLearnMetadata(options.metadata) ? "LEARN_ASSIST" : "CHAT_BASIC");
  const profile = getCapabilityProfile(profileId);

  if (profile.authRequired && !options.userId) {
    throw new Error(`${profileId} requires authenticated user`);
  }
  if (profile.resourceRequired && !options.courseId) {
    throw new Error(`${profileId} requires resourceId`);
  }

  const userContextParts = options.userContext ? [options.userContext] : [];

  // 学习页面：轻量 outline hint（标题+小节列表），不加载内容
  if (
    profileId === "LEARN_ASSIST" &&
    options.courseId &&
    isResolvedLearnMetadata(options.metadata)
  ) {
    const chapterTitle =
      options.metadata.chapterTitle?.trim() || `第 ${options.metadata.chapterIndex + 1} 章`;
    const outline = await getCourseOutline(options.courseId);
    const chapter = outline?.chapters[options.metadata.chapterIndex];
    const chapterSkillNames = (options.metadata.chapterSkillIds ?? []).join("、");
    const courseSkillNames = (options.metadata.courseSkillIds ?? []).join("、");
    const sectionTitles =
      chapter?.sections.map((section) => section.title) ?? options.metadata.sectionTitles ?? [];
    const hint = [
      "## 当前学习上下文",
      `课程：${options.metadata.courseTitle}`,
      `当前章节：第 ${options.metadata.chapterIndex + 1} 章 - ${chapter?.title || chapterTitle}`,
      options.metadata.chapterDescription ? `章节描述：${options.metadata.chapterDescription}` : "",
      chapterSkillNames ? `本章能力目标：${chapterSkillNames}` : "",
      courseSkillNames ? `课程核心能力：${courseSkillNames}` : "",
      sectionTitles.length > 0 ? `小节：${sectionTitles.join("、")}` : "",
      "提示：使用 loadLearnContext 工具获取章节详细内容后再回答问题。",
    ]
      .filter(Boolean)
      .join("\n");

    userContextParts.push(hint);

    if (options.generationContext) {
      const alignmentBrief = buildLearningAlignmentBrief({
        chapterTitle,
        chapterDescription: options.metadata.chapterDescription,
        chapterSkillIds: options.metadata.chapterSkillIds,
        courseSkillIds: options.metadata.courseSkillIds,
        generationContext: options.generationContext,
      });

      userContextParts.push(
        ["## 当前学习对齐简报", formatLearningAlignmentBrief(alignmentBrief, "prompt")].join("\n"),
      );
    }
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
