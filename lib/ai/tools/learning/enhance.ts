/**
 * Learning Tools - 学习增强工具
 */

import { tool } from "ai";
import { z } from "zod";

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
