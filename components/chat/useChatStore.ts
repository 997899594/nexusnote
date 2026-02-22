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
import * as chatApi from "@/lib/chat/api";

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
    const sessions = await chatApi.loadSessions();
    set({ sessions });
  },

  createSession: async (title: string) => {
    const session = await chatApi.createSession(title);
    if (session) {
      set((state) => ({
        sessions: [session, ...state.sessions],
      }));
    }
    return session;
  },

  updateSession: async (id: string, updates: Partial<Conversation>) => {
    await chatApi.updateSession(id, updates);
    // Optimistically update local state
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  deleteSession: async (id: string) => {
    await chatApi.deleteSession(id);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
    }));
  },
}));
