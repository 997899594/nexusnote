import type { UIMessage } from "ai";

export async function persistMessages(sessionId: string, messages: UIMessage[]): Promise<void> {
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

export async function loadSessions(): Promise<any[]> {
  try {
    const res = await fetch("/api/chat-sessions");
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return data.sessions || [];
  } catch (error) {
    console.error("[ChatAPI] Failed to load sessions:", error);
    return [];
  }
}

export async function createSession(title: string): Promise<any | null> {
  try {
    const res = await fetch("/api/chat-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return data.session;
  } catch (error) {
    console.error("[ChatAPI] Failed to create session:", error);
    return null;
  }
}

export async function updateSession(id: string, updates: Record<string, unknown>): Promise<void> {
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
