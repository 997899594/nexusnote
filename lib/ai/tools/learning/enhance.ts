/**
 * Learning Tools - 思维导图和摘要
 *
 * 工厂模式：绑定 userId 用于用量追踪和日志归属
 */

import { tool } from "ai";
import { z } from "zod";
import { callNestedAI } from "@/lib/ai/core/nested-ai";

// ============================================
// Schemas
// ============================================

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

const MindMapDataSchema = z.object({
  nodes: MindMapNodeSchema,
});

const SummaryDataSchema = z.object({
  mainPoints: z.array(z.string()),
  summary: z.string(),
  keyTakeaways: z.array(z.string()),
});

// ============================================
// Tool Factories
// ============================================

/**
 * 创建思维导图工具（绑定 userId）
 */
export function createEnhanceTools(userId: string) {
  const mindMap = tool({
    description: `将文本转化为结构化思维导图。

适用于：
- 解释复杂系统架构
- 用户需要全局视角时
- 整理知识结构`,

    inputSchema: z.object({
      topic: z.string().describe("中心主题"),
      content: z.string().optional().describe("要组织的内容"),
      maxDepth: z.number().min(1).max(4).default(3).describe("最大层级深度"),
    }),

    execute: async ({ topic, content, maxDepth }) => {
      const prompt = content
        ? `基于以下内容，为主题「${topic}」生成思维导图结构。

内容：
${content.slice(0, 2000)}

要求：
- 最大层级深度：${maxDepth}
- 每个父节点最多 5 个子节点
- 节点按逻辑分组`
        : `为主题「${topic}」生成思维导图结构。

要求：
- 最大层级深度：${maxDepth}
- 每个父节点最多 5 个子节点`;

      const result = await callNestedAI(prompt, MindMapDataSchema, {
        timeout: 45_000,
      });

      if (!result.success) {
        console.error("[Tool] mindMap error:", result.error, { userId });
        return { success: false, error: result.error, mindMap: null };
      }

      return {
        success: true,
        mindMap: { topic, maxDepth, nodes: result.data!.nodes },
      };
    },
  });

  const summarize = tool({
    description: `降低认知负荷，生成内容摘要。

适用于：
- 用户面对长文档不知所措
- 需要快速回顾要点时`,

    inputSchema: z.object({
      content: z.string().describe("要摘要的内容"),
      length: z.enum(["brief", "medium", "detailed"]).default("medium"),
    }),

    execute: async ({ content, length }) => {
      const lengthGuide = {
        brief: "50-100 字",
        medium: "150-250 字",
        detailed: "300-500 字",
      };

      const prompt = `总结以下内容：

${content.slice(0, 4000)}

要求：
- 摘要长度：${lengthGuide[length]}
- 提取 3-5 个主要要点
- 提取 2-3 个关键收获`;

      const result = await callNestedAI(prompt, SummaryDataSchema, {
        timeout: 20_000,
      });

      if (!result.success) {
        console.error("[Tool] summarize error:", result.error, { userId });
        return { success: false, error: result.error, summary: null };
      }

      return {
        success: true,
        summary: { sourceLength: content.length, length, ...result.data! },
      };
    },
  });

  return { mindMap, summarize };
}

