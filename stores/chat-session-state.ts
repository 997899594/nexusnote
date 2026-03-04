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
  sentSessions: Set<string>;
  failedSessions: Set<string>;

  // Actions
  markLoaded: (id: string) => void;
  markSent: (id: string) => void;
  markFailed: (id: string) => void;
  clearFailed: (id: string) => void;
  isLoaded: (id: string) => boolean;
  isSent: (id: string) => boolean;
  canRetry: (id: string) => boolean;

  // Cleanup
  cleanup: (activeIds: string[]) => void;
}

export const useChatSessionStateStore = create<ChatSessionState>((set, get) => ({
  loadedSessions: new Set(),
  sentSessions: new Set(),
  failedSessions: new Set(),

  markLoaded: (id: string) => {
    set((state) => {
      if (state.loadedSessions.has(id)) return state;
      const newSet = new Set(state.loadedSessions);
      newSet.add(id);
      return { loadedSessions: newSet };
    });
  },

  markSent: (id: string) => {
    set((state) => {
      if (state.sentSessions.has(id)) return state;
      const newSet = new Set(state.sentSessions);
      newSet.add(id);
      return { sentSessions: newSet };
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

  clearFailed: (id: string) => {
    set((state) => {
      if (!state.failedSessions.has(id)) return state;
      const newSet = new Set(state.failedSessions);
      newSet.delete(id);
      return { failedSessions: newSet };
    });
  },

  isLoaded: (id: string) => {
    return get().loadedSessions.has(id);
  },

  isSent: (id: string) => {
    return get().sentSessions.has(id);
  },

  canRetry: (id: string) => {
    const state = get();
    return state.failedSessions.has(id);
  },

  cleanup: (activeIds: string[]) => {
    const activeSet = new Set(activeIds);
    set((state) => {
      let changed = false;

      // Clean loadedSessions
      const newLoaded = new Set(state.loadedSessions);
      for (const id of newLoaded) {
        if (!activeSet.has(id)) {
          newLoaded.delete(id);
          changed = true;
        }
      }

      // Clean sentSessions
      const newSent = new Set(state.sentSessions);
      for (const id of newSent) {
        if (!activeSet.has(id)) {
          newSent.delete(id);
          changed = true;
        }
      }

      // Clean failedSessions
      const newFailed = new Set(state.failedSessions);
      for (const id of newFailed) {
        if (!activeSet.has(id)) {
          newFailed.delete(id);
          changed = true;
        }
      }

      if (!changed) return state;
      return {
        loadedSessions: newLoaded,
        sentSessions: newSent,
        failedSessions: newFailed,
      };
    });
  },
}));
