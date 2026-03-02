/**
 * Interview Tools - 自适应访谈系统工具
 *
 * 工具分类:
 * - 服务端工具 (有 execute): assessComplexity, createCourseProfile, updateProfile, updateOutline, confirmOutline
 * - 客户端工具 (无 execute): proposeOutline
 */

import { tool } from "ai";
import { z } from "zod";
import { courseSessions, db, eq } from "@/db";
import type { DomainComplexity, InterviewProfile, LearningLevel } from "@/db/schema";

// ============================================
// 1. assessComplexity - 评估学习主题复杂度
// ============================================

export const AssessComplexitySchema = z.object({
  courseProfileId: z.string().uuid().describe("课程画像 ID"),
  topic: z.string().describe("用户想学习的主题"),
  complexity: z
    .enum(["trivial", "simple", "moderate", "complex", "expert"])
    .describe("AI 评估的复杂度级别"),
  estimatedTurns: z.number().min(0).max(6).describe("预计访谈轮数"),
  reasoning: z.string().optional().describe("复杂度评估理由"),
});

export const assessComplexityTool = tool({
  description:
    "首轮必须调用。AI 评估学习主题复杂度，决定访谈深度。complexity 级别: trivial(0轮直接生成)/simple(1轮)/moderate(2-3轮)/complex(4-5轮)/expert(5-6轮)。",
  inputSchema: AssessComplexitySchema,
  execute: async ({ courseProfileId, topic, complexity, estimatedTurns, reasoning }) => {
    try {
      // 获取当前 profile
      const [existingProfile] = await db
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.id, courseProfileId))
        .limit(1);

      if (!existingProfile) {
        return { success: false, error: "课程画像不存在" };
      }

      // 更新 profile 中的复杂度信息
      const currentProfile = (existingProfile.interviewProfile as InterviewProfile) || {};
      const updatedProfile: InterviewProfile = {
        ...currentProfile,
        goal: topic,
        complexity: complexity as DomainComplexity,
        estimatedTurns,
        currentTurn: 0,
        insights: reasoning ? [reasoning] : currentProfile.insights || [],
        readiness: complexity === "trivial" ? 100 : 0,
      };

      await db
        .update(courseSessions)
        .set({
          title: topic,
          interviewProfile: updatedProfile,
          updatedAt: new Date(),
        })
        .where(eq(courseSessions.id, courseProfileId));

      return {
        success: true,
        topic,
        complexity,
        estimatedTurns,
        reasoning,
        message: `复杂度评估完成: ${complexity}，预计 ${estimatedTurns} 轮访谈。`,
        skipInterview: complexity === "trivial", // trivial 直接跳过访谈
      };
    } catch (error) {
      console.error("[Tool] assessComplexity error:", error);
      return { success: false, error: "复杂度评估失败" };
    }
  },
});

// ============================================
// 2. updateProfile - 更新学习者画像
// ============================================

export const UpdateProfileSchema = z.object({
  courseProfileId: z.string().uuid().describe("课程画像 ID"),
  goal: z.string().optional().describe("学习目标"),
  domain: z.string().optional().describe("学习领域"),
  complexity: z.enum(["trivial", "simple", "moderate", "complex", "expert"]).optional().describe("复杂度"),
  background: z.string().optional().describe("用户背景"),
  currentLevel: z.enum(["none", "beginner", "intermediate", "advanced"]).optional().describe("当前水平"),
  targetOutcome: z.string().optional().describe("期望的学习成果"),
  timeConstraints: z.string().optional().describe("时间限制"),
  insights: z.array(z.string()).optional().describe("洞察（会追加到已有洞察）"),
  readiness: z.number().min(0).max(100).optional().describe("准备度 0-100"),
});

