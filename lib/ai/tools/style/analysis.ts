/**
 * Style Analysis Tools - 风格分析工具
 */

import { tool } from "ai";
import { z } from "zod";

export const AnalyzeStyleToolSchema = z.object({
  conversationId: z.string().describe("对话 ID"),
  includeBigFive: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否分析 Big Five 人格特质"),
});

export type AnalyzeStyleToolInput = z.infer<typeof AnalyzeStyleToolSchema>;

export const analyzeStyleTool = tool({
  description: "分析用户对话风格，更新用户风格画像",
  inputSchema: AnalyzeStyleToolSchema,
  execute: async ({ conversationId, includeBigFive }) => {
    try {
      const response = await fetch("/api/style/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, includeBigFive }),
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze style: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        message: "风格分析完成",
        profile: data.profile,
      };
    } catch (error) {
      console.error("[Tool] analyzeStyle error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
