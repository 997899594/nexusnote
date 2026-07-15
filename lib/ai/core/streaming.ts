// lib/ai/core/streaming.ts

import {
  type Agent,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type InferUIMessageChunk,
  smoothStream,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
  type UIMessageStreamWriter,
} from "ai";
import { classifyAIDegradation } from "@/lib/ai/core/degradation";
import {
  getToolUIPresentation,
  type ToolUIPresentation,
} from "@/lib/ai/tools/shared/display-contract";
import { recordChatTimeToFirstToken } from "@/lib/observability/metrics";

export interface StreamObservability {
  endpoint: string;
  startedAt: number;
}

function createFirstTextTokenObserver(observability?: StreamObservability) {
  if (!observability) return undefined;
  return () => {
    recordChatTimeToFirstToken(observability.endpoint, Date.now() - observability.startedAt);
  };
}

export interface StreamOptions {
  /** 会话 ID */
  sessionId?: string;
  /** 资源 ID */
  resourceId?: string;
  /** 允许下发的工具展示类型 */
  presentation?: "chat" | "interview";
  /** 是否向前端发送 reasoning */
  sendReasoning?: boolean;
  /** 服务端写入的权威 UI 数据片段 */
  dataParts?: UIMessageChunk[];
  /** 仅用于模型 prompt 的上下文视图；完整 messages 仍用于 UI 与持久化。 */
  modelMessages?: UIMessage[];
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
  observability?: StreamObservability;
}

// ============================================
// Fallback Messages
// ============================================

const FALLBACK_MESSAGES = {
  timeout: "抱歉，响应超时，请稍后重试。",
  rate_limit: "请求过于频繁，请稍后再试。",
  model_error: "助手暂时不可用，请稍后重试。",
  unknown: "抱歉，服务出现异常，请稍后重试。",
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

function shouldForwardTool(toolName: string, allowedPresentation: ToolUIPresentation): boolean {
  const presentation = getToolUIPresentation(toolName);
  return presentation === allowedPresentation || presentation === "state";
}

async function forwardFilteredChunks(
  stream: ReadableStream<UIMessageChunk>,
  writer: {
    write: (chunk: UIMessageChunk) => void;
  },
  allowedPresentation: ToolUIPresentation,
  onFirstTextToken?: () => void,
) {
  const reader = stream.getReader();
  const visibleToolCallIds = new Map<string, boolean>();
  let firstTextTokenObserved = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      if (!firstTextTokenObserved && value.type === "text-delta" && value.delta.length > 0) {
        firstTextTokenObserved = true;
        onFirstTextToken?.();
      }

      switch (value.type) {
        case "tool-input-start":
        case "tool-input-delta":
        case "tool-input-available":
        case "tool-input-error": {
          const toolName = "toolName" in value ? value.toolName : null;
          const toolCallId = value.toolCallId;
          const visible =
            toolName == null
              ? (visibleToolCallIds.get(toolCallId) ?? false)
              : shouldForwardTool(toolName, allowedPresentation);

          visibleToolCallIds.set(toolCallId, visible);
          if (visible) {
            writer.write(value);
          }
          break;
        }

        case "tool-output-available":
        case "tool-output-error":
        case "tool-output-denied":
        case "tool-approval-request": {
          if (visibleToolCallIds.get(value.toolCallId)) {
            writer.write(value);
          }
          break;
        }

        default:
          writer.write(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
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

export function createStaticAssistantMessageResponse(params: {
  text: string;
  headers?: HeadersInit;
}) {
  const textId = "static-text-0";

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: params.text });
        writer.write({ type: "text-end", id: textId });
      },
    }),
    headers: params.headers,
  });
}

export async function streamAgentIntoWriter<
  CALL_OPTIONS = never,
  TOOLS extends ToolSet = ToolSet,
