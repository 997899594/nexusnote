"use client";

/**
 * Chat Session Page - /chat/[id]
 *
 * 架构职责：
 * - 立刻展示会话（无论 ID 是客户端生成的还是持久化的）
 * - 从 usePendingChatStore 同步读取首条消息（零延迟，一次渲染就绑定）
 * - 交给 ChatPanel 渲染，useChatSession 负责会话的后台 upsert
 */

import { use } from "react";
import { ChatPanel } from "@/components/chat";
import { usePendingChatStore } from "@/stores";

interface ChatSessionPageProps {
  params: Promise<{ id: string }>;
}

export default function ChatSessionPage({ params }: ChatSessionPageProps) {
  const { id: sessionId } = use(params);

  // 同步读取 — Zustand store 在 SSR 时为 null，客户端 hydration 时拿到值
  // 不用 useEffect + setState，省掉一轮多余渲染
  const pendingMessage = usePendingChatStore((s) =>
    s.pending?.id === sessionId ? s.pending.message : null,
  );

  return (
    <div className="flex flex-col h-screen safe-top md:h-full">
      <ChatPanel sessionId={sessionId} pendingMessage={pendingMessage} />
    </div>
  );
}
