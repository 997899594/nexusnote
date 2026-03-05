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
import type { ConfirmOutlineOutput } from "@/components/chat/tool-result/types";
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

  // 用 ref 确保获取最新值
  const courseIdRef = useRef<string | null>(null);
  const courseId = useInterviewStore((s) => s.courseId);
  useEffect(() => {
    courseIdRef.current = courseId;
  }, [courseId]);

  const chat = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      body: () => ({ sessionId, courseId: courseIdRef.current ?? undefined }),
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        const newCourseId = response.headers.get("X-Course-Id");
        if (newCourseId) {
          setCourseId(newCourseId);
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
    // 遍历所有消息，找到最近的 confirmOutline 调用
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;

      const toolParts = msg.parts
        ?.filter(isToolPart)
        .filter((p) => p.type === "tool-confirmOutline" && p.state === "output-available");

      if (toolParts && toolParts.length > 0) {
        const lastToolPart = toolParts[toolParts.length - 1];
        const output = lastToolPart.output as ConfirmOutlineOutput | undefined;

        if (output?.success && output.outline) {
          setOutline(output.outline);
          setInterviewCompleted(true);
          setIsOutlineLoading(false);
          return; // 找到后立即返回
        }
      }
    }
  }, [messages, setOutline, setInterviewCompleted, setIsOutlineLoading]);

  // AI SDK v6: isLoading is derived from status
  const isLoading = status === "submitted" || status === "streaming";

  return {
    messages: chat.messages as UIMessage[],
    sendMessage: chat.sendMessage,
    status,
    isLoading,
    sessionId,
    addToolOutput,
  };
}
