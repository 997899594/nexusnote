/**
 * Conversation Agent - 面向对话型 profile 的统一工厂
 */

import { stepCountIs, ToolLoopAgent } from "ai";
import { getCourseOutline } from "@/lib/cache/course-context";
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
    const outline = await getCourseOutline(options.courseId);
    if (outline) {
      const chapter = outline.chapters[options.metadata.chapterIndex];
      const chapterTitle =
        options.metadata.chapterTitle?.trim() ||
        chapter?.title ||
        `第 ${options.metadata.chapterIndex + 1} 章`;
      const chapterSkillNames = (options.metadata.chapterSkillIds ?? []).join("、");
      const courseSkillNames = (options.metadata.courseSkillIds ?? []).join("、");
      const hint = [
        "## 当前学习上下文",
        `课程：${options.metadata.courseTitle}`,
        `当前章节：第 ${options.metadata.chapterIndex + 1} 章 - ${chapterTitle}`,
        chapterSkillNames ? `本章能力目标：${chapterSkillNames}` : "",
        courseSkillNames ? `课程核心能力：${courseSkillNames}` : "",
        chapter ? `小节：${chapter.sections.map((s) => s.title).join("、")}` : "",
        "提示：使用 loadLearnContext 工具获取章节详细内容后再回答问题。",
      ]
        .filter(Boolean)
        .join("\n");
      userContextParts.push(hint);
    }
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
