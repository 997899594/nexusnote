/**
 * AI Request Validation - Zod Schemas
 *
 * 2026 架构：全链路类型安全
 */

import { z } from "zod";

/**
 * Intent 类型定义
 */
export const IntentType = z.enum(["INTERVIEW", "CHAT", "EDITOR", "SEARCH", "COURSE_GENERATION"]);

export type IntentType = z.infer<typeof IntentType>;

/**
 * Chat 请求验证 Schema
 */
export const ChatRequestSchema = z.object({
  /** 聊天消息历史 */
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.union([z.string(), z.array(z.unknown())]),
    }),
  ),

  /** 明确的意图类型 */
  explicitIntent: IntentType.default("CHAT"),

  /** Interview 相关 */
  sessionId: z.string().uuid().optional(),
  initialGoal: z.string().max(500).optional(),

  /** Course Generation 相关 */
  courseGenerationContext: z
    .object({
      id: z.string().uuid().optional(),
      outlineTitle: z.string().optional(),
      outlineData: z.record(z.string(), z.unknown()).optional(),
      moduleCount: z.number().optional(),
      totalChapters: z.number().optional(),
      currentModuleIndex: z.number().optional(),
      currentChapterIndex: z.number().optional(),
      chaptersGenerated: z.number().optional(),
    })
    .optional(),

  /** 可选参数 */
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(32000).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * 输入净化函数
 * 防止 Prompt Injection 和安全问题
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, "") // 移除控制字符
    .slice(0, 50000); // 限制长度
}

/**
 * 消息净化
 */
export function sanitizeMessages(messages: ChatRequest["messages"]): ChatRequest["messages"] {
  return messages.map((msg) => ({
    ...msg,
    content: typeof msg.content === "string" ? sanitizeInput(msg.content) : msg.content,
  }));
}

/**
 * 验证并净化请求
 */
export function validateAndSanitizeRequest(data: unknown): ChatRequest {
  const parseResult = ChatRequestSchema.safeParse(data);

  if (!parseResult.success) {
    throw new Error(
      `Invalid request: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
    );
  }

  return {
    ...parseResult.data,
    messages: sanitizeMessages(parseResult.data.messages),
  };
}