>(params: {
  writer: UIMessageStreamWriter;
  agent: Agent<CALL_OPTIONS, TOOLS, never>;
  messages: UIMessage[];
  presentation: "chat" | "interview";
  sendReasoning?: boolean;
  observability?: StreamObservability;
}) {
  const modelMessages = await convertToModelMessages(params.messages, {
    tools: params.agent.tools,
  });
  const result = await params.agent.stream({
    prompt: modelMessages,
    experimental_transform: smoothStream({
      chunking: new Intl.Segmenter("zh-Hans", { granularity: "word" }),
    }),
  });
  const filteredStream = createFilteredUIMessageStream({
    stream: result.toUIMessageStream({
      sendReasoning: params.sendReasoning ?? false,
    }) as ReadableStream<UIMessageChunk>,
    allowedPresentation: params.presentation,
    onFirstTextToken: createFirstTextTokenObserver(params.observability),
  });

  params.writer.merge(filteredStream);
}

function createFilteredUIMessageStream({
  stream,
  allowedPresentation,
  onFirstTextToken,
}: {
  stream: ReadableStream<UIMessageChunk>;
  allowedPresentation: ToolUIPresentation;
  onFirstTextToken?: () => void;
}) {
  return createUIMessageStream({
    execute: async ({ writer }) => {
      await forwardFilteredChunks(stream, writer, allowedPresentation, onFirstTextToken);
    },
  });
}

export function createNexusNoteDeferredStreamResponse(params: {
  originalMessages: UIMessage[];
  sessionId?: string;
  resourceId?: string;
  headers?: HeadersInit;
  execute: (options: {
    writer: UIMessageStreamWriter;
    writeData: (part: UIMessageChunk) => void;
  }) => Promise<void> | void;
  onFinish?: (options: {
    messages: UIMessage[];
    isContinuation: boolean;
    isAborted: boolean;
    responseMessage: UIMessage;
    finishReason?: "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other";
  }) => Promise<void> | void;
}) {
  const response = createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: params.originalMessages,
      onFinish: params.onFinish,
      execute: async ({ writer }) => {
        await params.execute({
          writer,
          writeData: (part) => {
            writer.write(part as InferUIMessageChunk<UIMessage>);
          },
        });
      },
      onError: getFallbackMessage,
    }),
    headers: params.headers,
  });

  if (params.sessionId) response.headers.set("X-Session-Id", params.sessionId);
  if (params.resourceId) response.headers.set("X-Resource-Id", params.resourceId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

  return response;
}

function createPresentationFilteredStreamResponse({
  stream,
  dataParts,
  originalMessages,
  allowedPresentation,
  headers,
  onError,
  onFinish,
  consumeSseStream,
  observability,
}: {
  stream: ReadableStream<UIMessageChunk>;
  dataParts?: UIMessageChunk[];
  originalMessages?: UIMessage[];
  allowedPresentation: ToolUIPresentation;
  headers?: HeadersInit;
  onError?: (error: unknown) => string;
  onFinish?: (options: {
    messages: UIMessage[];
    isContinuation: boolean;
    isAborted: boolean;
    responseMessage: UIMessage;
    finishReason?: "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other";
  }) => Promise<void> | void;
  consumeSseStream?: (options: { stream: ReadableStream<string> }) => Promise<void> | void;
  observability?: StreamObservability;
}) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages,
      onFinish,
      execute: async ({ writer }) => {
        for (const part of dataParts ?? []) {
          writer.write(part);
        }
        await forwardFilteredChunks(
          stream,
          writer,
          allowedPresentation,
          createFirstTextTokenObserver(observability),
        );
      },
      onError,
    }),
    headers,
    consumeSseStream,
  });
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
    dataParts,
    modelMessages,
    onFinish,
    consumeSseStream,
    observability,
  } = options;

  try {
    const promptMessages = await convertToModelMessages(modelMessages ?? messages, {
      tools: agent.tools,
    });

    const result = await agent.stream({
      prompt: promptMessages,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-Hans", { granularity: "word" }),
      }),
    });

    const response = createPresentationFilteredStreamResponse({
      stream: result.toUIMessageStream({
        sendReasoning,
      }),
      dataParts,
      originalMessages: messages,
      allowedPresentation: presentation,
      onError: getFallbackMessage,
      onFinish,
      consumeSseStream,
      observability,
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
