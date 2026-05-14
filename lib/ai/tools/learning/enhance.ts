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

type SummaryStyle = z.infer<typeof SummaryDataSchema>["style"];
type SummaryFormat = "summary" | "structured_notes" | "action_items" | "meeting_minutes";

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

function buildSummaryPrompt(params: {
  content: string;
  lengthGuide: string;
  instruction?: string;
  format: SummaryFormat;
}) {
  return renderPromptResource("learn/summarize-user.md", {
    content: params.content.slice(0, 4000),
    summary_length: params.lengthGuide,
    instruction: params.instruction?.slice(0, 240) ?? "请忠实整理原文",
    output_format: params.format,
  });
}

function normalizeNoteContent(content: string) {
  return content.replace(/\r\n/g, "\n").trim();
}

function splitNoteFragments(content: string): string[] {
  return normalizeNoteContent(content)
    .split(/\n+|[；;]+/)
    .map((item) =>
      item
        .trim()
        .replace(/^[-*•]\s*/, "")
        .trim(),
    )
    .filter(Boolean);
}

function isShortNoteLikeContent(content: string) {
  const normalized = normalizeNoteContent(content);
  const fragments = splitNoteFragments(normalized);

  return normalized.length > 0 && normalized.length <= 600 && fragments.length >= 2;
}

function dedupePreservingOrder(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item)) {
      return false;
    }

    seen.add(item);
    return true;
  });
}

function stripLeadingTaskVerb(item: string) {
  return item.replace(/^(要|需要|需|还要|还需|还差|待|补|继续|统一)\s*/, "").trim();
}

function classifyNoteFragment(item: string) {
  if (/目标|本周目标|计划|希望/.test(item)) {
    return "goal" as const;
  }

  if (/已|已经|恢复|完成|正常|通过|上线了/.test(item)) {
    return "status" as const;
  }

  return "todo" as const;
}

function renderActionItems(items: string[]) {
  return dedupePreservingOrder(items)
    .map((item) => `- ${stripLeadingTaskVerb(item)}`)
    .join("\n");
}

function renderStructuredNotes(items: string[]) {
  const statusItems: string[] = [];
  const todoItems: string[] = [];
  const goalItems: string[] = [];

  for (const item of items) {
    const kind = classifyNoteFragment(item);
    if (kind === "status") {
      statusItems.push(item);
      continue;
    }
    if (kind === "goal") {
      goalItems.push(item);
      continue;
    }
    todoItems.push(item);
  }

  const sections: string[] = [];
  if (statusItems.length > 0) {
    sections.push(`当前状态\n${statusItems.map((item) => `- ${item}`).join("\n")}`);
  }
  if (todoItems.length > 0) {
    sections.push(`待办事项\n${todoItems.map((item) => `- ${item}`).join("\n")}`);
  }
  if (goalItems.length > 0) {
    sections.push(`目标\n${goalItems.map((item) => `- ${item}`).join("\n")}`);
  }

  return sections.join("\n\n");
}

function renderMeetingMinutes(items: string[]) {
  const structured = renderStructuredNotes(items);
  return structured.length > 0 ? `会议纪要\n\n${structured}` : "会议纪要";
}

function renderFaithfulSummary(items: string[], length: "brief" | "medium" | "detailed") {
  const fragments = dedupePreservingOrder(items);
  if (fragments.length === 0) {
    return "";
  }

  if (length === "brief") {
    return fragments.join("；");
  }

  if (length === "detailed") {
    return fragments.map((item) => `- ${item}`).join("\n");
  }

  return fragments.join("；");
}

function buildDeterministicSummary(params: {
  content: string;
  length: "brief" | "medium" | "detailed";
  format: SummaryFormat;
}) {
  if (!isShortNoteLikeContent(params.content)) {
    return null;
  }

  const items = splitNoteFragments(params.content);
  if (items.length === 0) {
    return null;
  }

  let style: SummaryStyle = "paragraph";
  let content = "";

  switch (params.format) {
    case "action_items":
      style = "bullet_points";
      content = renderActionItems(items);
      break;
    case "structured_notes":
      style = "bullet_points";
      content = renderStructuredNotes(items);
      break;
    case "meeting_minutes":
      style = "bullet_points";
      content = renderMeetingMinutes(items);
      break;
    default:
      style = params.length === "detailed" ? "key_takeaways" : "paragraph";
      content = renderFaithfulSummary(items, params.length);
      break;
  }

  return content.trim().length > 0 ? { style, content } : null;
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
- 需要快速回顾要点时
- 用户要把现有笔记整理成总结、会议纪要、结构化笔记或行动项时

使用要求：
- note rewrite 场景应传入 instruction 和 format
- 只能忠实整理原文，不补充原文没有的负责人、截止时间、优先级或技术细节`,

    inputSchema: z.object({
      content: z.string().describe("要摘要的内容"),
      instruction: z
        .string()
        .max(240)
        .optional()
        .describe("用户的整理意图，例如总结、整理会议纪要或行动项"),
      format: z
        .enum(["summary", "structured_notes", "action_items", "meeting_minutes"])
        .default("summary")
        .describe("输出形态。总结用 summary，结构化笔记用 structured_notes，行动项用 action_items"),
      length: z.enum(["brief", "medium", "detailed"]).default("medium"),
    }),

    execute: async ({ content, instruction, format, length }) => {
      const lengthGuide = {
        brief: "50-100 字",
        medium: "150-250 字",
        detailed: "300-500 字",
      };

      const startedAt = Date.now();
      const telemetryContext = createTelemetryContext({
        endpoint: "tools:learning-enhance",
        userId,
        intent: "learning-summarize",
        promptVersion: "learning-enhance:summarize@v2",
        modelPolicy: "section-draft",
        metadata: {
          length,
          contentLength: content.length,
          format,
          instruction,
        },
      });

      const deterministicSummary = buildDeterministicSummary({
        content,
        length,
        format,
      });

      if (deterministicSummary) {
        await recordAIUsage({
          ...telemetryContext,
          durationMs: Date.now() - startedAt,
          success: true,
          metadata: {
            ...telemetryContext.metadata,
            deterministic: true,
          },
        });

        return {
          success: true,
          summary: {
            sourceLength: content.length,
            length,
            style: deterministicSummary.style,
            content: deterministicSummary.content,
          },
        };
      }

      const prompt = buildSummaryPrompt({
        content,
        lengthGuide: lengthGuide[length],
        instruction,
        format,
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
