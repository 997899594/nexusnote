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
  DEFAULT_INTERVIEW_SESSION_MODE,
  type InterviewSessionMode,
  normalizeInterviewSessionMode,
} from "@/lib/ai/interview/session-mode";
import {
  findLatestOutline,
  findLatestStableOutline,
  getInterviewMessageOptions,
  getInterviewMessageText,
  type InterviewUIMessage,
} from "@/lib/ai/interview/ui";
import { isUnauthorizedError, parseApiError, redirectToLogin } from "@/lib/api/client";

export interface InterviewMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode?: "question" | "outline";
  options?: string[];
}

interface UseInterviewOptions {
  initialMessage?: string;
  initialMode?: InterviewSessionMode;
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
  sessionMode: InterviewSessionMode;
  setSessionMode: (mode: InterviewSessionMode) => void;
  canChangeMode: boolean;
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
    .map((message) => {
      const mode: InterviewMessage["mode"] =
        message.role === "assistant"
          ? findLatestOutline([message])
            ? "outline"
            : "question"
          : undefined;

      return {
        id: message.id,
        role: message.role,
        text: getInterviewMessageText(message),
        mode,
        options: message.role === "assistant" ? getInterviewMessageOptions(message) : undefined,
      };
    })
    .filter((message) => message.text.length > 0 || (message.options?.length ?? 0) > 0);
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());
  const [aiDegradedKind, setAIDegradedKind] = useState<AIDegradationKind | null>(null);
  const [stableOutline, setStableOutlineState] = useState<InterviewOutline | null>(null);
  const [courseId, setCourseIdState] = useState<string | null>(null);
  const [isOutlineLoading, setIsOutlineLoading] = useState(false);
  const [sessionMode, setSessionModeState] = useState<InterviewSessionMode>(() =>
    normalizeInterviewSessionMode(options?.initialMode ?? DEFAULT_INTERVIEW_SESSION_MODE),
  );
  const [isModeLocked, setIsModeLocked] = useState(() => Boolean(options?.initialMessage));

  const stableOutlineRef = useRef<InterviewOutline | null>(null);
  const courseIdRef = useRef<string | null>(null);
  const sessionModeRef = useRef<InterviewSessionMode>(sessionMode);
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

  useEffect(() => {
    const normalizedMode = normalizeInterviewSessionMode(
      options?.initialMode ?? DEFAULT_INTERVIEW_SESSION_MODE,
    );

    if (isModeLocked) {
      return;
    }

    sessionModeRef.current = normalizedMode;
    setSessionModeState(normalizedMode);
  }, [isModeLocked, options?.initialMode]);

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
        mode: sessionModeRef.current,
      }),
    }),
    onFinish: ({ messages: finishedMessages }) => {
      const stableResult = findLatestStableOutline(finishedMessages);
      if (stableResult?.outline) {
        setStableOutline(stableResult.outline);
      }
      setIsOutlineLoading(false);
    },
    onError: (error) => {
      setIsOutlineLoading(false);
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
  const canChangeMode = !isModeLocked && messages.length === 0;
  const displayMessages = toInterviewDisplayMessages(messages);
  const isLoading = status === "submitted" || status === "streaming";
  const liveOutlineResult = findLatestOutline(messages);
  const latestAssistantMessage = [...displayMessages]
    .reverse()
    .find((message) => message.role === "assistant");
  const displayOutline: OutlineDisplay | null =
    isLoading && liveOutlineResult?.outline ? liveOutlineResult.outline : stableOutline;
  const outline: InterviewOutlineState = {
    display: displayOutline,
    stable: stableOutline,
    actions:
      latestAssistantMessage?.mode === "outline" ? (latestAssistantMessage.options ?? []) : [],
    isLoading: isOutlineLoading,
    isReady: stableOutline != null,
  };
  const course: InterviewCourseState = {
    id: courseId,
    setId: setCourseId,
  };

  useEffect(() => {
    if (messages.length > 0 && !isModeLocked) {
      setIsModeLocked(true);
    }
  }, [isModeLocked, messages.length]);

  useEffect(() => {
    if (liveOutlineResult?.outline) {
      setIsOutlineLoading(!liveOutlineResult.isComplete);
      return;
    }

    if (!isLoading) {
      setIsOutlineLoading(false);
    }
  }, [isLoading, liveOutlineResult]);

  const setSessionMode = useCallback(
    (nextMode: InterviewSessionMode) => {
      if (isModeLocked) {
        return;
      }

      sessionModeRef.current = nextMode;
      setSessionModeState(nextMode);
    },
    [isModeLocked],
  );

  const sendMessage = useCallback(
    async ({ text }: { text: string }) => {
      const nextText = text.trim();
      if (!nextText) {
        return;
      }

      if (!isModeLocked) {
        setIsModeLocked(true);
      }

      if (stableOutlineRef.current) {
        setIsOutlineLoading(true);
      }

      await chat.sendMessage({ text: nextText });
    },
    [chat, isModeLocked],
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
    sessionMode,
    setSessionMode,
    canChangeMode,
  };
}
