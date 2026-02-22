/**
 * Chat Store - 会话列表管理
 *
 * 职责：
 * - 管理侧边栏的会话列表
 * - 提供 CRUD 操作
 *
 * 不管理：
 * - 当前会话 ID（由 URL 管理，/chat/[id] 就是 source of truth）
 * - 消息内容（由 useChat 管理）
 * - Pending 消息（由 usePendingChatStore 管理）
 */

import { create } from "zustand";
import type { Conversation } from "@/db";

interface ChatStore {
  sessions: Conversation[];

  loadSessions: () => Promise<void>;
  createSession: (title: string) => Promise<Conversation | null>;
  updateSession: (id: string, updates: Partial<Conversation>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set) => ({
  sessions: [],

  loadSessions: async () => {
    try {
      const res = await fetch("/api/chat-sessions");
      const data = await res.json();
      set({ sessions: data.sessions || [] });
    } catch (error) {
      console.error("[ChatStore] loadSessions error:", error);
    }
  },

  createSession: async (title: string) => {
    try {
      const res = await fetch("/api/chat-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      const session = data.session as Conversation;

      set((state) => ({
        sessions: [session, ...state.sessions],
      }));

      return session;
    } catch (error) {
      console.error("[ChatStore] createSession error:", error);
      return null;
    }
  },

  updateSession: async (id: string, updates: Partial<Conversation>) => {
    try {
      const res = await fetch(`/api/chat-sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      const updated = data.session as Conversation;

      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
      }));
    } catch (error) {
      console.error("[ChatStore] updateSession error:", error);
    }
  },

  deleteSession: async (id: string) => {
    try {
      await fetch(`/api/chat-sessions/${id}`, { method: "DELETE" });
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
      }));
    } catch (error) {
      console.error("[ChatStore] deleteSession error:", error);
    }
  },
}));
