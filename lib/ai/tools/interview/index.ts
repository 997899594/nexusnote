/**
 * Interview Tools - 仅 confirmOutline
 */

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";
import type { ToolContext } from "@/lib/ai/core/tool-context";

// ============================================
// Schemas
// ============================================

export const ConfirmOutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedMinutes: z.number(),
  modules: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        chapters: z.array(z.string()),
      }),
    )
    .min(1),
});

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
      description: "生成并保存课程大纲，访谈结束时调用",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline) => {
        // 权限验证：确保课程属于当前用户
        const course = await db.query.courseSessions.findFirst({
          where: eq(courseSessions.id, courseId),
        });

        if (!course) {
          return { success: false, error: "课程不存在" };
        }

        if (course.userId !== ctx.userId) {
          return { success: false, error: "无权修改此课程" };
        }

        // 保存大纲
        const chapters = outline.modules.map((m, i) => ({
          title: m.title,
          description: m.description,
          topics: m.chapters,
          order: i,
        }));

        await db
          .update(courseSessions)
          .set({
            title: outline.title,
            description: outline.description,
            difficulty: outline.difficulty,
            estimatedMinutes: outline.estimatedMinutes,
            outlineData: { title: outline.title, chapters },
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
