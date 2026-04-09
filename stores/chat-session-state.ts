/**
 * Chat Session State Store
 *
 * 管理会话加载/发送状态，替代模块级 Set
 * - 支持失败重试
 * - 支持清理不活跃会话
 */

import { create } from "zustand";

interface ChatSessionState {
  loadedSessions: Set<string>;
  failedSessions: Set<string>;

  // Actions
  markLoaded: (id: string) => void;
  markFailed: (id: string) => void;
  resetSession: (id: string) => void;
  isLoaded: (id: string) => boolean;
}

export const useChatSessionStateStore = create<ChatSessionState>((set, get) => ({
  loadedSessions: new Set(),
  failedSessions: new Set(),

  markLoaded: (id: string) => {
    set((state) => {
      if (state.loadedSessions.has(id)) return state;
      const newSet = new Set(state.loadedSessions);
      newSet.add(id);
      return { loadedSessions: newSet };
    });
  },

  markFailed: (id: string) => {
    set((state) => {
      if (state.failedSessions.has(id)) return state;
      const newSet = new Set(state.failedSessions);
      newSet.add(id);
      // Also remove from loadedSessions so it can be retried
      const loadedSet = new Set(state.loadedSessions);
      loadedSet.delete(id);
      return { failedSessions: newSet, loadedSessions: loadedSet };
    });
  },

  resetSession: (id: string) => {
    set((state) => {
      const loadedSessions = new Set(state.loadedSessions);
      const failedSessions = new Set(state.failedSessions);

      loadedSessions.delete(id);
      failedSessions.delete(id);

      return {
        loadedSessions,
        failedSessions,
      };
    });
  },

  isLoaded: (id: string) => {
    return get().loadedSessions.has(id);
  },
}));
