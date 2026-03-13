// hooks/useInterview.ts

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";
import { type OutlineData, useInterviewStore } from "@/stores/interview";

interface ConfirmOutlineOutput {
  success: boolean;
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

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());

  const setOutline = useInterviewStore((s) => s.setOutline);
  const setCourseId = useInterviewStore((s) => s.setCourseId);
  const setIsOutlineLoading = useInterviewStore((s) => s.setIsOutlineLoading);
  const setInterviewCompleted = useInterviewStore((s) => s.setInterviewCompleted);

  const chat = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      body: () => ({ sessionId, courseId: useInterviewStore.getState().courseId ?? undefined }),
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        const newCourseId = response.headers.get("X-Resource-Id");
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

  // Monitor confirmOutline tool output
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      if (!msg.parts) continue;

      const confirmPart = msg.parts.find(
        (p) =>
          isToolUIPart(p) &&
          getToolName(p) === "confirmOutline" &&
          p.state === "output-available",
      );

      if (confirmPart && isToolUIPart(confirmPart)) {
        const output = confirmPart.output as ConfirmOutlineOutput | undefined;
        if (output?.success && output.outline) {
          setOutline(output.outline);
          setInterviewCompleted(true);
          setIsOutlineLoading(false);
          return;
        }
      }
    }
  }, [messages, setOutline, setInterviewCompleted, setIsOutlineLoading]);

  const isLoading = status === "submitted" || status === "streaming";

  return {
    messages: chat.messages as UIMessage[],
    sendMessage: chat.sendMessage,
    status,
    isLoading,
    sessionId,
  };
}
