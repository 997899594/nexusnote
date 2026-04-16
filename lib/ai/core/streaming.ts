// lib/ai/core/streaming.ts

import {
  type Agent,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  type ToolSet,
  type UIMessage,
} from "ai";
import { classifyAIDegradation } from "@/lib/ai/core/degradation";
import { createPresentationFilteredStreamResponse } from "@/lib/ai/core/ui-stream-filter";

export interface StreamOptions {
  /** 会话 ID */
  sessionId?: string;
  /** 资源 ID */
  resourceId?: string;
  /** 允许下发的工具展示类型 */
  presentation?: "chat" | "interview";
  /** 是否向前端发送 reasoning */
  sendReasoning?: boolean;
  /** 流结束回调 */
  onFinish?: (options: {
    messages: UIMessage[];
    isContinuation: boolean;
    isAborted: boolean;
    responseMessage: UIMessage;
    finishReason?: "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other";
  }) => Promise<void> | void;
  /** 复制底层 SSE 以支持 resumable streams */
  consumeSseStream?: (options: { stream: ReadableStream<string> }) => Promise<void> | void;
}

// ============================================
// Fallback Messages
// ============================================

const FALLBACK_MESSAGES = {
  timeout: "抱歉，AI 响应超时，请稍后重试。",
  rate_limit: "请求过于频繁，请稍后再试。",
  model_error: "AI 模型暂时不可用，请稍后重试。",
  unknown: "抱歉，AI 服务出现异常，请稍后重试。",
};

function getFallbackMessage(error: unknown): string {
  const degradation = classifyAIDegradation(error);
  if (degradation) {
    return degradation.userMessage;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("timeout") || message.includes("timed out")) {
      return FALLBACK_MESSAGES.timeout;
    }
    if (message.includes("rate limit") || message.includes("429")) {
      return FALLBACK_MESSAGES.rate_limit;
    }
    if (message.includes("model") || message.includes("503")) {
      return FALLBACK_MESSAGES.model_error;
    }
  }
  return FALLBACK_MESSAGES.unknown;
}

// ============================================
// Fallback Stream
// ============================================

function createFallbackStream(
  message: string,
  headers: { sessionId?: string; resourceId?: string },
): Response {
  const response = createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          type: "error",
          errorText: message,
        });
      },
    }),
    status: 200,
    headers: {
      "X-Stream-Error": "true",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });

  if (headers.sessionId) response.headers.set("X-Session-Id", headers.sessionId);
  if (headers.resourceId) response.headers.set("X-Resource-Id", headers.resourceId);

  return response;
}

// ============================================
// Main Function
// ============================================

/**
 * 创建 NexusNote 流式响应
 *
 * 特性：
 * - 中文流式分词优化
 * - 错误时 Graceful 降级
 * - 自动添加响应头
 */
export async function createNexusNoteStreamResponse<
  CALL_OPTIONS = never,
  TOOLS extends ToolSet = ToolSet,
>(
  agent: Agent<CALL_OPTIONS, TOOLS, never>,
  messages: UIMessage[],
  options: StreamOptions = {},
): Promise<Response> {
  const {
    sessionId,
    resourceId,
    presentation = "chat",
    sendReasoning = false,
    onFinish,
    consumeSseStream,
  } = options;

  try {
    const modelMessages = await convertToModelMessages(messages, {
      tools: agent.tools,
    });

    const result = await agent.stream({
      prompt: modelMessages,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-Hans", { granularity: "word" }),
      }),
    });

    const response = createPresentationFilteredStreamResponse({
      stream: result.toUIMessageStream({
        sendReasoning,
      }),
      originalMessages: messages,
      allowedPresentation: presentation,
      onError: getFallbackMessage,
      onFinish,
      consumeSseStream,
    });

    if (sessionId) response.headers.set("X-Session-Id", sessionId);
    if (resourceId) response.headers.set("X-Resource-Id", resourceId);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return response;
  } catch (error) {
    console.error("[Streaming] Error:", error);

    const response = createFallbackStream(getFallbackMessage(error), { sessionId, resourceId });
    const degradation = classifyAIDegradation(error);
    if (degradation) {
      response.headers.set("X-AI-Degraded", degradation.kind);
    }
    return response;
  }
}
