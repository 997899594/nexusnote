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

  const { sendMessage, status } = chat;

  // 自动发送初始消息
  const sentInitial = useRef(false);
  useEffect(() => {
    if (options?.initialMessage && !sentInitial.current && chat.messages.length === 0) {
      sentInitial.current = true;
      sendMessage({ text: options.initialMessage });
    }
  }, [options?.initialMessage, sendMessage, chat.messages.length]);

  return {
    messages: chat.messages as UIMessage[],
    sendMessage: chat.sendMessage,
    status,
    // @ts-expect-error AI SDK 6.0 compatibility
    isLoading: chat.isLoading,
    sessionId,
  };
}
