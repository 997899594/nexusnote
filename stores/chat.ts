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

import type { UIMessage } from "ai";
import { create } from "zustand";
import type { Conversation } from "@/db";
import * as chatApi from "@/lib/chat/api";

interface ChatStore {
  sessions: Conversation[];
  currentSessionMessages: UIMessage[] | null;

  loadSessions: () => Promise<void>;
  generateBatchTitles: () => Promise<number>;
  createSession: (title: string) => Promise<Conversation | null>;
  updateSession: (id: string, updates: Partial<Conversation>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  setCurrentSessionMessages: (messages: UIMessage[] | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  sessions: [],
  currentSessionMessages: null,

  loadSessions: async () => {
    const sessions = await chatApi.loadSessions();
    set({ sessions });

    // Trigger batch title generation if sessions have default titles
    const hasDefaultTitles = sessions.some((s) => s.title === "新对话");
    if (hasDefaultTitles) {
      // Fire and forget - don't block the UI
      useChatStore
        .getState()
        .generateBatchTitles()
        .catch((err) => {
          console.error("[ChatStore] Failed to generate batch titles:", err);
        });
    }
  },

  generateBatchTitles: async () => {
    try {
      const res = await fetch("/api/chat-sessions/generate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = (await res.json()) as { updated: number };
      // Reload sessions to get updated titles
      if (data.updated > 0) {
        await useChatStore.getState().loadSessions();
      }
      return data.updated;
    } catch (error) {
      console.error("[ChatStore] Failed to generate batch titles:", error);
      return 0;
    }
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
    await chatApi.updateSession(id, updates as Parameters<typeof chatApi.updateSession>[1]);
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

  setCurrentSessionMessages: (messages: UIMessage[] | null) => {
    set({ currentSessionMessages: messages });
  },
}));
