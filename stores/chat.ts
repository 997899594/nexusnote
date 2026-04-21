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
 */

import type { UIMessage } from "ai";
import { create } from "zustand";
import { redirectToLogin } from "@/lib/api/client";
import type {
  ConversationSummary,
  ConversationsResponse,
  UpdateSessionRequest,
} from "@/types/chat";

interface ChatStore {
  sessions: ConversationSummary[];
  currentSessionMessages: UIMessage[] | null;

  loadSessions: () => Promise<void>;
  generateBatchTitles: () => Promise<number>;
  updateSession: (id: string, updates: Partial<ConversationSummary>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  setCurrentSessionMessages: (messages: UIMessage[] | null) => void;
}

function isUnauthorizedResponse(response: Response): boolean {
  return response.status === 401;
}

async function loadChatSessions(): Promise<ConversationSummary[]> {
  try {
    const response = await fetch("/api/chat-sessions");
    if (isUnauthorizedResponse(response)) {
      redirectToLogin();
      return [];
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as ConversationsResponse;
    return data.sessions || [];
  } catch (error) {
    console.error("[ChatStore] Failed to load sessions:", error);
    return [];
  }
}

async function updateChatSession(id: string, updates: UpdateSessionRequest): Promise<void> {
  try {
    const response = await fetch(`/api/chat-sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (isUnauthorizedResponse(response)) {
      redirectToLogin();
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error("[ChatStore] Failed to update session:", error);
    throw error;
  }
}

async function deleteChatSession(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/chat-sessions/${id}`, {
      method: "DELETE",
    });

    if (isUnauthorizedResponse(response)) {
      redirectToLogin();
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error("[ChatStore] Failed to delete session:", error);
    throw error;
  }
}

export const useChatStore = create<ChatStore>((set) => ({
  sessions: [],
  currentSessionMessages: null,

  loadSessions: async () => {
    const sessions = await loadChatSessions();
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
      if (res.status === 401) {
        redirectToLogin();
        return 0;
      }
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

  updateSession: async (id: string, updates: Partial<ConversationSummary>) => {
    await updateChatSession(id, updates as UpdateSessionRequest);
    // Optimistically update local state
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  },

  deleteSession: async (id: string) => {
    await deleteChatSession(id);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
    }));
  },

  setCurrentSessionMessages: (messages: UIMessage[] | null) => {
    set({ currentSessionMessages: messages });
  },
}));
