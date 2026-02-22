/**
 * useChatSession - 会话消息管理
 *
 * 2026 架构：
 * - 历史加载：每个会话只加载一次（模块级 Set，跨 remount 持久）
 * - 首条消息：自动发送 pendingMessage（模块级 Set 防重）
 * - 消息持久化：通过 onFinish 回调，对话结束时触发一次（架构正确）
 *
 * 不再依赖：
 * - useRef 管理 Set（remount 会丢失）
 * - messages 作为 effect 依赖（streaming 期间不断触发）
 * - debounce 逻辑（onFinish 本身就是单次触发）
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect } from "react";
import { usePendingChatStore } from "./usePendingChatStore";

interface UseChatSessionOptions {
  sessionId: string | null;
  pendingMessage?: string | null;
}

// 模块级 Set（生命周期 = 整个 app，不随组件 remount 丢失）
const loadedSessions = new Set<string>();
const sentSessions = new Set<string>();

/**
 * 持久化消息到数据库（模块级函数）
 */
function persistMessages(sessionId: string, messages: UIMessage[]) {
  fetch(`/api/chat-sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  }).catch((error) => {
    console.error("[ChatSession] Failed to persist messages:", error);
  });
}

export function useChatSession({ sessionId, pendingMessage }: UseChatSessionOptions) {
  const clearPending = usePendingChatStore((state) => state.clear);

  const chat = useChat({
    id: sessionId ?? undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { sessionId },
    }),

    // ✅ 对话结束时持久化一次（架构正确，streaming 结束后 SDK 回调）
    onFinish: ({ messages }) => {
      if (sessionId) {
        persistMessages(sessionId, messages);
      }
    },
  });

  const { setMessages, sendMessage, status } = chat;

  // 历史恢复：每个 sessionId 只加载一次（模块级 Set 防重）
  useEffect(() => {
    if (!sessionId || loadedSessions.has(sessionId)) return;

    loadedSessions.add(sessionId);

    fetch(`/api/chat-sessions/${sessionId}`)
      .then((res) => {
        if (!res.ok) {
          // 404 = 新会话（客户端生成的 UUID 还未 upsert）
          if (res.status === 404) return null;
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return; // 404 情况
        const history = data.session?.messages as UIMessage[] | undefined;
        if (history?.length) {
          setMessages(history);
        }
      })
      .catch((error) => {
        console.error("[ChatSession] Failed to load history:", error);
      });
  }, [sessionId, setMessages]);

  // 自动发送 pendingMessage：每个 sessionId 只发送一次（模块级 Set 防重）
  useEffect(() => {
    if (!sessionId || !pendingMessage || sentSessions.has(sessionId)) return;
    if (status !== "ready") return;

    sentSessions.add(sessionId);
    clearPending();
    sendMessage({ text: pendingMessage });
  }, [sessionId, pendingMessage, status, sendMessage, clearPending]);

  return {
    ...chat,
    isLoading: status === "submitted" || status === "streaming",
  };
}
