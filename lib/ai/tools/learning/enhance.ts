/**
 * Learning Tools - 学习增强工具
 */

import { tool } from "ai";
import { z } from "zod";

export const generateQuizTool = tool({
  description: `用于将被动阅读转化为主动回忆 (Active Recall)。
  适用于：1. 用户刚阅读完长难章节；2. 用户表示"懂了"但你怀疑其掌握程度时。
  **请主动使用此工具来验证用户的理解，无需等待指令。**`,
  inputSchema: z.object({
    content: z.string().describe("要测试的内容或主题"),
    questionCount: z.number().min(1).max(10).default(5).describe("题目数量"),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium").describe("难度级别"),
    types: z
      .array(z.enum(["multiple_choice", "true_false", "fill_blank"]))
      .optional()
      .describe("题型"),
  }),
  execute: async ({ content, questionCount, difficulty }) => {
    // TODO: 调用 LLM 生成真实测验
    console.log("[Tool] generateQuiz:", { content, questionCount, difficulty });
    return {
      success: true,
      quiz: {
        topic: content.slice(0, 50),
        difficulty,
        questionCount,
        questions: [
          {
            id: 1,
            type: "multiple_choice",
            question: "这是示例题目？",
            options: ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
            answer: 0,
            explanation: "这是解释",
          },
        ],
      },
    };
  },
});

export const mindMapTool = tool({
  description: `用于将非结构化的文本转化为结构化图谱。
  适用于：1. 解释复杂的系统架构或家族树；2. 用户似乎迷失在长文本中，需要全局视角时。`,
  inputSchema: z.object({
    topic: z.string().describe("中心主题"),
    content: z.string().optional().describe("要组织的内容"),
    maxDepth: z.number().min(1).max(4).default(3).describe("最大层级深度"),
    layout: z.enum(["radial", "tree", "mindmap"]).default("mindmap").describe("布局类型"),
  }),
  execute: async ({ topic, content, maxDepth, layout }) => {
    // TODO: 调用 LLM 生成真实思维导图
    console.log("[Tool] mindMap:", { topic, maxDepth, layout });
    return {
      success: true,
      mindMap: {
        topic,
        maxDepth,
        layout,
        hasContent: !!content,
        nodes: {
          id: "root",
          label: topic,
          children: [
            { id: "1", label: "要点1" },
            { id: "2", label: "要点2" },
            { id: "3", label: "要点3" },
          ],
        },
      },
    };
  },
});

export const summarizeTool = tool({
  description: `用于降低认知负荷。
  适用于：1. 用户面对长文档显得不知所措；2. 需要快速回顾前文要点时。`,
  inputSchema: z.object({
    content: z.string().describe("要摘要的内容"),
    length: z.enum(["brief", "medium", "detailed"]).default("medium").describe("摘要长度"),
    style: z
      .enum(["bullet_points", "paragraph", "key_takeaways"])
      .default("bullet_points")
      .describe("摘要风格"),
  }),
  execute: async ({ content, length, style }) => {
    // TODO: 调用 LLM 生成真实摘要
    console.log("[Tool] summarize:", { length, style });
    return {
      success: true,
      summary: {
        sourceLength: content.length,
        length,
        style,
        content: "这是摘要内容...",
      },
    };
  },
});
