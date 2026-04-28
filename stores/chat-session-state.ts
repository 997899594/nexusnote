/**
 * Chat Session State Store
 *
 * 管理会话加载/发送状态，替代模块级 Set
 * - 支持失败重试
 * - 支持清理不活跃会话
 */

import type { UIMessage } from "ai";
import { create } from "zustand";

interface ChatSessionState {
  loadedSessions: Set<string>;
  failedSessions: Set<string>;
  sessionMessages: Map<string, UIMessage[]>;

  // Actions
  markLoaded: (id: string, messages: UIMessage[]) => void;
  markFailed: (id: string) => void;
  resetSession: (id: string) => void;
  isLoaded: (id: string) => boolean;
  getSessionMessages: (id: string) => UIMessage[] | null;
  setSessionMessages: (id: string, messages: UIMessage[]) => void;
}

export const useChatSessionStateStore = create<ChatSessionState>((set, get) => ({
  loadedSessions: new Set(),
  failedSessions: new Set(),
  sessionMessages: new Map(),

  markLoaded: (id: string, messages: UIMessage[]) => {
    set((state) => {
      const loadedSessions = new Set(state.loadedSessions);
      const failedSessions = new Set(state.failedSessions);
      const sessionMessages = new Map(state.sessionMessages);

      loadedSessions.add(id);
      failedSessions.delete(id);
      sessionMessages.set(id, messages);

      return { loadedSessions, failedSessions, sessionMessages };
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
      const sessionMessages = new Map(state.sessionMessages);
      sessionMessages.delete(id);
      return { failedSessions: newSet, loadedSessions: loadedSet, sessionMessages };
    });
  },

  resetSession: (id: string) => {
    set((state) => {
      const loadedSessions = new Set(state.loadedSessions);
      const failedSessions = new Set(state.failedSessions);
      const sessionMessages = new Map(state.sessionMessages);

      loadedSessions.delete(id);
      failedSessions.delete(id);
      sessionMessages.delete(id);

      return {
        loadedSessions,
        failedSessions,
        sessionMessages,
      };
    });
  },

  isLoaded: (id: string) => {
    return get().loadedSessions.has(id);
  },

  getSessionMessages: (id: string) => {
    return get().sessionMessages.get(id) ?? null;
  },

  setSessionMessages: (id: string, messages: UIMessage[]) => {
    set((state) => {
      const sessionMessages = new Map(state.sessionMessages);
      sessionMessages.set(id, messages);
      return { sessionMessages };
    });
  },
}));
