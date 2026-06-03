import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { type AIDegradationKind, createAIDegradationAwareFetch } from "@/lib/ai/core/degradation";
import type {
  InterviewCourseState,
  InterviewOutlineState,
  OutlineDisplay,
} from "@/lib/ai/interview/models";
import type { InterviewOutline } from "@/lib/ai/interview/schemas";
import {
  findLatestOutline,
  findLatestOutlineSinceLastUser,
  findLatestResearchEvidence,
  findLatestStableOutline,
  type InterviewDisplayMessage,
  type InterviewUIMessage,
  toInterviewDisplayMessages,
} from "@/lib/ai/interview/ui";
import { isUnauthorizedError, parseApiError, redirectToLogin } from "@/lib/api/client";

export type InterviewMessage = InterviewDisplayMessage;

interface UseInterviewOptions {
  initialMessage?: string;
}

interface UseInterviewReturn {
  messages: InterviewMessage[];
  sendMessage: (params: { text: string }) => Promise<void>;
  status: string;
  isLoading: boolean;
  sessionId: string;
  aiDegradedKind: AIDegradationKind | null;
  outline: InterviewOutlineState;
  course: InterviewCourseState;
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());
  const [aiDegradedKind, setAIDegradedKind] = useState<AIDegradationKind | null>(null);
  const [stableOutline, setStableOutlineState] = useState<InterviewOutline | null>(null);
  const [courseId, setCourseIdState] = useState<string | null>(null);

  const stableOutlineRef = useRef<InterviewOutline | null>(null);
  const courseIdRef = useRef<string | null>(null);
  const sentInitialRef = useRef(false);
  const initialMessageRef = useRef(options?.initialMessage);

  const setStableOutline = useCallback((outline: InterviewOutline | null) => {
    stableOutlineRef.current = outline;
    setStableOutlineState(outline);
  }, []);

  const setCourseId = useCallback((nextCourseId: string | null) => {
    courseIdRef.current = nextCourseId;
    setCourseIdState(nextCourseId);
  }, []);

  useEffect(() => {
    initialMessageRef.current = options?.initialMessage;
  }, [options?.initialMessage]);

  const chat = useChat<InterviewUIMessage>({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      fetch: createAIDegradationAwareFetch({
        onStateChange: setAIDegradedKind,
        onUnauthorized: redirectToLogin,
      }),
      body: () => ({
        sessionId,
        courseId: courseIdRef.current ?? undefined,
        outline: stableOutlineRef.current ?? undefined,
      }),
    }),
    onFinish: ({ messages: finishedMessages }) => {
      const stableResult = findLatestStableOutline(finishedMessages);
      if (stableResult?.outline) {
        setStableOutline(stableResult.outline);
      }
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
  const displayMessages = toInterviewDisplayMessages(messages);
  const isLoading = status === "submitted" || status === "streaming";
  const liveOutlineResult = findLatestOutline(messages);
  const currentTurnOutlineResult = findLatestOutlineSinceLastUser(messages);
  const researchEvidence = findLatestResearchEvidence(messages);
  const stableResult = findLatestStableOutline(messages);
  const latestAssistantMessage = [...displayMessages]
    .reverse()
    .find((message) => message.role === "assistant");
  const currentStableOutline = stableResult?.outline ?? stableOutline;
  const displayOutline: OutlineDisplay | null = liveOutlineResult?.outline ?? currentStableOutline;
  const outlineIsLoading = isLoading && !currentTurnOutlineResult?.isComplete;
  const outline: InterviewOutlineState = {
    display: displayOutline,
    stable: currentStableOutline,
    researchEvidence,
    actions:
      liveOutlineResult?.options ??
      (latestAssistantMessage?.mode === "outline" ? (latestAssistantMessage.options ?? []) : []),
    isLoading: outlineIsLoading,
    isReady: currentStableOutline != null,
  };
  const course: InterviewCourseState = {
    id: courseId,
    setId: setCourseId,
  };

  useEffect(() => {
    if (stableResult?.outline && stableOutlineRef.current !== stableResult.outline) {
      setStableOutline(stableResult.outline);
    }
  }, [stableResult, setStableOutline]);

  const sendMessage = useCallback(
    async ({ text }: { text: string }) => {
      const nextText = text.trim();
      if (!nextText) {
        return;
      }

      await chat.sendMessage({ text: nextText });
    },
    [chat],
  );

  useEffect(() => {
    const msg = initialMessageRef.current;
    if (msg && !sentInitialRef.current) {
      sentInitialRef.current = true;
      void sendMessage({ text: msg });
    }
  }, [sendMessage]);

  return {
    messages: displayMessages,
    sendMessage,
    status,
    isLoading,
    sessionId,
    aiDegradedKind,
    outline,
    course,
  };
}
