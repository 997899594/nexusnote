/**
 * useInterview - 独立访谈 Hook
 *
 * 2026 终极架构：前端状态接力流 (Frontend Handoff Streaming)
 *
 * 流程：
 * 1. useChat 监听访谈对话
 * 2. 当 generateOutline 返回 HANDOFF_TO_ARCHITECT 信号
 * 3. 触发 onOutlineReady 回调
 * 4. 前端切换到 OutlineBuilder 组件
 * 5. OutlineBuilder 向独立 API 流式获取大纲
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";
import { useInterviewStore } from "@/stores/interview";

// Type guard for tool parts
function isToolPart(part: { type: string }): part is ToolUIPart {
  return part.type.startsWith("tool-");
}

// 生成大纲工具的返回类型
interface GenerateOutlineOutput {
  success: boolean;
  signal: string;
  message: string;
  courseId: string;
}

interface UseInterviewOptions {
  initialMessage?: string;
  onOutlineReady?: (courseId: string) => void;
}

interface UseInterviewReturn {
  messages: UIMessage[];
  sendMessage: (params: { text: string }) => void;
  status: string;
  isLoading: boolean;
  sessionId: string;
  addToolOutput: (params: { tool: string; toolCallId: string; output: unknown }) => Promise<void>;
  isOutlineGenerating: boolean;
}

export function useInterview(options?: UseInterviewOptions): UseInterviewReturn {
  const { addToast } = useToast();
  const [sessionId] = useState(() => nanoid());

  // Get store setters
  const setCourseId = useInterviewStore((s) => s.setCourseId);
  const setIsOutlineLoading = useInterviewStore((s) => s.setIsOutlineLoading);
  const setInterviewCompleted = useInterviewStore((s) => s.setInterviewCompleted);

  // 大纲生成状态
  const [isOutlineGenerating, setIsOutlineGenerating] = useState(false);

  const chat = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/interview",
      body: () => ({ sessionId }),
      // Custom fetch to capture response headers
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        const courseId = response.headers.get("X-Course-Id");
        if (courseId) {
          setCourseId(courseId);
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

  // AI SDK v6: 监听消息变化，查找 generateOutline 工具的输出
  useEffect(() => {
    for (const message of chat.messages) {
      if (message.role !== "assistant") continue;

      for (const part of message.parts) {
        if (part.type === "tool-generateOutline" && part.state === "output-available") {
          const output = part.output as GenerateOutlineOutput | undefined;
          if (output?.success && output.signal === "HANDOFF_TO_ARCHITECT") {
            console.log("[useInterview] Received HANDOFF signal, courseId:", output.courseId);

            // 设置大纲生成中状态
            setIsOutlineGenerating(true);
            setIsOutlineLoading(true);

            // 触发回调
            if (options?.onOutlineReady) {
              options.onOutlineReady(output.courseId);
            }
            return; // 只触发一次
          }
        }
      }
    }
  }, [chat.messages, options, setIsOutlineLoading]);

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

  // AI SDK v6: isLoading is derived from status
  const isLoading = status === "submitted" || status === "streaming";

  return {
    messages: chat.messages as UIMessage[],
    sendMessage: chat.sendMessage,
    status,
    isLoading,
    sessionId,
    addToolOutput,
    isOutlineGenerating,
  };
}
