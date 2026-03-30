import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { getToolUIPresentation, type ToolUIPresentation } from "@/lib/ai/tools/shared";

function shouldForwardTool(toolName: string, allowedPresentation: ToolUIPresentation): boolean {
  return getToolUIPresentation(toolName) === allowedPresentation;
}

async function forwardFilteredChunks(
  stream: ReadableStream<UIMessageChunk>,
  writer: {
    write: (chunk: UIMessageChunk) => void;
  },
  allowedPresentation: ToolUIPresentation,
) {
  const reader = stream.getReader();
  const visibleToolCallIds = new Map<string, boolean>();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      if (!value) {
        continue;
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

export function createPresentationFilteredStreamResponse({
  stream,
  originalMessages,
  allowedPresentation,
  headers,
  onError,
  onFinish,
  consumeSseStream,
}: {
  stream: ReadableStream<UIMessageChunk>;
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
}) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages,
      onFinish,
      execute: async ({ writer }) => {
        await forwardFilteredChunks(stream, writer, allowedPresentation);
      },
      onError,
    }),
    headers,
    consumeSseStream,
  });
}
