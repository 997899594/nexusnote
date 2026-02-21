import { hasToolCall, type InferAgentUIMessage, stepCountIs, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { buildInterviewPrompt } from "@/features/shared/ai/prompts/interview";
import { registry } from "@/features/shared/ai/registry";
import { getProfile, mergeProfile } from "../services/interview-session";
import { ProposeOutlineSchema, SuggestOptionsSchema, UpdateProfileInputSchema } from "../types";

/**
 * Interview Agent 调用选项
 */
export const InterviewCallOptionsSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
});

export type InterviewCallOptions = z.infer<typeof InterviewCallOptionsSchema>;

// ─── Agent 工厂（需要 sessionId 来做 DB 操作）───

export function createInterviewAgent(sessionId: string) {
  const model = registry.chatModel;
  if (!model) {
    throw new Error("chatModel not available. Check AI configuration.");
  }

  return new ToolLoopAgent({
    id: "nexusnote-interview-v2",
    model,
    callOptionsSchema: InterviewCallOptionsSchema,

    // 不写静态 instructions — 由 prepareStep 动态注入
    instructions: "",

    tools: {
      // ─── 工具 1: 更新画像 (Server-side, 每轮必调) ───
      updateProfile: tool({
        description: `更新学习者画像。每轮对话后必须调用。
          只更新本轮获得的新信息字段，其他留 null。
          readiness 是你对"信息是否足够设计好课程"的评估（0-100）。
          missingInfo 列出你认为还需要了解的内容（空数组=信息充足）。`,
        inputSchema: UpdateProfileInputSchema,
        execute: async ({ updates }) => {
          const merged = await mergeProfile(sessionId, updates);
          return {
            saved: true,
            currentReadiness: merged.readiness,
          };
        },
      }),

      // ─── 工具 2: 快捷选项 (Server-side, 每轮必调) ───
      suggestOptions: tool({
        description: `每轮回复后必须调用（除非调用 proposeOutline）。
          根据当前话题动态生成 2-5 个选项。
          选项要贴合语境和用户情况，不要模板化。
          用户可以点击选项，也可以忽略直接打字。`,
        inputSchema: SuggestOptionsSchema,
        execute: async ({ options }) => {
          return {
            options,
            waitingForUser: true,
          };
        },
      }),

      // ─── 工具 3: 提议大纲 (Server-side, 终止信号) ───
      proposeOutline: tool({
        description: `当 readiness >= 80 时调用，替代 suggestOptions。
          调用前必须先用自然语言总结你对用户需求的理解。
          summary 是对用户需求的一段话总结。
          suggestedTitle 是你建议的课程标题。`,
        inputSchema: ProposeOutlineSchema,
        execute: async ({ summary, suggestedTitle }) => {
          return {
            summary,
            suggestedTitle,
            readyForConfirmation: true,
          };
        },
      }),
    },

    // ─── 停止条件 ───
    stopWhen: [hasToolCall("suggestOptions"), hasToolCall("proposeOutline"), stepCountIs(15)],

    // ─── 每步准备：从 DB 加载最新 profile，动态重建系统 prompt ───
    prepareStep: async () => {
      const profile = await getProfile(sessionId);
      return {
        system: buildInterviewPrompt(profile),
      };
    },
  });
}

/**
 * 导出类型（用于前端 useChat 泛型）
 */
type InterviewAgent = ReturnType<typeof createInterviewAgent>;
export type InterviewAgentMessage = InferAgentUIMessage<InterviewAgent>;
