"use client";

import { motion } from "framer-motion";
import { MessageSquare, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/types/chat";

interface ChatHistoryProps {
  sessions: ConversationSummary[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  presentation?: "drawer" | "rail";
}

function formatTime(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function ChatHistory({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  isOpen = true,
  onClose,
  presentation = "drawer",
}: ChatHistoryProps) {
  const content = (
    <div className="flex h-full w-full flex-col bg-white/72 safe-top safe-bottom">
      <div className="border-b border-black/[0.04] px-4 pb-5 pt-5 lg:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
              对话
            </div>
            <h2 className="mt-2 text-[0.98rem] font-semibold tracking-[-0.02em] text-[var(--color-text)]">
              历史记录
            </h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)] lg:hidden"
              aria-label="关闭对话记录"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onNewSession}
          className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.06] bg-white/72 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-white"
          aria-label="创建新对话"
        >
          <Plus className="h-4 w-4" />
          <span>新对话</span>
        </button>
      </div>

      <div className="mobile-scroll flex-1 overflow-y-auto px-3 py-4">
        {sessions.length === 0 ? (
          <div className="rounded-[22px] bg-[var(--color-panel-soft)] px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
            还没有对话
          </div>
        ) : (
          <ul className="space-y-1.5" aria-label="历史对话">
            {sessions.map((session) => {
              const isActive = session.id === currentSessionId;

              return (
                <li
                  key={session.id}
                  className={cn(
                    "group relative rounded-[20px] transition-colors",
                    isActive ? "bg-[var(--color-panel-soft)]" : "hover:bg-[var(--color-hover)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                    className="flex min-w-0 w-full items-start gap-3 rounded-[20px] px-3 py-3 text-left"
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        isActive ? "bg-[var(--color-panel-strong)]" : "bg-black/[0.12]",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm font-medium",
                          isActive
                            ? "text-[var(--color-text)]"
                            : "text-[var(--color-text-secondary)]",
                        )}
                      >
                        {session.title}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[0.6875rem] text-[var(--color-text-muted)]">
                        <MessageSquare className="h-3 w-3" />
                        {formatTime(session.updatedAt)}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label={`删除对话：${session.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/82 text-[var(--color-text-muted)] opacity-100 shadow-sm transition-all hover:text-red-500 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  if (presentation === "rail") {
    return (
      <aside className="h-full w-full overflow-hidden" aria-label="对话记录">
        {content}
      </aside>
    );
  }

  return (
    <>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="ui-scrim fixed inset-0 z-40 lg:hidden"
        />
      )}

      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 h-dvh w-[min(88vw,288px)] overflow-hidden rounded-r-[28px] shadow-xl",
          "lg:hidden",
        )}
        aria-label="对话记录"
      >
        {content}
      </motion.aside>
    </>
  );
}
