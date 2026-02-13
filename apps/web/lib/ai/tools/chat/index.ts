/**
 * NexusNote AI Skills
 *
 * 基于 Vercel AI SDK 6.x 的工具调用系统
 * 支持 Generative UI 流式渲染 React 组件
 *
 * AI SDK 6.x 使用 inputSchema 而不是 parameters
 * @see https://ai-sdk.dev/docs/foundations/tools
 */

import { tool } from "ai";
import { z } from "zod";
import { searchNotesAction } from "@/features/learning/actions/note";
import { flashcardStore } from "@/features/learning/stores/flashcard-store";

// ============================================
// Skill Definitions (Tools for AI SDK 6.x)
// ============================================

/**
 * 创建闪卡 - 从文本内容创建学习卡片
 */
export const createFlashcards = tool({
  description: `用于辅助间隔重复记忆 (Spaced Repetition)。适用于：1. 识别到明确的定义、公式或关键事实；2. 用户表达需要"记住"某事。**主动识别可记忆点并提供转换建议。**`,
  inputSchema: z.object({
    cards: z
      .array(
        z.object({
          front: z.string().describe("卡片正面（问题/提示）"),
          back: z.string().describe("卡片背面（答案/解释）"),
        }),
      )
      .describe("要创建的闪卡列表"),
    context: z.string().optional().describe("内容来源的上下文"),
  }),
  execute: async ({ cards, context }) => {
    const created = [];
    for (const card of cards) {
      const flashcard = await flashcardStore.createCard(card.front, card.back, {
        context,
      });
      created.push({
        id: flashcard.id,
        front: flashcard.front,
        back: flashcard.back,
      });
    }
    return {
      success: true,
      count: created.length,
      cards: created,
    };
  },
});

/**
 * 搜索笔记 - 在知识库中搜索相关内容
 */
export const searchNotes = tool({
  description:
    '在用户的笔记/文档库中搜索相关内容。当用户问"我之前写过什么关于..."、"搜索笔记"时调用。',
  inputSchema: z.object({
    query: z.string().describe("搜索关键词或问题"),
    limit: z.number().optional().default(5).describe("返回结果数量"),
  }),
  execute: async ({ query, limit }) => {
    try {
      const result = await searchNotesAction({ query, limit });

      if (!result.success) {
        return {
          success: false,
          query,
          results: [],
          message: result.error || "搜索服务暂不可用",
        };
      }

      const results = result.data;

      return {
        success: true,
        query,
        results: (results || []).map((r) => ({
          title: r.documentTitle,
          content: (r.content || "").slice(0, 200) + ((r.content || "").length > 200 ? "..." : ""),
          documentId: r.documentId,
          relevance: Math.round((r.similarity || 0) * 100),
        })),
      };
    } catch (error) {
      console.error("[Skill: searchNotes] Error:", error);
      return {
        success: false,
        query,
        results: [],
        message: "搜索过程中发生错误",
      };
    }
  },
});

/**
 * 获取复习统计 - 获取用户的 SRS 学习数据
 */
export const getReviewStats = tool({
  description: '获取用户的闪卡复习统计。当用户问"我的学习进度"、"今天要复习多少"时调用。',
  inputSchema: z.object({}),
  execute: async () => {
    const stats = await flashcardStore.getStats();
    const streak = await flashcardStore.getStreak();

    return {
      totalCards: stats.totalCards,
      dueToday: stats.dueToday,
      newCards: stats.newCards,
      learningCards: stats.learningCards,
      masteredCards: stats.reviewCards,
      retention: stats.averageRetention,
      streak,
    };
  },
});

/**
 * 生成学习计划 - 基于目标创建学习计划
 */
export const createLearningPlan = tool({
  description: '为用户生成学习计划。当用户要求"制定学习计划"、"帮我规划学习"时调用。',
  inputSchema: z.object({
    topic: z.string().describe("学习主题"),
    duration: z.string().optional().describe('学习时长，如"一周"、"一个月"'),
    level: z.enum(["beginner", "intermediate", "advanced"]).optional().describe("难度级别"),
  }),
  execute: async ({ topic, duration, level }) => {
    return {
      topic,
      duration: duration || "两周",
      level: level || "beginner",
      needsAICompletion: true,
    };
  },
});

// ============================================
// Export all skills
// ============================================

export const skills = {
  createFlashcards,
  searchNotes,
  getReviewStats,
  createLearningPlan,
};

export type SkillName = keyof typeof skills;

// ============================================
// Re-export editor skills
// ============================================

export * from "./editor";
export { editorSkills } from "./editor";

// ============================================
// Re-export learning skills
// ============================================

export * from "./learning";
export { learningSkills } from "./learning";

// ============================================
// Re-export web search skills
// ============================================

export * from "./web";
export { webSearchSkills } from "./web";