export const updateProfileTool = tool({
  description:
    "更新用户的学习画像。每轮访谈后调用，累积收集用户信息。insights 数组会追加而非覆盖。直接传入要更新的字段即可。",
  inputSchema: UpdateProfileSchema,
  execute: async ({ courseProfileId, ...updates }) => {
    try {
      // 获取当前 profile
      const [existingProfile] = await db
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.id, courseProfileId))
        .limit(1);

      if (!existingProfile) {
        return { success: false, error: "课程画像不存在" };
      }

      // 合并 interviewProfile
      const currentProfile = (existingProfile.interviewProfile as InterviewProfile) || {};
      const newInsights = updates.insights || [];
      const existingInsights = currentProfile.insights || [];

      const updatedProfile: InterviewProfile = {
        goal: updates.goal ?? currentProfile.goal ?? null,
        domain: updates.domain ?? currentProfile.domain ?? null,
        complexity:
          (updates.complexity as DomainComplexity) ?? currentProfile.complexity ?? "moderate",
        background: updates.background ?? currentProfile.background ?? null,
        currentLevel:
          (updates.currentLevel as LearningLevel) ?? currentProfile.currentLevel ?? "none",
        targetOutcome: updates.targetOutcome ?? currentProfile.targetOutcome ?? null,
        timeConstraints: updates.timeConstraints ?? currentProfile.timeConstraints ?? null,
        insights: [...new Set([...existingInsights, ...newInsights])],
        readiness: updates.readiness ?? currentProfile.readiness ?? 0,
        estimatedTurns: currentProfile.estimatedTurns ?? 3, // 由 assessComplexity 设置
        currentTurn: (currentProfile.currentTurn ?? 0) + 1, // 自动递增
      };

      // 更新数据库
      await db
        .update(courseSessions)
        .set({
          interviewProfile: updatedProfile,
          updatedAt: new Date(),
        })
        .where(eq(courseSessions.id, courseProfileId));

      return {
        success: true,
        profile: updatedProfile,
        message: "画像已更新",
      };
    } catch (error) {
      console.error("[Tool] updateProfile error:", error);
      return { success: false, error: "更新画像失败" };
    }
  },
});

// ============================================
// 3. updateOutline - 更新课程大纲（每轮调用）
// ============================================

export const OutlineChapterSchema = z.object({
  title: z.string().describe("章节标题"),
  description: z.string().optional().describe("章节描述"),
  topics: z.array(z.string()).optional().describe("章节包含的主题"),
});

export const UpdateOutlineSchema = z.object({
  courseProfileId: z.string().uuid().describe("课程画像 ID"),
  title: z.string().describe("课程标题"),
  description: z.string().optional().describe("课程描述"),
  estimatedMinutes: z.number().optional().describe("预计学习时间(分钟)"),
  chapters: z.array(OutlineChapterSchema).min(1).describe("章节列表"),
});

export const updateOutlineTool = tool({
  description: "更新课程大纲。每轮对话后调用，生成完整的课程大纲。用户可以根据大纲反馈调整。",
  inputSchema: UpdateOutlineSchema,
  execute: async ({ courseProfileId, title, description, estimatedMinutes, chapters }) => {
    try {
      const outlineData = {
        title,
        description,
        estimatedMinutes,
        chapters,
      };

      await db
        .update(courseSessions)
        .set({
          title,
          description,
          estimatedMinutes,
          outlineData,
          updatedAt: new Date(),
        })
        .where(eq(courseSessions.id, courseProfileId));

      return {
        success: true,
        outline: outlineData,
        message: "大纲已更新",
      };
    } catch (error) {
      console.error("[Tool] updateOutline error:", error);
      return { success: false, error: "更新大纲失败" };
    }
  },
});

// ============================================
// 4. suggestOptions - 展示选项（服务端工具，返回数据给 UI）
// ============================================

export const SuggestOptionsSchema = z.object({
  options: z.array(z.string()).min(2).max(6).describe("可点击的选项列表"),
});

export const suggestOptionsTool = tool({
  description: "向用户展示可点击的选项。每轮回复后调用，返回选项数据给 UI 渲染。AI 继续生成文字。",
  inputSchema: SuggestOptionsSchema,
  execute: async ({ options }) => {
    // 返回选项数据，让 UI 渲染
    return {
      success: true,
      options: options.map((label) => ({ label })),
    };
  },
});

