"use client";

/**
 * ChatLayout - Chat 路由的布局容器
 *
 * 架构职责：
 * - 提供桌面三栏结构和移动端历史抽屉
 * - 管理移动端侧边栏开关状态
 * - 加载会话列表
 * - 不管理具体会话内容（由 children 负责）
 * - 当前会话 ID 由客户端路由参数提供
 */

import { MessageSquare } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppBackLink } from "@/components/shared/layout";
import { PAGE_BACK_TARGETS } from "@/lib/navigation/app-navigation";
import { useChatStore } from "@/stores/chat";
import { ChatHistory } from "./ChatHistory";

interface ChatLayoutProps {
  children: React.ReactNode;
}

export function ChatLayout({ children }: ChatLayoutProps) {
  const router = useRouter();
  const params = useParams();
  const currentSessionId = (params?.id as string | undefined) || null;

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(min-width: 1024px)").matches,
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(min-width: 1024px)").matches,
  );
  const { sessions, deleteSession, loadSessions } = useChatStore();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncSidebar = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsDesktop(event.matches);
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

  const currentSession = sessions.find((session) => session.id === currentSessionId);

  if (isDesktop) {
    return (
      <div className="ui-page-shell min-h-dvh overflow-hidden">
        <div className="mx-auto grid h-dvh max-w-[1320px] grid-cols-[minmax(13.5rem,15.5rem)_minmax(0,1fr)] gap-3 p-3 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-4 lg:p-4 xl:grid-cols-[288px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/78 shadow-[0_22px_64px_-48px_rgba(15,23,42,0.28)] backdrop-blur-xl">
            <ChatHistory
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onDeleteSession={deleteSession}
              onNewSession={handleNewSession}
              isOpen
              presentation="rail"
            />
          </aside>

          <main className="min-h-0 min-w-0 overflow-hidden rounded-[30px] border border-black/[0.04] bg-white/94 shadow-[0_24px_76px_-58px_rgba(15,23,42,0.32)]">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-page-shell min-h-dvh overflow-hidden">
      <div className="flex h-dvh flex-col">
        <header className="safe-top sticky top-0 z-30 shrink-0 border-b border-black/[0.04] bg-white/90 px-4 pb-3 pt-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <AppBackLink target={PAGE_BACK_TARGETS.chat} />
            <div className="min-w-0 text-center">
              <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
                对话
              </p>
              <h1 className="mt-0.5 line-clamp-1 text-sm font-semibold leading-5 text-[var(--color-text)]">
                {currentSession?.title ?? "当前会话"}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="打开对话记录"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]"
            >
              <MessageSquare className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden bg-white/94">{children}</main>
        <ChatHistory
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={deleteSession}
          onNewSession={handleNewSession}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </div>
  );
}
