/**
 * useChatSession - 会话消息管理
 *
 * 2026 架构：
 * - 历史加载：每个会话只加载一次（模块级 Set，跨 remount 持久）
 * - 首条消息：自动发送 pendingMessage（模块级 Set 防重）
 * - 消息持久化：通过 onFinish 回调，对话结束时触发一次（架构正确）
 * - Persona 切换：清除消息历史，避免上下文干扰
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";
import { persistMessages } from "@/lib/chat/api";
import { usePendingChatStore, useUserPreferencesStore } from "@/stores";

interface UseChatSessionOptions {
  sessionId: string | null;
  pendingMessage?: string | null;
}

// 模块级 Set（生命周期 = 整个 app，不随组件 remount 丢失）
const loadedSessions = new Set<string>();
const sentSessions = new Set<string>();

export function useChatSession({ sessionId, pendingMessage }: UseChatSessionOptions) {
  const clearPending = usePendingChatStore((state) => state.clear);
  const currentPersonaSlug = useUserPreferencesStore((state) => state.currentPersonaSlug);
  const { addToast } = useToast();

  // 用 ref 存储最新的 personaSlug，函数 body 通过 ref.current 获取最新值
  const personaSlugRef = useRef(currentPersonaSlug);
  useEffect(() => {
    personaSlugRef.current = currentPersonaSlug;
  }, [currentPersonaSlug]);

  const chat = useChat({
    id: sessionId ?? undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ sessionId, personaSlug: personaSlugRef.current }),
    }),
    onFinish: async ({ messages }) => {
      if (sessionId) {
        await persistMessages(sessionId, messages);
      }
    },
    onError: (error) => {
      console.error("[ChatSession] API Error:", error);
      parseApiError(error).then(({ message }) => {
        addToast(message, "error");
      });
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
          if (res.status === 404) return null;
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        // API 返回格式是 { session: { messages: [...] } }
        if (data?.session?.messages) {
          setMessages(data.session.messages as UIMessage[]);
        }
      })
      .catch(console.error);
  }, [sessionId, setMessages]);

  // 自动发送 pendingMessage（仅首次）
  useEffect(() => {
    if (!pendingMessage || !sessionId || sentSessions.has(sessionId)) return;

    sentSessions.add(sessionId);
    clearPending();

    sendMessage({ text: pendingMessage });
  }, [pendingMessage, sessionId, sendMessage, clearPending]);

  return chat;
}
