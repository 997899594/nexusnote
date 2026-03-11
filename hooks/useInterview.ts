/**
 * useInterview - 简化版访谈 Hook
 *
 * 2026 架构：
 * - 调用 /api/interview
 * - 监听 updateProfile 和 confirmOutline 工具结果
 * - 工具返回数据直接更新 store，不额外请求接口
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";
import {
  type InterviewProfileState,
  type LearningLevel,
  type OutlineData,
  useInterviewStore,
} from "@/stores/interview";

// Type guard for tool parts
function isToolPart(part: { type: string }): part is ToolUIPart {
  return part.type.startsWith("tool-");
}

// Tool output types - match lib/ai/tools/interview/index.ts
interface UpdateProfileOutput {
  success: boolean;
  profile?: {
    goal: string | null;
    background: LearningLevel | null;
    outcome: string | null;
  };
  error?: string;
}

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
  addToolOutput: (params: { tool: string; toolCallId: string; output: unknown }) => Promise<void>;
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());

  // Get store setters
  const setProfile = useInterviewStore((s) => s.setProfile);
  const setOutline = useInterviewStore((s) => s.setOutline);
  const setCourseId = useInterviewStore((s) => s.setCourseId);
  const setIsOutlineLoading = useInterviewStore((s) => s.setIsOutlineLoading);
  const setInterviewCompleted = useInterviewStore((s) => s.setInterviewCompleted);

  const chat = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      // 直接从 store 读取最新 courseId，避免 useEffect 更新延迟导致的竞态条件
      body: () => ({ sessionId, courseId: useInterviewStore.getState().courseId ?? undefined }),
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        // 服务端通过 X-Resource-Id 返回新创建的 courseId
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

  const { sendMessage, status, addToolOutput, messages } = chat;

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

  // 监听工具调用结果
  useEffect(() => {
    // 遍历所有消息，找到最近的工具调用
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;

      const toolParts = msg.parts?.filter(isToolPart);

      if (!toolParts || toolParts.length === 0) continue;

      // 检查 confirmOutline
      const confirmPart = toolParts.find(
        (p) => p.type === "tool-confirmOutline" && p.state === "output-available",
      );
      if (confirmPart) {
        const output = confirmPart.output as ConfirmOutlineOutput | undefined;
        if (output?.success && output.outline) {
          setOutline(output.outline);
          setInterviewCompleted(true);
          setIsOutlineLoading(false);
          return;
        }
      }

      // 检查 updateProfile
      const updatePart = toolParts.find(
        (p) => p.type === "tool-updateProfile" && p.state === "output-available",
      );
      if (updatePart) {
        const output = updatePart.output as UpdateProfileOutput | undefined;
        if (output?.success && output.profile) {
          setProfile({
            goal: output.profile.goal,
            background: output.profile.background,
            outcome: output.profile.outcome,
          });
          return;
        }
      }
    }
  }, [messages, setProfile, setOutline, setInterviewCompleted, setIsOutlineLoading]);

  // AI SDK v6: isLoading is derived from status
  const isLoading = status === "submitted" || status === "streaming";

  return {
    messages: chat.messages as UIMessage[],
    sendMessage: chat.sendMessage,
    status,
    isLoading,
    sessionId,
    addToolOutput,
  };
}
