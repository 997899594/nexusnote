/**
 * Learning Tools - 学习增强工具
 */

import { generateObject } from "ai";
import { tool } from "ai";
import { z } from "zod";
import { aiProvider } from "@/lib/ai/core";

// MindMap Node Schema (recursive)
interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
}

const MindMapNodeSchema: z.ZodType<MindMapNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    children: z.array(MindMapNodeSchema),
  }),
);

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
    try {
      const prompt = content
        ? `请根据以下信息生成一个思维导图结构。

主题: ${topic}
内容: ${content.slice(0, 2000)}

要求：
1. 以主题为中心节点
2. 最大层级深度: ${maxDepth}
3. 每个节点要有清晰的 id 和 label
4. 子节点按逻辑分组
5. 每个父节点最多 5 个子节点`
        : `请为主题 "${topic}" 生成一个思维导图结构。

要求：
1. 以主题为中心节点
2. 最大层级深度: ${maxDepth}
3. 每个节点要有清晰的 id 和 label
4. 子节点按逻辑分组
5. 每个父节点最多 5 个子节点`;

      const result = await generateObject({
        model: aiProvider.chatModel,
        schema: z.object({
          nodes: MindMapNodeSchema,
        }),
        prompt,
        temperature: 0.3,
      });

      return {
        success: true,
        mindMap: {
          topic,
          maxDepth,
          layout,
          hasContent: !!content,
          nodes: result.object.nodes,
        },
      };
    } catch (error) {
      console.error("[Tool] mindMap error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "生成思维导图失败",
        mindMap: null,
      };
    }
  },
});

// Summary Schema
const SummarySchema = z.object({
  mainPoints: z.array(z.string()).describe("主要要点，3-5个"),
  summary: z.string().describe("摘要内容"),
  keyTakeaways: z.array(z.string()).describe("关键收获，2-3个"),
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
    try {
      const lengthGuide = {
        brief: "50-100 字",
        medium: "150-250 字",
        detailed: "300-500 字",
      };

      const styleGuide = {
        bullet_points: "使用要点列表形式",
        paragraph: "使用段落形式",
        key_takeaways: "聚焦关键收获",
      };

      const result = await generateObject({
        model: aiProvider.chatModel,
        schema: SummarySchema,
        prompt: `请总结以下内容：

${content.slice(0, 4000)}

要求：
1. 摘要长度: ${lengthGuide[length]}
2. 摘要风格: ${styleGuide[style]}
3. 提取 3-5 个主要要点
4. 提取 2-3 个关键收获`,
        temperature: 0.3,
      });

      return {
        success: true,
        summary: {
          sourceLength: content.length,
          length,
          style,
          content: result.object.summary,
          mainPoints: result.object.mainPoints,
          keyTakeaways: result.object.keyTakeaways,
        },
      };
    } catch (error) {
      console.error("[Tool] summarize error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "生成摘要失败",
        summary: null,
      };
    }
  },
});
