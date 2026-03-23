// hooks/useInterview.ts

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";
import { type OutlineData, useInterviewStore } from "@/stores/interview";

interface ConfirmOutlineOutput {
  success: boolean;
  courseId?: string;
  outline?: OutlineData;
  error?: string;
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
}

/**
 * 从消息列表中提取最新的 confirmOutline 输出
 */
function findLatestOutline(messages: UIMessage[]): ConfirmOutlineOutput | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant" || !msg.parts) continue;

    for (const part of msg.parts) {
      if (
        isToolUIPart(part) &&
        getToolName(part) === "confirmOutline" &&
        part.state === "output-available"
      ) {
        const output = part.output as ConfirmOutlineOutput | undefined;
        if (output?.success && output.outline) {
          return output;
        }
      }
    }
  }
  return null;
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());

  const setOutline = useInterviewStore((s) => s.setOutline);
  const setCourseId = useInterviewStore((s) => s.setCourseId);
  const setIsOutlineLoading = useInterviewStore((s) => s.setIsOutlineLoading);
  const setInterviewCompleted = useInterviewStore((s) => s.setInterviewCompleted);
  const resetInterview = useInterviewStore((s) => s.reset);

  // 稳定引用，供 onFinish 使用
  const storeActionsRef = useRef({ setOutline, setInterviewCompleted, setIsOutlineLoading });
  storeActionsRef.current = { setOutline, setInterviewCompleted, setIsOutlineLoading };

  useEffect(() => {
    resetInterview();
  }, [resetInterview]);

  const chat = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      body: () => ({ sessionId, courseId: useInterviewStore.getState().courseId ?? undefined }),
    }),
    // 流结束时可靠检测 confirmOutline（主要检测入口）
    onFinish: ({ messages: finishedMessages }) => {
      const result = findLatestOutline(finishedMessages);
      if (result?.outline) {
        const actions = storeActionsRef.current;
        if (result.courseId) {
          setCourseId(result.courseId);
        }
        actions.setOutline(result.outline);
        actions.setInterviewCompleted(true);
        actions.setIsOutlineLoading(false);
      }
    },
    onError: (error) => {
      console.error("[Interview] API Error:", error);
      parseApiError(error).then(({ message }) => {
        addToast(message, "error");
      });
    },
  });

  const { sendMessage, status, messages } = chat;

  // Auto-send initial message
  const sentInitialRef = useRef(false);
  const initialMessageRef = useRef(options?.initialMessage);

  useEffect(() => {
    initialMessageRef.current = options?.initialMessage;
  }, [options?.initialMessage]);

  useEffect(() => {
    const msg = initialMessageRef.current;
    if (msg && !sentInitialRef.current) {
      sentInitialRef.current = true;
      requestAnimationFrame(() => {
        sendMessage({ text: msg });
      });
    }
  }, [sendMessage]);

  // 备用检测：流式过程中也尝试检测（增加 status 依赖确保流结束时触发）
  // biome-ignore lint/correctness/useExhaustiveDependencies: status is intentionally included to trigger detection when streaming ends
  useEffect(() => {
    const result = findLatestOutline(messages);
    if (result?.outline) {
      if (result.courseId) {
        setCourseId(result.courseId);
      }
      setOutline(result.outline);
      setInterviewCompleted(true);
      setIsOutlineLoading(false);
    }
  }, [messages, status, setCourseId, setOutline, setInterviewCompleted, setIsOutlineLoading]);

  const isLoading = status === "submitted" || status === "streaming";

  return {
    messages: chat.messages as UIMessage[],
    sendMessage: chat.sendMessage,
    status,
    isLoading,
    sessionId,
  };
}
