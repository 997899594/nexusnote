/**
 * Chat Types - 2026 Modern Architecture
 *
 * 严格的类型定义，无 any
 */

import type { UIMessage } from "ai";
import type { LucideProps } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  icon: React.FC<LucideProps>;
  modeLabel: string;
  modeIcon: React.FC<LucideProps>;
  targetPath: string;
  getQueryParams: (input: string) => Record<string, string>;
}

/**
 * 聊天会话状态
 */
export type ConversationIntent = "CHAT" | "INTERVIEW" | "COURSE" | "RAG" | "FLASHCARD";

/**
 * 数据库会话类型 - 与 Drizzle schema 匹配
 */
export interface Conversation {
  id: string;
  userId: string | null;
  title: string;
  intent: ConversationIntent;
  messages: UIMessage[] | unknown; // 数据库存储为 jsonb
  messageCount: number;
  summary: string | null;
  lastMessageAt: Date | null;
  isArchived: boolean;
  metadata: unknown; // 数据库 metadata 字段
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 会话列表响应
 */
export interface ConversationsResponse {
  sessions: Conversation[];
}

/**
 * 创建会话请求
 */
export interface CreateSessionRequest {
  title?: string;
  intent?: ConversationIntent;
  firstMessage?: string;
}

/**
 * 创建会话响应
 */
export interface CreateSessionResponse {
  session: Conversation;
  pendingMessage: string | null;
}

/**
 * 更新会话请求
 */
export interface UpdateSessionRequest {
  title?: string;
  messages?: UIMessage[];
  summary?: string;
  isArchived?: boolean;
}

/**
 * 索引会话请求
 */
export interface IndexSessionRequest {
  sessionId: string;
  messages: UIMessage[];
}

/**
 * 索引会话响应
 */
export interface IndexSessionResponse {
  success: boolean;
  chunksIndexed: number;
  sessionId: string;
}
