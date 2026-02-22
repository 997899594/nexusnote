"use client";

import type { Conversation } from "@/db";
import { motion } from "framer-motion";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatHistoryProps {
  sessions: Conversation[];
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

function getMessageCount(session: Conversation): number {
  const msgs = session.messages;
  if (Array.isArray(msgs)) return msgs.length;
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
          "fixed lg:relative w-[280px] h-full bg-white z-50 lg:z-0",
          "flex flex-col shadow-xl lg:shadow-none",
          "lg:translate-x-0",
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-100">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNewSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] text-[var(--color-accent-fg)] rounded-xl font-medium text-sm hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>新对话</span>
          </motion.button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-3">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-sm">暂无对话记录</div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "group relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                    session.id === currentSessionId ? "bg-zinc-100" : "hover:bg-zinc-50",
                  )}
                  onClick={() => onSelectSession(session.id)}
                >
                  <MessageSquare
                    className={cn(
                      "w-4 h-4 mt-0.5 flex-shrink-0",
                      session.id === currentSessionId ? "text-zinc-700" : "text-zinc-400",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          session.id === currentSessionId ? "text-zinc-900" : "text-zinc-700",
                        )}
                      >
                        {session.title}
                      </span>
                      {session.id === currentSessionId && (
                        <span className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-zinc-400">
                        {getMessageCount(session)} 条消息
                      </span>
                      <span className="text-xs text-zinc-300">·</span>
                      <span className="text-xs text-zinc-400">{formatTime(session.updatedAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-all"
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
