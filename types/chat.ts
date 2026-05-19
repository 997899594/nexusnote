/**
 * Chat Types - 2026 Modern Architecture
 *
 * 严格的类型定义，无 any
 */

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
 * 会话列表项
 */
export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: Date;
}

/**
 * 会话列表响应
 */
export interface ConversationsResponse {
  sessions: ConversationSummary[];
}
