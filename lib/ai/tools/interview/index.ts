/**
 * Interview Tools - 自适应访谈系统工具
 *
 * 工具分类:
 * - 服务端工具 (有 execute): assessComplexity, updateProfile
 * - 客户端工具 (无 execute): suggestOptions, proposeOutline
 */

import { tool } from "ai";
import { z } from "zod";
import { courseProfiles, db, eq } from "@/db";
import type { DomainComplexity, InterviewProfile, LearningLevel } from "@/db/schema";

// ============================================
// 1. assessComplexity - 评估学习主题复杂度
// ============================================

export const AssessComplexitySchema = z.object({
  topic: z.string().describe("用户想学习的主题"),
  initialContext: z.string().optional().describe("用户已有的背景信息"),
});

export const assessComplexityTool = tool({
  description:
    "评估学习主题的复杂度，决定访谈深度。返回复杂度级别(trivial/simple/moderate/complex/expert)、领域、预计轮数等信息。",
  inputSchema: AssessComplexitySchema,
  execute: async ({ topic, initialContext }) => {
    // 基于主题关键词的简单领域检测
    const domainPatterns: Record<string, string[]> = {
      cooking: ["炒", "煮", "做", "烹饪", "菜", "饭", "食材"],
      programming: ["编程", "代码", "开发", "python", "javascript", "react", "前端", "后端"],
      exam: ["考研", "考试", "高考", "四级", "六级", "雅思", "托福"],
      design: ["设计", "ui", "ux", "figma", "海报", "ppt"],
      language: ["英语", "日语", "法语", "德语", "学习语言"],
      music: ["吉他", "钢琴", "乐器", "音乐", "唱歌"],
      fitness: ["健身", "减肥", "运动", "瑜伽"],
    };

    let detectedDomain = "general";
    const topicLower = topic.toLowerCase();

    for (const [domain, keywords] of Object.entries(domainPatterns)) {
      if (keywords.some((k) => topicLower.includes(k))) {
        detectedDomain = domain;
        break;
      }
    }

    return {
      success: true,
      topic,
      domain: detectedDomain,
      initialContext,
      message: `已识别学习领域: ${detectedDomain}。请根据主题复杂度决定访谈深度。`,
    };
  },
});

// ============================================
// 2. updateProfile - 更新学习者画像
// ============================================

export const UpdateProfileSchema = z.object({
  courseProfileId: z.string().uuid().describe("课程画像 ID"),
  updates: z
    .object({
      goal: z.string().optional(),
      domain: z.string().optional(),
      complexity: z.enum(["trivial", "simple", "moderate", "complex", "expert"]).optional(),
      background: z.string().optional(),
      currentLevel: z.enum(["none", "beginner", "intermediate", "advanced"]).optional(),
      targetOutcome: z.string().optional(),
      timeConstraints: z.string().optional(),
      insights: z.array(z.string()).optional(),
      readiness: z.number().min(0).max(100).optional(),
      estimatedTurns: z.number().optional(),
      currentTurn: z.number().optional(),
    })
    .describe("要更新的画像字段"),
});

export const updateProfileTool = tool({
  description:
    "更新用户的学习画像。每轮访谈后调用，累积收集用户信息。insights 数组会追加而非覆盖。",
  inputSchema: UpdateProfileSchema,
  execute: async ({ courseProfileId, updates }) => {
    try {
      // 获取当前 profile
      const [existingProfile] = await db
        .select()
        .from(courseProfiles)
        .where(eq(courseProfiles.id, courseProfileId))
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
        estimatedTurns: updates.estimatedTurns ?? currentProfile.estimatedTurns ?? 3,
        currentTurn: updates.currentTurn ?? (currentProfile.currentTurn ?? 0) + 1,
      };

      // 更新数据库
      await db
        .update(courseProfiles)
        .set({
          interviewProfile: updatedProfile,
          updatedAt: new Date(),
        })
        .where(eq(courseProfiles.id, courseProfileId));

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
// 3. suggestOptions - 展示选项 (服务端工具，返回数据给UI)
// ============================================

export const SuggestOptionsSchema = z.object({
  question: z.string().describe("要询问用户的问题"),
  options: z.array(z.string()).min(2).max(6).describe("可点击的选项列表"),
  allowCustom: z.boolean().default(true).describe("是否允许自定义输入"),
  allowSkip: z.boolean().default(false).describe("是否允许跳过此问题"),
  multiSelect: z.boolean().default(false).describe("是否允许多选"),
});

export const suggestOptionsTool = tool({
  description:
    "向用户展示可点击的选项。返回选项数据给 UI 渲染。AI 应继续生成文字问题。",
  inputSchema: SuggestOptionsSchema,
  execute: async ({ question, options, allowCustom, allowSkip, multiSelect }) => {
    // 直接返回输入，让 UI 渲染选项
    // AI SDK 不会暂停，AI 继续生成文字
    return { question, options, allowCustom, allowSkip, multiSelect };
  },
});

// ============================================
// 4. proposeOutline - 提出课程大纲 (客户端工具)
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
        .insert(courseProfiles)
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
  description: "用户确认大纲后，正式创建课程。保存大纲数据并准备生成章节内容。",
  inputSchema: ConfirmOutlineSchema,
  execute: async ({ courseProfileId, outline }) => {
    try {
      // 更新课程画像，保存大纲
      await db
        .update(courseProfiles)
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
        .where(eq(courseProfiles.id, courseProfileId));

      return {
        success: true,
        courseProfileId,
        title: outline.title,
        moduleCount: outline.modules.length,
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
  proposeOutline: proposeOutlineTool,
  createCourseProfile: createCourseProfileTool,
  confirmOutline: confirmOutlineTool,
};

// 重新导出类型供其他模块使用
export type { DomainComplexity, InterviewProfile, LearningLevel };
