"use client";

/**
 * ChatLayout - Chat 路由的布局容器
 *
 * 架构职责：
 * - 提供固定结构：FloatingHeader + ChatHistory sidebar + children(content)
 * - 管理侧边栏开关状态
 * - 加载会话列表
 * - 不管理具体会话内容（由 children 负责）
 * - 不管理当前会话 ID（由 URL /chat/[id] 管理）
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FloatingHeader } from "@/components/shared/layout";
import { useChatStore } from "@/stores";
import { ChatHistory } from "./ChatHistory";
import { triggerIndex } from "./index-service";

interface ChatLayoutProps {
  onExit: () => void;
  children: React.ReactNode;
}

export function ChatLayout({ onExit, children }: ChatLayoutProps) {
  const router = useRouter();
  const params = useParams();
  const currentSessionId = (params?.id as string | undefined) || null;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { sessions, deleteSession, loadSessions, currentSessionMessages } = useChatStore();

  const prevSessionRef = useRef<string | null>(null);

  // 监听会话切换，索引上一个会话
  useEffect(() => {
    const prevId = prevSessionRef.current;
    if (prevId && prevId !== currentSessionId && currentSessionMessages) {
      console.log("[Index] Session switched, indexing:", prevId);
      triggerIndex({ sessionId: prevId, messages: currentSessionMessages });
    }
    prevSessionRef.current = currentSessionId;
  }, [currentSessionId, currentSessionMessages]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSelectSession = (id: string) => {
    setSidebarOpen(false);
    router.push(`/chat/${id}`);
  };

  const handleNewSession = () => {
    setSidebarOpen(false);
    onExit();
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      <FloatingHeader
        showMenuButton
        showPersonaSelector
        onLogoClick={onExit}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 flex pt-20 overflow-hidden">
        <ChatHistory
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={deleteSession}
          onNewSession={handleNewSession}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
    </div>
  );
}
