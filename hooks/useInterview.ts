import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  findLatestOutline,
  getInterviewMessageOptions,
  getInterviewMessageText,
  type InterviewUIMessage,
} from "@/lib/ai/interview/ui";
import { isUnauthorizedError, parseApiError, redirectToLogin } from "@/lib/api/client";
import { type OutlineData, useInterviewStore } from "@/stores/interview";

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

function toInterviewDisplayMessages(messages: InterviewUIMessage[]): InterviewMessage[] {
  return messages
    .filter(
      (
        message,
      ): message is InterviewUIMessage & {
        role: "user" | "assistant";
      } => message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      id: message.id,
      role: message.role,
      text: getInterviewMessageText(message),
      options: message.role === "assistant" ? getInterviewMessageOptions(message) : undefined,
    }))
    .filter((message) => message.text.length > 0 || (message.options?.length ?? 0) > 0);
}

function hasCompleteOutline(outline: OutlineData | null | undefined) {
  if (
    !outline?.title ||
    !outline.description ||
    !outline.targetAudience ||
    !outline.learningOutcome
  ) {
    return false;
  }

  if (!outline.difficulty || outline.chapters.length < 5) {
    return false;
  }

  return outline.chapters.every(
    (chapter) =>
      chapter.title &&
      chapter.description &&
      chapter.sections.length >= 4 &&
      chapter.sections.every((section) => section.title && section.description),
  );
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());

  const setOutline = useInterviewStore((s) => s.setOutline);
  const setIsOutlineLoading = useInterviewStore((s) => s.setIsOutlineLoading);
  const setInterviewCompleted = useInterviewStore((s) => s.setInterviewCompleted);
  const resetInterview = useInterviewStore((s) => s.reset);

  const storeActionsRef = useRef({ setOutline, setInterviewCompleted, setIsOutlineLoading });
  storeActionsRef.current = { setOutline, setInterviewCompleted, setIsOutlineLoading };

  useEffect(() => {
    resetInterview();
  }, [resetInterview]);

  const originalFetch = fetch as typeof globalThis.fetch & {
    preconnect?: (input: string | URL) => void;
  };

  const interviewFetch = Object.assign(
    async (input: URL | RequestInfo, init?: RequestInit) => {
      const response = await fetch(input, init);
      if (response.status === 401) {
        redirectToLogin();
      }
      return response;
    },
    {
      preconnect:
        typeof originalFetch.preconnect === "function"
          ? originalFetch.preconnect.bind(originalFetch)
          : (_input: string | URL) => {},
    },
  ) as typeof fetch;

  const chat = useChat<InterviewUIMessage>({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      body: () => ({
        sessionId,
        courseId: useInterviewStore.getState().courseId ?? undefined,
        outline: useInterviewStore.getState().outline ?? undefined,
      }),
      fetch: interviewFetch,
    }),
    onFinish: ({ messages: finishedMessages }) => {
      const result = findLatestOutline(finishedMessages);
      const actions = storeActionsRef.current;

      if (result?.outline) {
        actions.setOutline(result.outline);
        actions.setInterviewCompleted(hasCompleteOutline(result.outline));
      }

      actions.setIsOutlineLoading(false);
    },
    onError: (error) => {
      console.error("[Interview] API Error:", error);
      parseApiError(error).then(({ message, status, code }) => {
        if (isUnauthorizedError(status, code)) {
          redirectToLogin();
          return;
        }
        addToast(message, "error");
      });
    },
  });

  const { messages, status } = chat;

  const sentInitialRef = useRef(false);
  const initialMessageRef = useRef(options?.initialMessage);

  useEffect(() => {
    initialMessageRef.current = options?.initialMessage;
  }, [options?.initialMessage]);

  const sendMessage = useCallback(
    async ({ text }: { text: string }) => {
      const nextText = text.trim();
      if (!nextText) {
        return;
      }

      if (useInterviewStore.getState().interviewCompleted) {
        setIsOutlineLoading(true);
      }

      await chat.sendMessage({ text: nextText });
    },
    [chat, setIsOutlineLoading],
  );

  useEffect(() => {
    const msg = initialMessageRef.current;
    if (msg && !sentInitialRef.current) {
      sentInitialRef.current = true;
      requestAnimationFrame(() => {
        void sendMessage({ text: msg });
      });
    }
  }, [sendMessage]);

  useEffect(() => {
    const result = findLatestOutline(messages);
    if (result?.outline) {
      setOutline(result.outline);
      setInterviewCompleted(hasCompleteOutline(result.outline));
      setIsOutlineLoading(!result.isComplete);
    }
  }, [messages, setInterviewCompleted, setIsOutlineLoading, setOutline]);

  const isLoading = status === "submitted" || status === "streaming";
  return {
    messages: toInterviewDisplayMessages(messages),
    sendMessage,
    status,
    isLoading,
    sessionId,
  };
}
