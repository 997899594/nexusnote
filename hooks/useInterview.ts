/**
 * useInterview - 独立访谈 Hook
 *
 * 2026 架构：
 * - 调用 /api/interview
 * - 无 Persona 干扰
 * - 服务端管理 courseProfileId（存在 conversation.metadata）
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";
import { useInterviewStore } from "@/stores/interview";

// Type guard for tool parts
function isToolPart(part: { type: string }): part is ToolUIPart {
  return part.type.startsWith("tool-");
}

interface UseInterviewOptions {
  initialMessage?: string;
}

interface UseInterviewReturn {
  messages: UIMessage[];
  sendMessage: (params: { text: string }) => void;
  status: string;
  isLoading: boolean;
  sessionId: string;
  addToolOutput: (params: { tool: string; toolCallId: string; output: unknown }) => Promise<void>;
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());

  // Get store setters
  const setOutline = useInterviewStore((s) => s.setOutline);
  const setCourseId = useInterviewStore((s) => s.setCourseId);
  const setIsOutlineLoading = useInterviewStore((s) => s.setIsOutlineLoading);
  const setInterviewCompleted = useInterviewStore((s) => s.setInterviewCompleted);
  const setEstimatedTurns = useInterviewStore((s) => s.setEstimatedTurns);

  const chat = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      body: () => ({ sessionId }),
      // Custom fetch to capture response headers
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        const courseId = response.headers.get("X-Course-Id");
        if (courseId) {
          setCourseId(courseId);
        }
        return response;
      },
    }),
    onError: (error) => {
      console.error("[Interview] API Error:", error);
      parseApiError(error).then(({ message }) => {
        addToast(message, "error");
      });
    },
  });

  const { sendMessage, status, addToolOutput, messages } = chat;

  // 自动发送初始消息（使用 ref 避免重复发送）
  const sentInitialRef = useRef(false);
  const initialMessageRef = useRef(options?.initialMessage);

  useEffect(() => {
    initialMessageRef.current = options?.initialMessage;
  }, [options?.initialMessage]);

  useEffect(() => {
    const msg = initialMessageRef.current;
    if (msg && !sentInitialRef.current) {
      sentInitialRef.current = true;
      // 延迟一帧确保 chat 已初始化
      requestAnimationFrame(() => {
        sendMessage({ text: msg });
      });
    }
  }, [sendMessage]);

  // 监听 confirmOutline 工具调用 - 访谈完成
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    const toolParts = lastMessage.parts
      ?.filter(isToolPart)
      .filter((p) => p.type === "tool-confirmOutline" && p.state === "output-available");

    if (toolParts && toolParts.length > 0) {
      const lastToolPart = toolParts[toolParts.length - 1];
      const output = lastToolPart.output as
        | { outline?: unknown; outlineData?: unknown; success?: boolean }
        | undefined;

      if (output?.success) {
        // 访谈完成，设置大纲和完成状态
        // confirmOutline 可能返回 outline 或 outlineData
        const outlineData = output.outline || output.outlineData;
        if (outlineData) {
          setOutline(outlineData as never);
        }
        setInterviewCompleted(true);
        setIsOutlineLoading(false);
      }
    }
  }, [messages, setOutline, setInterviewCompleted, setIsOutlineLoading]);

  // 监听 assessComplexity 工具调用 - 获取预计轮数
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;

    const toolParts = lastMessage.parts
      ?.filter(isToolPart)
      .filter((p) => p.type === "tool-assessComplexity" && p.state === "output-available");

    if (toolParts && toolParts.length > 0) {
      const lastToolPart = toolParts[toolParts.length - 1];
      const output = lastToolPart.output as
        | { estimatedTurns?: number; success?: boolean }
        | undefined;

      if (output?.success && typeof output.estimatedTurns === "number") {
        setEstimatedTurns(output.estimatedTurns);
      }
    }
  }, [messages, setEstimatedTurns]);

  return {
    messages: chat.messages as UIMessage[],
    sendMessage: chat.sendMessage,
    status,
    // @ts-expect-error AI SDK 6.0 compatibility
    isLoading: chat.isLoading,
    sessionId,
    addToolOutput,
  };
}
