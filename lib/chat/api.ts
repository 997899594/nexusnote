/**
 * Chat API - 2026 Modern Architecture
 *
 * 客户端使用的聊天会话 API 函数
 * 注意：在 Server Components 中应直接调用数据库操作
 */

import { redirectToLogin } from "@/lib/api/client";
import type {
  ConversationSummary,
  ConversationsResponse,
  CreateSessionResponse,
  UpdateSessionRequest,
} from "@/types/chat";

function isUnauthorizedResponse(response: Response): boolean {
  return response.status === 401;
}

export async function persistMessages(sessionId: string, messages: unknown[]): Promise<void> {
  try {
    const res = await fetch(`/api/chat-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (isUnauthorizedResponse(res)) {
      redirectToLogin();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  } catch (error) {
    console.error("[ChatAPI] Failed to persist messages:", error);
    throw error;
  }
}

export async function loadSessions(): Promise<ConversationSummary[]> {
  try {
    const res = await fetch("/api/chat-sessions");
    if (isUnauthorizedResponse(res)) {
      redirectToLogin();
      return [];
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = (await res.json()) as ConversationsResponse;
    return data.sessions || [];
  } catch (error) {
    console.error("[ChatAPI] Failed to load sessions:", error);
    return [];
  }
}

export async function createSession(title: string): Promise<ConversationSummary | null> {
  try {
    const res = await fetch("/api/chat-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (isUnauthorizedResponse(res)) {
      redirectToLogin();
      return null;
    }
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
    if (isUnauthorizedResponse(res)) {
      redirectToLogin();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  } catch (error) {
    console.error("[ChatAPI] Failed to update session:", error);
    throw error;
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/chat-sessions/${id}`, { method: "DELETE" });
    if (isUnauthorizedResponse(res)) {
      redirectToLogin();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  } catch (error) {
    console.error("[ChatAPI] Failed to delete session:", error);
    throw error;
  }
}
