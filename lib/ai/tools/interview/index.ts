/**
 * Interview Tools - updateProfile + confirmOutline
 *
 * 简化版：2 个工具
 * - updateProfile: 更新访谈画像（3 个指标）
 * - confirmOutline: 生成/更新课程大纲
 */

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";
import type { InterviewProfile } from "@/db/schema";
import type { ToolContext } from "@/lib/ai/core/tool-context";

// ============================================
// Schemas
// ============================================

const LearningLevelSchema = z.enum(["none", "beginner", "intermediate", "advanced"]);

export const UpdateProfileSchema = z.object({
  goal: z.string().optional().describe("学习目标"),
  background: LearningLevelSchema.optional().describe("基础水平"),
  outcome: z.string().optional().describe("期望成果"),
});

export const ConfirmOutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedMinutes: z.number(),
  chapters: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        topics: z.array(z.string()).optional(),
      }),
    )
    .min(1),
});

// ============================================
// Types
// ============================================

export interface UpdateProfileOutput {
  success: boolean;
  profile?: InterviewProfile;
  error?: string;
}

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
    /**
     * updateProfile: 更新访谈画像
     * - 更新数据库 interviewProfile 字段
     * - 返回更新后的 profile（前端直接使用）
     */
    updateProfile: tool({
      description:
        "更新用户访谈画像。收集到 goal、background 或 outcome 时调用。返回更新后的完整 profile。",
      inputSchema: UpdateProfileSchema,
      execute: async (input): Promise<UpdateProfileOutput> => {
        // 权限验证
        const course = await db.query.courseSessions.findFirst({
          where: eq(courseSessions.id, courseId),
        });

        if (!course) {
          return { success: false, error: "课程不存在" };
        }

        if (course.userId !== ctx.userId) {
          return { success: false, error: "无权修改此课程" };
        }

        // 合并现有 profile 和新输入
        const currentProfile = (course.interviewProfile as InterviewProfile) ?? {
          goal: null,
          background: null,
          outcome: null,
        };

        const updatedProfile: InterviewProfile = {
          goal: input.goal ?? currentProfile.goal,
          background: input.background ?? currentProfile.background,
          outcome: input.outcome ?? currentProfile.outcome,
        };

        // 更新数据库
        await db
          .update(courseSessions)
          .set({
            interviewProfile: updatedProfile,
            updatedAt: new Date(),
          })
          .where(eq(courseSessions.id, courseId));

        return { success: true, profile: updatedProfile };
      },
    }),

    /**
     * confirmOutline: 生成/更新课程大纲
     * - 更新数据库 outlineData 字段
     * - 返回完整 outline（前端直接使用，不重新请求）
     */
    confirmOutline: tool({
      description:
        "生成或更新课程大纲。三个指标收集完成后首次调用，用户提出修改建议时再次调用更新。返回完整 outline。",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline): Promise<ConfirmOutlineOutput> => {
        // 权限验证
        const course = await db.query.courseSessions.findFirst({
          where: eq(courseSessions.id, courseId),
        });

        if (!course) {
          return { success: false, error: "课程不存在" };
        }

        if (course.userId !== ctx.userId) {
          return { success: false, error: "无权修改此课程" };
        }

        // 保存 outline 到数据库
        await db
          .update(courseSessions)
          .set({
            title: outline.title,
            description: outline.description,
            difficulty: outline.difficulty,
            estimatedMinutes: outline.estimatedMinutes,
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
