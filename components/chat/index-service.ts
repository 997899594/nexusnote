/**
 * Index Service - 会话索引管理
 *
 * 2026 最佳实践：
 * - Fire-and-forget: 不阻塞主请求
 * - 服务端去重: 避免重复索引
 */

import type { UIMessage } from "ai";

interface IndexPayload {
  sessionId: string;
  messages: UIMessage[];
}

/**
 * 触发会话索引 - Fire and forget
 * 不等待响应，不阻塞用户操作
 */
export function triggerIndex(payload: IndexPayload): void {
  fetch("/api/chat-sessions/index", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn("[Index] Background indexing failed:", err);
  });
}