// ============================================
// 5. proposeOutline - 提出课程大纲 (客户端工具)
// ============================================

export const CourseOutlineModuleSchema = z.object({
  id: z.string().optional(),
  title: z.string().describe("模块标题"),
  description: z.string().optional().describe("模块描述"),
  chapters: z.array(z.string()).min(1).describe("章节列表"),
  estimatedMinutes: z.number().optional().describe("预计学习时间(分钟)"),
});

export const ProposeOutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().optional().describe("课程描述"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("难度级别"),
  estimatedMinutes: z.number().describe("预计总学习时间(分钟)"),
  modules: z.array(CourseOutlineModuleSchema).min(1).describe("课程模块列表"),
  reasoning: z.string().optional().describe("为什么推荐这个大纲"),
});

export const proposeOutlineTool = tool({
  description:
    "生成并展示课程大纲给用户确认。访谈完成后调用，包含标题、难度、预计时间和模块详情。用户可以确认或要求调整。",
  inputSchema: ProposeOutlineSchema,
  // 无 execute - 这是客户端工具，会暂停 AI 循环等待用户确认
});

// ============================================
// 5. createCourseProfile - 创建课程画像
// ============================================

export const CreateCourseProfileSchema = z.object({
  userId: z.string().uuid().describe("用户 ID"),
  goal: z.string().describe("学习目标"),
});

export const createCourseProfileTool = tool({
  description: "创建新的课程画像记录。访谈开始时调用。",
  inputSchema: CreateCourseProfileSchema,
  execute: async ({ userId, goal }) => {
    try {
      const initialProfile: InterviewProfile = {
        goal,
        domain: null,
        complexity: "moderate",
        background: null,
        currentLevel: "none",
        targetOutcome: null,
        timeConstraints: null,
        insights: [],
        readiness: 0,
        estimatedTurns: 3,
        currentTurn: 0,
      };

      const [profile] = await db
        .insert(courseSessions)
        .values({
          userId,
          title: goal,
          interviewProfile: initialProfile,
          interviewStatus: "interviewing",
          status: "idle",
        })
        .returning();

      return {
        success: true,
        courseProfileId: profile.id,
        profile: initialProfile,
      };
    } catch (error) {
      console.error("[Tool] createCourseProfile error:", error);
      return { success: false, error: "创建课程画像失败" };
    }
  },
});

// ============================================
// 6. confirmOutline - 确认大纲并生成课程
// ============================================

export const ConfirmOutlineSchema = z.object({
  courseProfileId: z.string().uuid().describe("课程画像 ID"),
  outline: ProposeOutlineSchema.describe("确认的课程大纲"),
});

export const confirmOutlineTool = tool({
  description: "用户确认大纲后，正式创建课程。访谈结束时调用此工具。保存大纲数据并准备生成章节内容。",
  inputSchema: ConfirmOutlineSchema,
  execute: async ({ courseProfileId, outline }) => {
    try {
      // 转换 modules 为 chapters 格式
      const chapters = outline.modules.map((module, index) => ({
        title: module.title,
        description: module.description,
        topics: module.chapters,
        order: index,
      }));

      const outlineData = {
        title: outline.title,
        description: outline.description,
        estimatedMinutes: outline.estimatedMinutes,
        chapters,
      };

      // 更新课程画像，保存大纲
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
        courseProfileId,
        title: outline.title,
        moduleCount: outline.modules.length,
        outline: outlineData, // 返回完整大纲数据
        message: "大纲已确认，准备生成课程内容",
      };
    } catch (error) {
      console.error("[Tool] confirmOutline error:", error);
      return { success: false, error: "确认大纲失败" };
    }
  },
});

// ============================================
// 导出
// ============================================

export const interviewTools = {
  assessComplexity: assessComplexityTool,
  updateProfile: updateProfileTool,
  suggestOptions: suggestOptionsTool,
  confirmOutline: confirmOutlineTool,
};

// 重新导出类型供其他模块使用
export type { DomainComplexity, InterviewProfile, LearningLevel };
