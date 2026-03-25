// hooks/useInterview.ts

import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { InterviewStreamEvent, InterviewTurn } from "@/lib/ai/interview";
import { isUnauthorizedError, parseApiError, redirectToLogin } from "@/lib/api/client";
import { useInterviewStore } from "@/stores/interview";

export interface InterviewMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  options?: string[];
}

interface UseInterviewOptions {
  initialMessage?: string;
}

interface UseInterviewReturn {
  messages: InterviewMessage[];
  sendMessage: (params: { text: string }) => Promise<void>;
  status: string;
  isLoading: boolean;
  sessionId: string;
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [status, setStatus] = useState("ready");

  const setOutline = useInterviewStore((s) => s.setOutline);
  const setCourseId = useInterviewStore((s) => s.setCourseId);
  const setIsOutlineLoading = useInterviewStore((s) => s.setIsOutlineLoading);
  const setInterviewCompleted = useInterviewStore((s) => s.setInterviewCompleted);
  const resetInterview = useInterviewStore((s) => s.reset);

  const messagesRef = useRef<InterviewMessage[]>([]);
  messagesRef.current = messages;

  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    resetInterview();
    setMessages([]);
  }, [resetInterview]);

  const updateAssistantMessage = useCallback(
    (assistantId: string, updater: (message: InterviewMessage) => InterviewMessage) => {
      setMessages((currentMessages) =>
        currentMessages.map((message) => (message.id === assistantId ? updater(message) : message)),
      );
    },
    [],
  );

  const applyCompletedTurn = useCallback(
    (turn: InterviewTurn, courseId?: string) => {
      if (turn.kind === "outline") {
        setOutline(turn.outline);
        setCourseId(courseId ?? null);
        setInterviewCompleted(true);
        setIsOutlineLoading(false);
      }
    },
    [setCourseId, setInterviewCompleted, setIsOutlineLoading, setOutline],
  );

  const sendMessage = useCallback(
    async ({ text }: { text: string }) => {
      if (!text.trim() || statusRef.current === "submitted" || statusRef.current === "streaming") {
        return;
      }

      const userMessage: InterviewMessage = {
        id: nanoid(),
        role: "user",
        text: text.trim(),
      };
      const assistantId = nanoid();
      const assistantMessage: InterviewMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        options: [],
      };
      const nextMessages = [...messagesRef.current, userMessage, assistantMessage];

      setMessages(nextMessages);
      setStatus("submitted");

      try {
        const store = useInterviewStore.getState();
        const response = await fetch("/api/interview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            courseId: store.courseId ?? undefined,
            outline: store.outline ?? undefined,
            messages: nextMessages.map((message) => ({
              id: message.id,
              role: message.role,
              text: message.text,
            })),
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            redirectToLogin();
            return;
          }
          throw response;
        }

        if (!response.body) {
          throw new Error("响应为空");
        }

        setStatus("streaming");

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              continue;
            }

            const event = JSON.parse(trimmed) as InterviewStreamEvent;

            if (event.type === "turn-delta") {
              updateAssistantMessage(assistantId, (message) => ({
                ...message,
                text: event.turn.message ?? message.text,
                options: event.turn.options ?? message.options,
              }));
              continue;
            }

            if (event.type === "turn-complete") {
              updateAssistantMessage(assistantId, (message) => ({
                ...message,
                text: event.turn.message,
                options: event.turn.options,
              }));
              applyCompletedTurn(event.turn, event.courseId);
              continue;
            }

            if (event.type === "error") {
              throw new Error(event.error);
            }
          }
        }

        setStatus("ready");
      } catch (error) {
        console.error("[Interview] API Error:", error);
        const parsed = await parseApiError(error);
        if (isUnauthorizedError(parsed.status, parsed.code)) {
          redirectToLogin();
          return;
        }
        addToast(parsed.message, "error");
        setStatus("error");
      }
    },
    [addToast, applyCompletedTurn, sessionId, updateAssistantMessage],
  );

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
        void sendMessage({ text: msg });
      });
    }
  }, [sendMessage]);

  const isLoading = status === "submitted" || status === "streaming";

  return {
    messages,
    sendMessage,
    status: status === "error" ? "ready" : status,
    isLoading,
    sessionId,
  };
}
