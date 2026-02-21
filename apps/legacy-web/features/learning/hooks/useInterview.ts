"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InterviewAgentMessage } from "@/features/learning/agent/interview-agent";
import type { InterviewPhase } from "@/features/learning/types";
import { findToolCall } from "@/features/shared/ai/ui-utils";

interface UseInterviewOptions {
  initialGoal: string;
  sessionId?: string;
}

export function useInterview({ initialGoal, sessionId: initialSessionId }: UseInterviewOptions) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? null);
  const [phase, setPhase] = useState<InterviewPhase>("interviewing");
  const [input, setInput] = useState("");
  const hasStartedRef = useRef(false);

  // 使用 useRef 保存最新状态，避免闭包问题
  const stateRef = useRef({ sessionId, initialGoal });

  useEffect(() => {
    stateRef.current = { sessionId, initialGoal };
  }, [sessionId, initialGoal]);

  // 使用 useMemo 缓存 transport 实例
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: () => {
          const { sessionId: currentSessionId, initialGoal: currentInitialGoal } = stateRef.current;
          return {
            explicitIntent: "INTERVIEW",
            sessionId: currentSessionId,
            initialGoal: !currentSessionId ? currentInitialGoal : undefined,
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, stop } = useChat<InterviewAgentMessage>({
    transport,
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
  // Server-side tool: state is "output-available" after execution
  const lastMsg = messages.at(-1);
  const proposeOutlineTool =
    lastMsg?.role === "assistant"
      ? findToolCall<{ summary: string; suggestedTitle: string }>(lastMsg, "proposeOutline")
      : null;

  useEffect(() => {
    if (proposeOutlineTool?.state === "output-available" && phase === "interviewing") {
      setPhase("proposing");
    }
  }, [proposeOutlineTool?.state, phase]);

  // ─── 选项点击 ───
  // Server-side tool: 发送选项作为用户消息，AI 会自动继续
  const handleOptionSelect = useCallback(
    (toolCallId: string, selected: string) => {
      console.log("[useInterview] handleOptionSelect called (server-side)", {
        toolCallId,
        selected,
      });
      sendMessage({ text: selected });
    },
    [sendMessage],
  );

  // ─── 发送消息（打字或选项）───
  const handleSendMessage = useCallback(
    (e?: React.FormEvent, overrideInput?: string) => {
      e?.preventDefault();
      const text = overrideInput ?? input;
      if (!text.trim()) return;
      if (!overrideInput) setInput("");
      sendMessage({ text });
    },
    [input, sendMessage],
  );

  // ─── 确认大纲 ───
  // Server-side tool: 发送确认消息，AI 会自动处理
  const handleConfirmOutline = useCallback(() => {
    if (!proposeOutlineTool) return;
    sendMessage({ text: "确认，开始生成课程" });
    setPhase("reviewing");
  }, [proposeOutlineTool, sendMessage]);

  // ─── 调整（继续对话）───
  const handleAdjustOutline = useCallback(
    (feedback: string) => {
      if (!proposeOutlineTool) return;
      sendMessage({ text: `调整建议: ${feedback}` });
      setPhase("interviewing");
    },
    [proposeOutlineTool, sendMessage],
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
      proposeOutlineTool?.state === "output-available"
        ? (proposeOutlineTool.output as {
            summary: string;
            suggestedTitle: string;
          })
        : null,
  };
}
