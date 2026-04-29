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
        "向用户展示本轮回复的可点击快捷选项。用于继续澄清需求时的普通访谈回合。每轮都应调用一个展示类工具。",
      inputSchema: PresentOptionsInputSchema,
      execute: async (): Promise<PresentOptionsOutput> => ({
        status: "presented",
      }),
    }),
    presentOutlinePreview: tool({
      description:
        "向用户展示可确认的课程骨架大纲。用于信息已足够时返回轻量章节树和后续动作选项，例如继续修改或开始生成课程。",
      inputSchema: PresentOutlinePreviewInputSchema,
      execute: async (): Promise<PresentOutlinePreviewOutput> => ({
        status: "presented",
      }),
    }),
  };
};
