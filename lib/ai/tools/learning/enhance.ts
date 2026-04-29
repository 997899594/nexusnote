/**
 * Learning Tools - 思维导图和摘要
 *
 * 工厂模式：绑定 userId 用于用量追踪和日志归属
 */

import { generateText, Output, tool } from "ai";
import { z } from "zod";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";

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

function buildMindMapPrompt(params: { topic: string; maxDepth: number; content?: string }) {
  if (params.content) {
    return renderPromptResource("learn/mind-map-with-content-user.md", {
      topic: params.topic,
      max_depth: params.maxDepth,
      content: params.content.slice(0, 2000),
    });
  }

  return renderPromptResource("learn/mind-map-user.md", {
    topic: params.topic,
    max_depth: params.maxDepth,
  });
}

function buildSummaryPrompt(content: string, lengthGuide: string) {
  return renderPromptResource("learn/summarize-user.md", {
    content: content.slice(0, 4000),
    summary_length: lengthGuide,
  });
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
      const prompt = buildMindMapPrompt({
        topic,
        content,
        maxDepth,
      });
      const startedAt = Date.now();
      const telemetryContext = createTelemetryContext({
        endpoint: "tools:learning-enhance",
        userId,
        intent: "learning-mind-map",
        promptVersion: "learning-enhance:mind-map@v1",
        modelPolicy: "section-draft",
        metadata: {
          topic,
          maxDepth,
          hasContent: Boolean(content),
          contentLength: content?.length ?? 0,
        },
      });

      try {
        const result = await generateText({
          model: getPlainModelForPolicy("section-draft"),
          prompt,
          ...buildGenerationSettingsForPolicy("section-draft", {
            temperature: 0.3,
          }),
          timeout: 45_000,
          output: Output.object({ schema: MindMapDataSchema }),
        });

        await recordAIUsage({
          ...telemetryContext,
          usage: result.usage,
          durationMs: Date.now() - startedAt,
          success: true,
        });

        return {
          success: true,
          mindMap: {
            topic,
            maxDepth,
            layout: "mindmap" as const,
            hasContent: Boolean(content),
            nodes: result.output.nodes,
          },
        };
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        await recordAIUsage({
          ...telemetryContext,
          durationMs: Date.now() - startedAt,
          success: false,
          errorMessage,
        });
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

      const prompt = buildSummaryPrompt(content, lengthGuide[length]);
      const startedAt = Date.now();
      const telemetryContext = createTelemetryContext({
        endpoint: "tools:learning-enhance",
        userId,
        intent: "learning-summarize",
        promptVersion: "learning-enhance:summarize@v1",
        modelPolicy: "section-draft",
        metadata: {
          length,
          contentLength: content.length,
        },
      });

      try {
        const result = await generateText({
          model: getPlainModelForPolicy("section-draft"),
          prompt,
          ...buildGenerationSettingsForPolicy("section-draft", {
            temperature: 0.3,
          }),
          timeout: 20_000,
          output: Output.object({ schema: SummaryDataSchema }),
        });

        await recordAIUsage({
          ...telemetryContext,
          usage: result.usage,
          durationMs: Date.now() - startedAt,
          success: true,
        });

        return {
          success: true,
          summary: {
            sourceLength: content.length,
            length,
            style: result.output.style,
            content: result.output.content,
          },
        };
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        await recordAIUsage({
          ...telemetryContext,
          durationMs: Date.now() - startedAt,
          success: false,
          errorMessage,
        });
        console.error("[Tool] summarize error:", errorMessage, { userId });
        return { success: false, error: errorMessage, summary: null };
      }
    },
  });

  return { mindMap, summarize };
}
