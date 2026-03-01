/**
 * useInterview - 独立访谈 Hook
 *
 * 2026 架构：
 * - 调用 /api/interview
 * - 无 Persona 干扰
 * - 服务端管理 courseProfileId（存在 conversation.metadata）
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";

interface UseInterviewOptions {
  initialMessage?: string;
}

interface UseInterviewReturn {
  messages: UIMessage[];
  sendMessage: (params: { text: string }) => void;
  status: string;
  isLoading: boolean;
  sessionId: string;
  addToolOutput: (params: {
    tool: string;
    toolCallId: string;
    output: unknown;
  }) => Promise<void>;
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());

  const chat = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      body: () => ({ sessionId }),
    }),
    onError: (error) => {
      console.error("[Interview] API Error:", error);
      parseApiError(error).then(({ message }) => {
        addToast(message, "error");
      });
    },
  });

  const { sendMessage, status, addToolOutput } = chat;

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
