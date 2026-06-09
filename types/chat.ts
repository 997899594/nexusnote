/**
 * Chat Types - 2026 Modern Architecture
 *
 * 严格的类型定义，无 any
 */

import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";

interface CommandBase {
  id: string;
  label: string;
  icon: ComponentType<LucideProps>;
  modeLabel: string;
  modeIcon: ComponentType<LucideProps>;
}

export interface NavigateCommand extends CommandBase {
  action: "navigate";
  targetPath: string;
  getQueryParams: (input: string) => Record<string, string>;
}

export interface SubmitCommand extends CommandBase {
  action: "submit";
  buildText: (input: string) => string;
}

export type Command = NavigateCommand | SubmitCommand;

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
