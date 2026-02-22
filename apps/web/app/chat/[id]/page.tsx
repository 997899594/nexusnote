"use client";

/**
 * Chat Session Page - /chat/[id]
 *
 * 架构职责：
 * - 立刻展示会话（无论 ID 是客户端生成的还是持久化的）
 * - 从 usePendingChatStore 读取首条消息（如果是新会话）
 * - 交给 ChatPanel 渲染，useChatSession 负责会话的后台 upsert
 *
 * 注意：
 * - 使用 "use client" 强制客户端渲染，避免 SSR hydration mismatch
 * - usePendingChatStore 是客户端 Zustand store，SSR 时无状态
 */

import { use, useEffect, useState } from "react";
import { ChatPanel } from "@/ui/chat";
import { usePendingChatStore } from "@/ui/chat/stores/usePendingChatStore";

interface ChatSessionPageProps {
  params: Promise<{ id: string }>;
}

export default function ChatSessionPage({ params }: ChatSessionPageProps) {
  const { id: sessionId } = use(params);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // 在客户端挂载后才读取 pending store（避免 hydration mismatch）
  useEffect(() => {
    const msg = usePendingChatStore.getState().get(sessionId);
    setPendingMessage(msg);
  }, [sessionId]);

  return <ChatPanel sessionId={sessionId} pendingMessage={pendingMessage} />;
}
