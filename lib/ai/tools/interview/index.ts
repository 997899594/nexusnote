// lib/ai/tools/interview/index.ts

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";
import type { ToolContext } from "@/lib/ai/core/tool-context";

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
        topics: z.array(z.string()).describe("知识点列表"),
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
  outline?: z.infer<typeof ConfirmOutlineSchema>;
  error?: string;
}

// ============================================
// Tool Factory
// ============================================

export const createInterviewTools = (ctx: ToolContext) => {
  const courseId = ctx.resourceId;

  if (!courseId) {
    throw new Error("Interview tools require resourceId (courseId)");
  }

  return {
    confirmOutline: tool({
      description:
        "生成或更新课程大纲。当你对用户需求了解充分时调用。用户提出修改建议时再次调用更新。",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline): Promise<ConfirmOutlineOutput> => {
        const course = await db.query.courseSessions.findFirst({
          where: eq(courseSessions.id, courseId),
        });

        if (!course) {
          return { success: false, error: "课程不存在" };
        }

        if (course.userId !== ctx.userId) {
          return { success: false, error: "无权修改此课程" };
        }

        await db
          .update(courseSessions)
          .set({
            title: outline.title,
            description: outline.description,
            difficulty: outline.difficulty,
            estimatedMinutes: Math.round(outline.estimatedHours * 60),
            outlineData: outline,
            interviewStatus: "completed",
            status: "outline_confirmed",
            updatedAt: new Date(),
          })
          .where(eq(courseSessions.id, courseId));

        return { success: true, outline };
      },
    }),
  };
};
