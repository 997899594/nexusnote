/**
 * useChatSession - 会话消息管理
 *
 * 2026 架构：
 * - 历史加载：每个会话只加载一次（Zustand Store，跨 remount 持久）
 * - 首条消息：自动发送 pendingMessage（Zustand Store 防重）
 * - 消息持久化：通过 onFinish 回调，对话结束时触发一次（架构正确）
 * - Persona 切换：清除消息历史，避免上下文干扰
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { type AIDegradationKind, createAIDegradationAwareFetch } from "@/lib/ai/core/degradation";
import { isUnauthorizedError, parseApiError, redirectToLogin } from "@/lib/api/client";
import { useChatSessionStateStore, usePendingChatStore, useUserPreferencesStore } from "@/stores";

interface UseChatSessionOptions {
  sessionId: string | null;
  pendingMessage?: string | null;
  body?: Record<string, unknown> | (() => Record<string, unknown>);
}

function resolveBody(body: UseChatSessionOptions["body"]): Record<string, unknown> | undefined {
  if (!body) {
    return undefined;
  }

  return typeof body === "function" ? body() : body;
}

export function useChatSession({ sessionId, pendingMessage, body }: UseChatSessionOptions) {
  const clearPending = usePendingChatStore((state) => state.clear);
  const currentPersonaSlug = useUserPreferencesStore((state) => state.currentPersonaSlug);
  const { addToast } = useToast();
  const [aiDegradedKind, setAIDegradedKind] = useState<AIDegradationKind | null>(null);

  // Zustand-based session state
  const { isLoaded, markLoaded, markFailed, isSent, markSent } = useChatSessionStateStore();

  // 用 ref 存储最新的 personaSlug，函数 body 通过 ref.current 获取最新值
  const personaSlugRef = useRef(currentPersonaSlug);
  useEffect(() => {
    personaSlugRef.current = currentPersonaSlug;
  }, [currentPersonaSlug]);

  const chat = useChat({
    id: sessionId ?? undefined,
    resume: Boolean(sessionId),
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: createAIDegradationAwareFetch({
        onStateChange: setAIDegradedKind,
        onUnauthorized: redirectToLogin,
      }),
      body: () => ({
        sessionId,
        personaSlug: personaSlugRef.current,
        ...resolveBody(body),
      }),
    }),
    onError: (error) => {
      console.error("[ChatSession] API Error:", error);
      parseApiError(error).then(({ message, status, code }) => {
        if (isUnauthorizedError(status, code)) {
          redirectToLogin();
          return;
        }
        addToast(message, "error");
      });
    },
  });

  const { setMessages, sendMessage } = chat;

  // 历史恢复：每个 sessionId 只加载一次（Zustand Store 防重）
  // 有 pendingMessage 说明是首页新建的会话，跳过 fetch（ID 是客户端生成的，后端必然 404）
  useEffect(() => {
    if (!sessionId || isLoaded(sessionId) || pendingMessage) return;

    let isCancelled = false;
    markLoaded(sessionId);

    fetch(`/api/chat-sessions/${sessionId}`)
      .then((res) => {
        if (res.status === 401) {
          redirectToLogin();
          return null;
        }
        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!isCancelled && data?.session?.messages) {
          setMessages(data.session.messages as UIMessage[]);
        }
      })
      .catch((error) => {
        console.error(error);
        markFailed(sessionId);
      });

    return () => {
      isCancelled = true;
    };
  }, [sessionId, setMessages, isLoaded, markLoaded, markFailed, pendingMessage]);

  // 自动发送 pendingMessage（仅首次）
  useEffect(() => {
    if (!pendingMessage || !sessionId || isSent(sessionId)) return;

    markSent(sessionId);
    clearPending();

    sendMessage({ text: pendingMessage });
  }, [pendingMessage, sessionId, sendMessage, clearPending, isSent, markSent]);

  return {
    ...chat,
    aiDegradedKind,
  };
}
