// lib/ai/tools/shared/suggest-options.ts

import { tool } from "ai";
import { z } from "zod";

/**
 * 通用选项建议工具
 *
 * 所有 Agent 都可以使用，用于：
 * - 给用户提供快速回复选项
 * - 降低用户输入成本
 * - 引导对话方向
 *
 * 用户不是必须选择，可以直接对话
 */
export const suggestOptionsTool = tool({
  description: `根据对话上下文，预测用户最可能的意图，显示为快捷操作。

核心原则：
- 意图 = 用户想做的事/想了解的信息
- 专业干练，禁止口语化

示例：
用户：我想学 React
AI：你的编程基础怎么样？
→ suggestOptions({ options: ["零基础入门", "HTML/CSS 基础", "JavaScript 基础", "有前端经验"] })

用户：这个课程要多久？
AI：大约需要 20 小时
→ suggestOptions({ options: ["开始学习", "查看大纲", "试听课程", "学习计划"] })`,

  inputSchema: z.object({
    options: z.array(z.string()).min(2).max(5)
      .describe("用户最可能的意图，专业干练，2-4个"),
  }),

  execute: async ({ options }) => ({
    success: true,
    options,
  }),
});
