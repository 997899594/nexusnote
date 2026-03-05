/**
 * Interview Tools - 单阶段工具集
 */

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";
import type { DomainComplexity, InterviewProfile } from "@/db/schema";

// ============================================
// Schemas
// ============================================

export const UpdateProfileSchema = z.object({
  background: z.string().optional().describe("用户背景"),
  currentLevel: z.enum(["none", "beginner", "intermediate", "advanced"]).optional(),
  targetOutcome: z.string().optional().describe("期望成果"),
  timeConstraints: z.string().optional().describe("时间限制"),
  insights: z.array(z.string()).optional().describe("洞察"),
  readiness: z.number().min(0).max(100).optional().describe("准备度"),
});

export const SuggestOptionsSchema = z.object({
  options: z.array(z.string()).min(2).max(6).describe("选项列表"),
});

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
// Tools Factory
// ============================================

export function createInterviewTools(courseProfileId: string) {
  return {
    updateProfile: tool({
      description: "更新学习画像。",
      inputSchema: UpdateProfileSchema,
      execute: async (updates) => {
        const [existing] = await db
          .select()
          .from(courseSessions)
          .where(eq(courseSessions.id, courseProfileId))
          .limit(1);

        if (!existing) return { success: false, error: "课程不存在" };

        const current = (existing.interviewProfile as InterviewProfile) || {};
        const updated: InterviewProfile = {
          goal: current.goal ?? null,
          domain: current.domain ?? null,
          complexity: current.complexity ?? "moderate",
          background: updates.background ?? current.background ?? null,
          currentLevel: updates.currentLevel ?? current.currentLevel ?? "none",
          targetOutcome: updates.targetOutcome ?? current.targetOutcome ?? null,
          timeConstraints: updates.timeConstraints ?? current.timeConstraints ?? null,
          insights: [...new Set([...(current.insights || []), ...(updates.insights || [])])],
          readiness: updates.readiness ?? current.readiness ?? 0,
          estimatedTurns: current.estimatedTurns ?? 3,
          currentTurn: (current.currentTurn ?? 0) + 1,
        };

        await db
          .update(courseSessions)
          .set({ interviewProfile: updated, updatedAt: new Date() })
          .where(eq(courseSessions.id, courseProfileId));

        return { success: true };
      },
    }),

    suggestOptions: tool({
      description: "提供选项供用户选择。每轮回复后调用。",
      inputSchema: SuggestOptionsSchema,
      execute: async ({ options }) => ({
        success: true,
        options,
        message: "请选择或输入自定义内容",
      }),
    }),

    confirmOutline: tool({
      description: "生成并保存课程大纲。访谈结束时调用。",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline) => {
        const chapters = outline.modules.map((m, i) => ({
          title: m.title,
          description: m.description,
          topics: m.chapters,
          order: i,
        }));

        const outlineData = {
          title: outline.title,
          description: outline.description,
          estimatedMinutes: outline.estimatedMinutes,
          chapters,
        };

        await db
          .update(courseSessions)
          .set({
            title: outline.title,
            description: outline.description,
            difficulty: outline.difficulty,
            estimatedMinutes: outline.estimatedMinutes,
            outlineData,
            interviewStatus: "completed",
            status: "outline_confirmed",
            updatedAt: new Date(),
          })
          .where(eq(courseSessions.id, courseProfileId));

        return { success: true, outline: outlineData };
      },
    }),
  };
}

export type { DomainComplexity, InterviewProfile };
