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

import { create } from "zustand";
import { redirectToLogin } from "@/lib/api/client";
import type { ConversationSummary, ConversationsResponse } from "@/types/chat";

interface ChatStore {
  sessions: ConversationSummary[];

  loadSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
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

  loadSessions: async () => {
    const sessions = await loadChatSessions();
    set({ sessions });
  },

  deleteSession: async (id: string) => {
    await deleteChatSession(id);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
    }));
  },
}));
