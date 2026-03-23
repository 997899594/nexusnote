// lib/ai/tools/interview/index.ts

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "@/lib/ai/core/tool-context";
import { saveCourseFromOutline } from "@/lib/learning/course-service";

// ============================================
// Schema
// ============================================

export const ConfirmOutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().describe("一句话课程描述"),
  targetAudience: z.string().describe("适合谁学"),
  prerequisites: z.array(z.string()).optional().describe("前置知识要求"),
  estimatedHours: z.number().describe("预计总学时（小时）"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("整体难度"),
  chapters: z
    .array(
      z.object({
        title: z.string().describe("章节标题"),
        description: z.string().describe("章节简介"),
        sections: z
          .array(
            z.object({
              title: z.string().describe("小节标题"),
              description: z.string().describe("小节知识点描述"),
            }),
          )
          .min(1)
          .describe("小节列表"),
        estimatedMinutes: z.number().optional().describe("预计学习时长（分钟）"),
        practiceType: z
          .enum(["exercise", "project", "quiz", "none"])
          .optional()
          .describe("实践类型"),
      }),
    )
    .min(1)
    .describe("章节列表"),
  learningOutcome: z.string().describe("学完能做什么"),
});

// ============================================
// Types
// ============================================

export interface ConfirmOutlineOutput {
  success: boolean;
  courseId?: string;
  outline?: z.infer<typeof ConfirmOutlineSchema>;
  error?: string;
}

// ============================================
// Tool Factory
// ============================================

export const createInterviewTools = (ctx: ToolContext) => {
  return {
    confirmOutline: tool({
      description:
        "生成或更新课程大纲。当你对用户需求了解充分时调用。用户提出修改建议时再次调用更新。",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline): Promise<ConfirmOutlineOutput> => {
        try {
          const result = await saveCourseFromOutline({
            userId: ctx.userId,
            courseId: ctx.resourceId,
            outline,
          });

          return {
            success: true,
            courseId: result.courseId,
            outline,
          };
        } catch (error) {
          console.error("[Interview] Failed to save outline:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "保存课程失败",
          };
        }
      },
    }),
  };
};
