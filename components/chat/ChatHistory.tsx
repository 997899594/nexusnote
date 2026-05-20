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
}: ChatHistoryProps) {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="ui-scrim fixed inset-0 z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "fixed z-50 h-full w-[280px] bg-white lg:relative lg:z-0",
          "flex flex-col shadow-[var(--shadow-floating-panel)]",
          "lg:translate-x-0",
        )}
        aria-label="对话记录"
      >
        {/* Header */}
        <div className="border-[var(--color-border-subtle)] border-b p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-[var(--color-text)]">对话记录</h2>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)] lg:hidden"
                aria-label="关闭对话记录"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNewSession}
            className="ui-primary-button flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-transform"
            aria-label="创建新对话"
          >
            <Plus className="w-4 h-4" />
            <span>新对话</span>
          </motion.button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-3">
          {sessions.length === 0 ? (
            <div className="py-8 text-center text-[var(--color-text-muted)] text-sm">
              还没有对话
            </div>
          ) : (
            <ul className="space-y-1" aria-label="历史对话">
              {sessions.map((session) => (
                <motion.li
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "group relative flex items-start gap-2 rounded-2xl p-2 transition-colors",
                    session.id === currentSessionId
                      ? "bg-[var(--color-active)]"
                      : "hover:bg-[var(--color-panel-soft)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-1 text-left"
                    aria-current={session.id === currentSessionId ? "page" : undefined}
                  >
                    <MessageSquare
                      className={cn(
                        "mt-0.5 h-4 w-4 flex-shrink-0",
                        session.id === currentSessionId
                          ? "text-[var(--color-text-secondary)]"
                          : "text-[var(--color-text-muted)]",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            session.id === currentSessionId
                              ? "text-[var(--color-text)]"
                              : "text-[var(--color-text-secondary)]",
                          )}
                        >
                          {session.title}
                        </span>
                        {session.id === currentSessionId && (
                          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-panel-strong)]" />
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {formatTime(session.updatedAt)}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`删除对话：${session.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] opacity-100 transition-all hover:bg-white hover:text-red-500 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </motion.aside>
    </>
  );
}
