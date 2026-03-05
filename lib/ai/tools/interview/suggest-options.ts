/**
 * suggestOptions Tool
 *
 * 让 AI Agent 主动向用户展示可点击的选项按钮
 * - Agent 根据对话情况，决定何时展示选项
 * - 选项内容应该是用户可以直接选择的答案
 */

import { tool } from "ai";
import { z } from "zod";

// ============================================
// Tool Schema
// ============================================

const SuggestOptionsSchema = z.object({
  options: z
    .array(z.string())
    .min(1)
    .max(4)
    .describe("展示给用户的可点击选项（1-4个）"),
  prompt: z
    .string()
    .optional()
    .describe("选项前的引导语（可选）"),
});

// ============================================
// Tool Factory
// ============================================

export function createSuggestOptionsTool() {
  return {
    suggestOptions: tool({
      description:
        "向用户展示可点击的选项按钮。用于引导用户快速选择答案，减少输入。选项应该是用户可能的真实回答，而不是问题描述。",
      inputSchema: SuggestOptionsSchema,
      execute: async (
        args: z.infer<typeof SuggestOptionsSchema>,
      ): Promise<{
        success: boolean;
        options: string[];
        prompt?: string;
      }> => {
        const { options, prompt } = args;

        // 只是返回选项，前端会渲染成按钮
        return {
          success: true,
          options,
          prompt,
        };
      },
    }),
  };
}
