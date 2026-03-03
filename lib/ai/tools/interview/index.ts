/**
 * Interview Tools - 2026 Modern Architecture
 *
 * 工厂函数模式：通过闭包绑定 courseProfileId
 * - AI 不需要传 ID，更可靠
 * - 类型安全
 */

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";
import type { DomainComplexity, InterviewProfile, LearningLevel } from "@/db/schema";

// ============================================
// Schemas (不含 courseProfileId)
// ============================================

export const AssessComplexitySchema = z.object({
  topic: z.string().describe("用户想学习的主题"),
  complexity: z
    .enum(["trivial", "simple", "moderate", "complex", "expert"])
    .describe("复杂度: trivial(0轮)/simple(1轮)/moderate(2-3轮)/complex(4-5轮)/expert(5-6轮)"),
  estimatedTurns: z.number().min(0).max(6).describe("预计访谈轮数"),
  reasoning: z.string().optional().describe("评估理由"),
});

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
// 工厂函数
// ============================================

export function createInterviewTools(courseProfileId: string) {
  return {
    assessComplexity: tool({
      description: "首轮必须调用。评估主题复杂度，决定访谈深度。",
      inputSchema: AssessComplexitySchema,
      execute: async ({ topic, complexity, estimatedTurns, reasoning }) => {
        try {
          const [existing] = await db
            .select()
            .from(courseSessions)
            .where(eq(courseSessions.id, courseProfileId))
            .limit(1);

          if (!existing) {
            return { success: false, error: "课程不存在" };
          }

          const current = (existing.interviewProfile as InterviewProfile) || {};
          const updated: InterviewProfile = {
            ...current,
            goal: topic,
            complexity: complexity as DomainComplexity,
            estimatedTurns,
            currentTurn: 0,
            insights: reasoning ? [...(current.insights || []), reasoning] : current.insights || [],
            readiness: complexity === "trivial" ? 100 : 0,
          };

          await db
            .update(courseSessions)
            .set({ title: topic, interviewProfile: updated, updatedAt: new Date() })
            .where(eq(courseSessions.id, courseProfileId));

          return {
            success: true,
            complexity,
            estimatedTurns,
            skipInterview: complexity === "trivial",
          };
        } catch (error) {
          console.error("[assessComplexity]", error);
          return { success: false, error: "评估失败" };
        }
      },
    }),

    updateProfile: tool({
      description: "更新学习画像。每轮调用。",
      inputSchema: UpdateProfileSchema,
      execute: async (updates) => {
        try {
          const [existing] = await db
            .select()
            .from(courseSessions)
            .where(eq(courseSessions.id, courseProfileId))
            .limit(1);

          if (!existing) {
            return { success: false, error: "课程不存在" };
          }

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

          return { success: true, profile: updated };
        } catch (error) {
          console.error("[updateProfile]", error);
          return { success: false, error: "更新失败" };
        }
      },
    }),

    suggestOptions: tool({
      description: "展示选项。每轮回复后调用。",
      inputSchema: SuggestOptionsSchema,
      execute: async ({ options }) => {
        // 这是一个客户端展示工具，execute 只需返回选项
        // AI SDK 会停止循环，等待用户选择
        return {
          success: true,
          options,
          message: "请选择一个选项或输入自定义内容",
        };
      },
    }),

    confirmOutline: tool({
      description: "确认大纲。访谈结束时调用。",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline) => {
        try {
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

          return {
            success: true,
            outline: outlineData,
            message: "大纲已确认",
          };
        } catch (error) {
          console.error("[confirmOutline]", error);
          return { success: false, error: "确认失败" };
        }
      },
    }),
  };
}

// 重新导出类型
export type { DomainComplexity, InterviewProfile, LearningLevel };
