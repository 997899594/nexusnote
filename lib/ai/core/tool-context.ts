// lib/ai/core/tool-context.ts

import type { ToolSet, UIMessage } from "ai";

/**
 * 工具上下文
 * userId 是权限边界，必填
 */
export interface ToolContext {
  /** 用户 ID - 必填，权限边界 */
  userId: string;

  /** 会话 ID - 可选 */
  sessionId?: string;

  /** 资源 ID - 可选（如 courseId, documentId） */
  resourceId?: string;

  /** 当前消息列表 - 可选 */
  messages?: UIMessage[];
}

/**
 * 工具工厂函数类型
 */
export type ToolFactory<T extends ToolSet = ToolSet> = (ctx: ToolContext) => T;

/**
 * 创建工具上下文（带验证）
 */
export function createToolContext(input: {
  userId: string | undefined | null;
  sessionId?: string;
  resourceId?: string;
  messages?: UIMessage[];
}): ToolContext {
  if (!input.userId) {
    throw new Error("ToolContext requires userId");
  }
  return {
    userId: input.userId,
    sessionId: input.sessionId,
    resourceId: input.resourceId,
    messages: input.messages,
  };
}
