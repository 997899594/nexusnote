"use client";

import { motion } from "framer-motion";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
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

function getMessageCount(session: ConversationSummary): number {
  return session.messageCount || 0;
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
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "fixed z-50 h-full w-[280px] bg-white lg:relative lg:z-0",
          "flex flex-col shadow-[0_28px_56px_-38px_rgba(15,23,42,0.22)] lg:shadow-[0_24px_48px_-40px_rgba(15,23,42,0.14)]",
          "lg:translate-x-0",
        )}
      >
        {/* Header */}
        <div className="p-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNewSession}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-medium text-white shadow-[0_18px_36px_-28px_rgba(15,23,42,0.32)] transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>新对话</span>
          </motion.button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-3">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
              暂无对话记录
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "group relative flex cursor-pointer items-start gap-3 rounded-2xl p-3 transition-colors",
                    session.id === currentSessionId ? "bg-[#f3f5f8]" : "hover:bg-[#f6f7f9]",
                  )}
                  onClick={() => onSelectSession(session.id)}
                >
                  <MessageSquare
                    className={cn(
                      "w-4 h-4 mt-0.5 flex-shrink-0",
                      session.id === currentSessionId
                        ? "text-[var(--color-text-secondary)]"
                        : "text-[var(--color-text-muted)]",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          session.id === currentSessionId
                            ? "text-[var(--color-text)]"
                            : "text-[var(--color-text-secondary)]",
                        )}
                      >
                        {session.title}
                      </span>
                      {session.id === currentSessionId && (
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#111827]" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {getMessageCount(session)} 条消息
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">·</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatTime(session.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="p-1 text-[var(--color-text-muted)] opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}
