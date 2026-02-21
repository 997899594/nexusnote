/**
 * AI Chat Store - AI 对话状态管理
 */

import { create } from "zustand";
import type { Intent } from "@/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export type ChatStatus = "idle" | "streaming" | "submitted";

interface ChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  status: ChatStatus;
  intent: Intent;

  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setSessionId: (sessionId: string | null) => void;
  setStatus: (status: ChatStatus) => void;
  setIntent: (intent: Intent) => void;
}

export const useAIChatStore = create<ChatState>((set) => ({
  messages: [],
  sessionId: null,
  status: "idle",
  intent: "CHAT",

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setMessages: (messages) => set({ messages }),

  clearMessages: () => set({ messages: [], sessionId: null }),

  setSessionId: (sessionId) => set({ sessionId }),

  setStatus: (status) => set({ status }),

  setIntent: (intent) => set({ intent }),
}));
