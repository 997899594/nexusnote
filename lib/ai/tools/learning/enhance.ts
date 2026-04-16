/**
 * Learning Tools - 思维导图和摘要
 *
 * 工厂模式：绑定 userId 用于用量追踪和日志归属
 */

import { generateText, Output, tool } from "ai";
import { z } from "zod";
import {
  createTelemetryContext,
  getErrorMessage,
  getJsonModelForPolicy,
  recordAIUsage,
} from "@/lib/ai/core";

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
  style: z.enum(["bullet_points", "paragraph", "key_takeaways"]),
  content: z.string(),
});

interface StructuredLearningCallOptions<T> {
  userId: string;
  prompt: string;
  schema: z.ZodSchema<T>;
  timeout: number;
  temperature?: number;
  telemetry: {
    intent: string;
    promptVersion: string;
    metadata?: Record<string, unknown>;
  };
}

async function generateStructuredLearningOutput<T>({
  userId,
  prompt,
  schema,
  timeout,
  temperature = 0.3,
  telemetry,
}: StructuredLearningCallOptions<T>): Promise<T> {
  const startedAt = Date.now();
  const telemetryContext = createTelemetryContext({
    endpoint: "tools:learning-enhance",
    userId,
    intent: telemetry.intent,
    promptVersion: telemetry.promptVersion,
    modelPolicy: "interactive-fast",
    metadata: telemetry.metadata,
  });

  try {
    const result = await generateText({
      model: getJsonModelForPolicy("interactive-fast"),
      prompt,
      temperature,
      timeout,
      output: Output.object({ schema }),
    });

    await recordAIUsage({
      ...telemetryContext,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return result.output;
  } catch (error) {
    await recordAIUsage({
      ...telemetryContext,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(error),
    });
    throw new Error(getErrorMessage(error));
  }
}

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

      try {
        const result = await generateStructuredLearningOutput({
          userId,
          prompt,
          schema: MindMapDataSchema,
          timeout: 45_000,
          telemetry: {
            intent: "learning-mind-map",
            promptVersion: "learning-enhance:mind-map@v1",
            metadata: {
              topic,
              maxDepth,
              hasContent: Boolean(content),
              contentLength: content?.length ?? 0,
            },
          },
        });

        return {
          success: true,
          mindMap: {
            topic,
            maxDepth,
            layout: "mindmap" as const,
            hasContent: Boolean(content),
            nodes: result.nodes,
          },
        };
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        console.error("[Tool] mindMap error:", errorMessage, { userId });
        return { success: false, error: errorMessage, mindMap: null };
      }
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
- 返回适合直接展示的摘要正文
- style 只能是 bullet_points、paragraph、key_takeaways 之一`;

      try {
        const result = await generateStructuredLearningOutput({
          userId,
          prompt,
          schema: SummaryDataSchema,
          timeout: 20_000,
          telemetry: {
            intent: "learning-summarize",
            promptVersion: "learning-enhance:summarize@v1",
            metadata: {
              length,
              contentLength: content.length,
            },
          },
        });

        return {
          success: true,
          summary: {
            sourceLength: content.length,
            length,
            style: result.style,
            content: result.content,
          },
        };
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        console.error("[Tool] summarize error:", errorMessage, { userId });
        return { success: false, error: errorMessage, summary: null };
      }
    },
  });

  return { mindMap, summarize };
}
