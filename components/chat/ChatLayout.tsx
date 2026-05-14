"use client";

/**
 * ChatLayout - Chat 路由的布局容器
 *
 * 架构职责：
 * - 提供固定结构：FloatingHeader + ChatHistory sidebar + children(content)
 * - 管理侧边栏开关状态
 * - 加载会话列表
 * - 不管理具体会话内容（由 children 负责）
 * - 当前会话 ID 由客户端路由参数提供
 */

import { MessageSquare } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FloatingHeader } from "@/components/shared/layout";
import { redirectToLogin } from "@/lib/api/client";
import { useChatStore } from "@/stores/chat";
import { ChatHistory } from "./ChatHistory";

interface ChatLayoutProps {
  children: React.ReactNode;
}

function triggerIndex(sessionId: string, messages: unknown): void {
  void fetch("/api/chat-sessions/index", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, messages }),
  })
    .then((response) => {
      if (response.status === 401) {
        redirectToLogin();
      }
    })
    .catch((error) => {
      console.warn("[Index] Background indexing failed:", error);
    });
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const router = useRouter();
  const params = useParams();
  const currentSessionId = (params?.id as string | undefined) || null;

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(min-width: 1024px)").matches,
  );
  const { sessions, deleteSession, loadSessions, currentSessionMessages } = useChatStore();

  const prevSessionRef = useRef<string | null>(null);

  // 监听会话切换，索引上一个会话
  useEffect(() => {
    const prevId = prevSessionRef.current;
    if (prevId && prevId !== currentSessionId && currentSessionMessages) {
      console.log("[Index] Session switched, indexing:", prevId);
      triggerIndex(prevId, currentSessionMessages);
    }
    prevSessionRef.current = currentSessionId;
  }, [currentSessionId, currentSessionMessages]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncSidebar = (event: MediaQueryList | MediaQueryListEvent) => {
      setSidebarOpen(event.matches);
    };

    syncSidebar(mediaQuery);
    mediaQuery.addEventListener("change", syncSidebar);
    return () => mediaQuery.removeEventListener("change", syncSidebar);
  }, []);

  const handleSelectSession = (id: string) => {
    setSidebarOpen(false);
    router.push(`/chat/${id}`);
  };

  const handleNewSession = () => {
    setSidebarOpen(false);
    router.push("/");
  };

  return (
    <div className="ui-page-shell flex min-h-dvh flex-col">
      <FloatingHeader
        title="对话工作台"
        subtitle="Chat"
        variant="workspace"
        onLogoClick={() => router.push("/")}
      />

      <div className="ui-floating-header-offset flex flex-1 overflow-hidden">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="ui-floating-surface fixed left-4 top-[calc(max(env(safe-area-inset-top,0px),0.75rem)+5.25rem)] z-40 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] shadow-[var(--shadow-floating-panel)] lg:hidden"
          >
            <MessageSquare className="h-4 w-4" />
            <span>对话</span>
          </button>
        )}

        <ChatHistory
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={deleteSession}
          onNewSession={handleNewSession}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
