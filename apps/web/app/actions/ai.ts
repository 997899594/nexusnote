"use server";

import { v4 as uuidv4 } from "uuid";
import {
  isAIConfigured,
  fastModel,
  chatModel,
  getAIProviderInfo,
} from "@/lib/ai/registry";
import { createTelemetryConfig } from "@/lib/ai/langfuse";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import {
  streamText,
  generateText,
  Output,
} from "ai";
import {
  AIGatewayService,
  AIRequestSchema,
  type AIRequest,
} from "@/lib/ai/gateway/service";
import { requireUserId, requireAuthWithRateLimit } from "@/lib/auth/auth-utils";
import { z } from "zod";
import { db, extractedNotes } from "@nexusnote/db";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "@nexusnote/config";

// Redis 连接（复用现有配置）
const redis = new IORedis(env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// 笔记分类队列
const noteClassifyQueue = new Queue("note-classify", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

/**
 * 笔记提取 Action
 * 替代 /api/notes/extract
 */
export async function extractNoteAction(body: {
  content: string;
  sourceType?: string;
  sourceDocumentId?: string;
  sourceChapterId?: string;
  sourcePosition?: string;
}) {
  const { userId } = await requireAuthWithRateLimit(checkRateLimit);

  if (!body.content || typeof body.content !== "string") {
    throw new Error("Missing or invalid content");
  }

  // 1. 创建笔记记录
  const [note] = await db
    .insert(extractedNotes)
    .values({
      userId,
      content: body.content.slice(0, 2000),
      sourceType: body.sourceType || "document",
      sourceDocumentId: body.sourceDocumentId,
      sourceChapterId: body.sourceChapterId,
      sourcePosition: body.sourcePosition,
      status: "processing",
    })
    .returning({ id: extractedNotes.id });

  // 2. 异步生成嵌入并分类到主题
  await noteClassifyQueue.add("classify", {
    noteId: note.id,
    userId,
    content: body.content.slice(0, 2000),
  });

  return { noteId: note.id };
}

/**
 * 闪卡生成 Action
 * 替代 /api/flashcard/generate
 */
export async function generateFlashcardAction(body: {
  question: string;
  context?: string;
}) {
  const traceId = uuidv4();
  const { userId } = await requireAuthWithRateLimit(checkRateLimit);

  if (!isAIConfigured() || !fastModel) throw new Error("AI not configured");

  const SYSTEM_PROMPT = `你是一个间隔重复学习(SRS)卡片生成助手。用户会提供一个问题或概念，你需要生成一个简洁、准确的答案。

  答案要求：
  1. 简洁明了，便于记忆
  2. 直接回答问题核心
  3. 如果有公式或代码，用简洁的格式
  4. 避免冗余信息`;

  const userPrompt = body.context
    ? `问题: ${body.question}\n\n上下文: ${body.context}\n\n请生成简洁的答案：`
    : `问题: ${body.question}\n\n请生成简洁的答案：`;

  const result = await generateText({
    model: fastModel,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: 500,
    temperature: 0.5,
    experimental_telemetry: createTelemetryConfig(
      "generate-flashcard",
      { question: body.question.slice(0, 50), userId },
      traceId,
    ),
  });

  return { answer: result.text.trim() };
}

/**
 * 编辑器补全 Action
 * 替代 /api/completion
 */
export async function editorCompletionAction(body: {
  prompt: string;
  action: string;
  selection?: string;
}) {
  const traceId = uuidv4();
  const { userId } = await requireAuthWithRateLimit(checkRateLimit);

  if (!isAIConfigured() || !fastModel) throw new Error("AI not configured");

  const PROMPTS: Record<string, string> = {
    continue: "请继续写作以下内容，保持风格一致，自然衔接：\n\n",
    improve: "请润色以下文本，提升表达质量，保持原意：\n\n",
    shorter: "请缩写以下内容，保留关键信息，更加简洁：\n\n",
    longer: "请扩展以下内容，增加细节 and 深度：\n\n",
    translate_en: "请将以下内容翻译成英文：\n\n",
    translate_zh: "请将以下内容翻译成中文：\n\n",
    fix: "请修正以下文本的拼写和语法错误，保持原意：\n\n",
    explain: "请解释以下内容，用简单易懂的语言：\n\n",
    summarize: "请总结以下内容的要点：\n\n",
  };

  const instruction = PROMPTS[body.action] || "";
  const fullPrompt = instruction + (body.selection || body.prompt);

  const result = streamText({
    model: fastModel,
    prompt: fullPrompt,
    maxOutputTokens: 2048,
    temperature: 0.7,
    experimental_telemetry: createTelemetryConfig(
      "editor-completion",
      { action: body.action, userId },
      traceId,
    ),
  });

  return result.toTextStreamResponse();
}

/**
 * 幽灵分析 Action
 * 替代 /api/ghost/analyze
 */
export async function ghostAnalyzeAction(body: {
  context: string;
  documentTitle?: string;
}) {
  const traceId = uuidv4();
  const { userId } = await requireAuthWithRateLimit(checkRateLimit);

  if (!isAIConfigured() || !chatModel) throw new Error("AI not configured");

  const systemPrompt = `你是 NexusNote 幽灵助手。你正在观察一个用户编写文档 "${
    body.documentTitle || "无标题"
  }"。
用户最近似乎停顿了。观察以下上下文，判断用户是否可能处于困惑状态或者是需要一些灵感/建议。

如果用户似乎停顿在困难的地方，请提供一条简短、温和、非侵入性的建议（Ghost Comment）。
如果你觉得目前的停顿是正常的（例如用户正在思考或者已经完成了），请返回空字符串。

你的回复应该：
1. 非常简短（不超过 30 个字）。
2. 使用"协作者"或者"伙伴"的语气，而不是助手的语气。
3. 旨在打破僵局或提供新的视角。
4. **如果不需要建议，请务必返回空字符串。**

上下文内容：
---
${body.context}
---`;

  const result = streamText({
    model: chatModel!,
    system: systemPrompt,
    prompt:
      "根据上下文判断是否需要幽灵评论。如果需要，请输出建议内容。如果不需要，请输出空字符串。",
    maxOutputTokens: 100,
    temperature: 0.8,
    experimental_telemetry: createTelemetryConfig(
      "ghost-assistant",
      {
        documentTitle: body.documentTitle || "untitled",
        userId,
      },
      traceId,
    ),
  });

  return result.toTextStreamResponse();
}

/**
 * 文档大纲生成 Action
 * 替代 /api/generate-doc
 */
export async function generateDocAction(body: {
  topic: string;
  depth?: "shallow" | "medium" | "deep";
}) {
  const traceId = uuidv4();
  const { userId } = await requireAuthWithRateLimit(checkRateLimit);

  if (!isAIConfigured() || !chatModel) throw new Error("AI not configured");

  const ChapterSchema = z.object({
    title: z.string().describe("章节标题"),
    content: z.string().describe("章节简要说明（2-3句话）"),
    level: z.number().min(1).max(3).describe("章节层级"),
  });

  const DocumentSchema = z.object({
    outline: z.array(ChapterSchema).describe("文档章节列表"),
  });

  const validDepth = (d: string): "shallow" | "medium" | "deep" => {
    return ["shallow", "medium", "deep"].includes(d)
      ? (d as "shallow" | "medium" | "deep")
      : "medium";
  };

  const depthConfig = {
    shallow: { chapters: 3, detail: "简要" },
    medium: { chapters: 5, detail: "适中" },
    deep: { chapters: 8, detail: "详细" },
  }[validDepth(body.depth || "medium")];

  const result = streamText({
    model: chatModel!,
    system: `你是一个技术文档写作专家。根据用户提供的主题生成结构化的文档大纲。

    ## 输出要求
    1. 生成 ${depthConfig.chapters} 个主要章节
    2. 每个章节包含标题和简要说明（${depthConfig.detail}）
    3. 使用层级结构（level 1-3）`,
    prompt: `主题：${body.topic}\n\n请生成文档大纲。`,
    output: Output.object({
      schema: DocumentSchema,
    }),
    experimental_telemetry: createTelemetryConfig(
      "generate-doc",
      { topic: body.topic, userId },
      traceId,
    ),
  });

  return result.toTextStreamResponse();
}

/**
 * AI Gateway Server Action (Legacy/Bridge)
 * 2026 架构师建议：流式对话应优先使用 /api/ai Route Handler
 * 这里的 Action 仅作为非流式任务或旧版代码的桥接
 */
export async function aiGatewayAction(input: AIRequest): Promise<Response> {
  console.log("[aiGatewayAction] Starting...");
  console.log("[aiGatewayAction] Input messages:", input.messages?.length);
  console.log(
    "[aiGatewayAction] Input context:",
    JSON.stringify(input.context, null, 2),
  );

  const { userId } = await requireAuthWithRateLimit(checkRateLimit);

  console.log("[aiGatewayAction] userId:", userId);

  const parseResult = AIRequestSchema.safeParse(input);
  if (!parseResult.success) {
    console.error("[aiGatewayAction] Schema parse error:", parseResult.error);
    throw new Error(`Invalid request: ${parseResult.error.message}`);
  }

  console.log("[aiGatewayAction] Schema parsed successfully");

  return AIGatewayService.handleRequest(parseResult.data, { userId });
}
