import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "@/lib/ai/core/tool-context";
import { InterviewNextFocusSchema, InterviewOutlineSchema } from "@/lib/ai/interview/schemas";

export const PresentOptionsInputSchema = z.object({
  question: z.string().min(1).max(120),
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
  targetField: InterviewNextFocusSchema,
});

export interface PresentOptionsOutput {
  status: "presented";
}

export const PresentOutlineActionOptionSchema = z.object({
  label: z.string().min(1).max(80),
  action: z.string().min(1).max(160).optional(),
  intent: z.enum(["revise", "start_course"]),
});

export const PresentOutlinePreviewInputSchema = z.object({
  message: z.string().min(1).max(240),
  options: z.array(PresentOutlineActionOptionSchema).min(2).max(4),
  outline: InterviewOutlineSchema,
});

export interface PresentOutlinePreviewOutput {
  status: "presented";
}

export const createInterviewTools = (_ctx: ToolContext) => {
  return {
    presentOptions: tool({
      description:
        "向用户展示本轮回复的可点击快捷选项。用于继续澄清课程需求时的访谈回合；如果要给用户 2-4 个候选方向或快捷回答，应使用本工具，不要写成正文列表。普通对话或助手说明不需要调用。",
      inputSchema: PresentOptionsInputSchema,
      execute: async (): Promise<PresentOptionsOutput> => ({
        status: "presented",
      }),
    }),
    presentOutlinePreview: tool({
      description:
        "向用户展示可确认、可保存的课程蓝图。用于信息已足够、用户要求生成课程蓝图，或用户要求修改现有大纲时返回最终会保存的课程元信息、章节树和后续动作选项。必须同时提供 2-4 个 options；每个 option 必须包含 label 和 intent，其中至少一个 intent=start_course，修改类 intent=revise 且 action 说明具体修改请求。",
      inputSchema: PresentOutlinePreviewInputSchema,
      execute: async (): Promise<PresentOutlinePreviewOutput> => ({
        status: "presented",
      }),
    }),
  };
};
