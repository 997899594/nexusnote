/**
 * Chat API - 2026 Modern Architecture
 *
 * 客户端使用的聊天会话 API 函数
 * 注意：在 Server Components 中应直接调用数据库操作
 */

import type {
  Conversation,
  ConversationsResponse,
  CreateSessionResponse,
  UpdateSessionRequest,
} from "@/types/chat";

export async function persistMessages(sessionId: string, messages: unknown[]): Promise<void> {
  try {
    const res = await fetch(`/api/chat-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  } catch (error) {
    console.error("[ChatAPI] Failed to persist messages:", error);
    throw error;
  }
}

export async function loadSessions(): Promise<Conversation[]> {
  try {
    const res = await fetch("/api/chat-sessions");
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = (await res.json()) as ConversationsResponse;
    return data.sessions || [];
  } catch (error) {
    console.error("[ChatAPI] Failed to load sessions:", error);
    return [];
  }
}

export async function createSession(title: string): Promise<Conversation | null> {
  try {
    const res = await fetch("/api/chat-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = (await res.json()) as CreateSessionResponse;
    return data.session;
  } catch (error) {
    console.error("[ChatAPI] Failed to create session:", error);
    return null;
  }
}

export async function updateSession(id: string, updates: UpdateSessionRequest): Promise<void> {
  try {
    const res = await fetch(`/api/chat-sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  } catch (error) {
    console.error("[ChatAPI] Failed to update session:", error);
    throw error;
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/chat-sessions/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  } catch (error) {
    console.error("[ChatAPI] Failed to delete session:", error);
    throw error;
  }
}
