"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InterviewAgentMessage } from "@/features/learning/agent/interview-agent";
import type { InterviewPhase } from "@/features/learning/types";
import { findToolCall } from "@/features/shared/ai/ui-utils";

interface UseInterviewOptions {
  initialGoal: string;
  sessionId?: string;
}

export function useInterview({
  initialGoal,
  sessionId: initialSessionId,
}: UseInterviewOptions) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? null);
  const [phase, setPhase] = useState<InterviewPhase>("interviewing");
  const [input, setInput] = useState("");
  const hasStartedRef = useRef(false);

  const {
    messages,
    sendMessage,
    addToolOutput,
    status,
    error,
    stop,
  } = useChat<InterviewAgentMessage>({
    body: {
      explicitIntent: "INTERVIEW",
      sessionId,
      initialGoal: !sessionId ? initialGoal : undefined,
    },
    onResponse: (response: Response) => {
      const sid = response.headers.get("X-Session-Id");
      if (sid && !sessionId) {
        setSessionId(sid);
      }
    },
  } as Parameters<typeof useChat<InterviewAgentMessage>>[0]);

  const isLoading = status === "streaming" || status === "submitted";

  // ─── 自动启动 ───
  useEffect(() => {
    if (hasStartedRef.current || messages.length > 0 || !initialGoal) return;
    hasStartedRef.current = true;
    sendMessage({ text: initialGoal });
  }, [initialGoal, messages.length, sendMessage]);

  // ─── 检测 proposeOutline ───
  const lastMsg = messages.at(-1);
  const proposeOutlineTool =
    lastMsg?.role === "assistant"
      ? findToolCall<{ summary: string; suggestedTitle: string }>(
          lastMsg,
          "proposeOutline",
        )
      : null;

  useEffect(() => {
    if (
      proposeOutlineTool?.state === "input-available" &&
      phase === "interviewing"
    ) {
      setPhase("proposing");
    }
  }, [proposeOutlineTool?.state, phase]);

  // ─── 选项点击 ───
  const handleOptionSelect = useCallback(
    (toolCallId: string, selected: string) => {
      (addToolOutput as Function)({
        toolCallId,
        output: { selected },
      });
    },
    [addToolOutput],
  );

  // ─── 发送消息（打字或选项）───
  const handleSendMessage = useCallback(
    (e?: React.FormEvent, overrideInput?: string) => {
      e?.preventDefault();
      const text = overrideInput ?? input;
      if (!text.trim()) return;
      if (!overrideInput) setInput("");

      // 检查是否有 pending 的 client-side tool
      const last = messages.at(-1);
      if (last?.role === "assistant") {
        const pendingSuggest = findToolCall(last, "suggestOptions");
        if (pendingSuggest?.state === "input-available") {
          (addToolOutput as Function)({
            toolCallId: pendingSuggest.toolCallId,
            output: { selected: text },
          });
          return;
        }
      }

      sendMessage({ text });
    },
    [input, messages, addToolOutput, sendMessage],
  );

  // ─── 确认大纲 ───
  const handleConfirmOutline = useCallback(() => {
    if (!proposeOutlineTool) return;
    (addToolOutput as Function)({
      toolCallId: proposeOutlineTool.toolCallId,
      output: { action: "confirm" },
    });
    setPhase("reviewing");
  }, [proposeOutlineTool, addToolOutput]);

  // ─── 调整（继续对话）───
  const handleAdjustOutline = useCallback(
    (feedback: string) => {
      if (!proposeOutlineTool) return;
      (addToolOutput as Function)({
        toolCallId: proposeOutlineTool.toolCallId,
        output: { action: "adjust", feedback },
      });
      setPhase("interviewing");
    },
    [proposeOutlineTool, addToolOutput],
  );

  return {
    sessionId,
    phase,
    messages,
    isLoading,
    error: error?.message,
    input,
    setInput,

    handleSendMessage,
    handleOptionSelect,
    handleConfirmOutline,
    handleAdjustOutline,
    stop,

    proposedOutline:
      proposeOutlineTool?.state === "input-available"
        ? (proposeOutlineTool.input as {
            summary: string;
            suggestedTitle: string;
          })
        : null,
  };
}
