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
export type ConversationIntent = "CHAT" | "INTERVIEW" | "COURSE" | "RAG";

/**
 * 会话列表项
 */
export interface ConversationSummary {
  id: string;
  userId: string | null;
  title: string;
  intent: ConversationIntent;
  messageCount: number;
  summary: string | null;
  lastMessageAt: Date | null;
  isArchived: boolean;
  metadata: unknown; // 数据库 metadata 字段
  createdAt: Date;
  updatedAt: Date;
  titleGeneratedAt: Date | null;
}

/**
 * 会话详情
 * messages 由 conversation_messages 聚合而来，不直接来自 conversations 单表
 */
export interface Conversation extends ConversationSummary {
  messages: UIMessage[] | unknown;
}

/**
 * 会话列表响应
 */
export interface ConversationsResponse {
  sessions: ConversationSummary[];
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
