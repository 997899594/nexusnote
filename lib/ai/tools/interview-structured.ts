import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "@/lib/ai/core/tool-context";
import type { InterviewNextFocusSchema, InterviewOutlineSchema } from "@/lib/ai/interview";
import {
  type PresentOptionsOutput,
  PresentOutlinePreviewInputSchema,
  type PresentOutlinePreviewOutput,
} from "@/lib/ai/tools/interview";

const StructuredPresentOptionsBaseInputSchema = z.object({
  question: z.string().min(1).max(120),
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
});

interface CreateStructuredInterviewToolsOptions {
  forcedQuestionTargetField?: z.infer<typeof InterviewNextFocusSchema>;
  validateOutline?: (outline: z.infer<typeof InterviewOutlineSchema>) =>
    | {
        valid: true;
      }
    | {
        valid: false;
        reason: string;
      };
}

export const createStructuredInterviewTools = (
  _ctx: ToolContext,
  options?: CreateStructuredInterviewToolsOptions,
) => {
  const forcedQuestionTargetField = options?.forcedQuestionTargetField ?? "constraints";
  const questionInputSchema = StructuredPresentOptionsBaseInputSchema.transform((input) => ({
    ...input,
    targetField: forcedQuestionTargetField,
  }));
  const outlineInputSchema = options?.validateOutline
    ? PresentOutlinePreviewInputSchema.superRefine((input, ctx) => {
        const validation = options.validateOutline?.(input.outline);
        if (!validation || validation.valid) {
          return;
        }

        ctx.addIssue({
          code: "custom",
          message: validation.reason,
          path: ["outline"],
        });
      })
    : PresentOutlinePreviewInputSchema;

  return {
    presentOptions: tool({
      description:
        "向用户展示本轮回复的可点击快捷选项。用于继续澄清需求时的普通访谈回合。每轮都应调用一个展示类工具。",
      inputSchema: questionInputSchema,
      execute: async (): Promise<PresentOptionsOutput> => ({
        status: "presented",
      }),
    }),
    presentOutlinePreview: tool({
      description:
        "向用户展示课程草案预览。用于信息已足够时返回完整大纲和后续动作选项，例如继续修改或开始生成课程。",
      inputSchema: outlineInputSchema,
      execute: async (): Promise<PresentOutlinePreviewOutput> => ({
        status: "presented",
      }),
    }),
  };
};
