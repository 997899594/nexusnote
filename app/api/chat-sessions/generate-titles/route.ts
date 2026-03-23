/**
 * Batch Title Generation API
 *
 * POST: 批量生成会话标题
 * - 查询 title = "新对话" 的会话（限制 5 条）
 * - 提取首条用户消息
 * - 使用 AI 生成标题（10字以内）
 * - 更新会话标题
 * - 返回更新数量
 */

import { generateObject } from "ai";
import { z } from "zod";
import { conversations, db, eq } from "@/db";
import { aiProvider } from "@/lib/ai/core";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { withOptionalAuth } from "@/lib/api";

// Title generation schema
const titleSchema = z.object({
  title: z.string().max(10),
});

export const POST = withOptionalAuth(async (_request, { userId: _userId }) => {
  // 1. 查询 title = "新对话" 的会话（限制 5 条）
  const conversationsToProcess = await db
    .select({
      id: conversations.id,
      messages: conversations.messages,
    })
    .from(conversations)
    .where(eq(conversations.title, "新对话"))
    .limit(5);

  if (conversationsToProcess.length === 0) {
    return Response.json({ updated: 0, message: "No conversations to process" });
  }

  // 2. 提取首条用户消息并生成标题
  let updatedCount = 0;

  for (const conversation of conversationsToProcess) {
    const messages = conversation.messages as Array<{ role: string; content: string }>;

    // 找到第一条用户消息
    const firstUserMessage = messages.find((m) => m.role === "user")?.content;
    if (!firstUserMessage) {
      console.warn(`[GenerateTitles] No user message found for conversation ${conversation.id}`);
      continue;
    }

    try {
      const startedAt = Date.now();
      const telemetry = createTelemetryContext({
        endpoint: "/api/chat-sessions/generate-titles",
        userId: _userId ?? undefined,
        intent: "conversation-title-generation",
        modelPolicy: "interactive-fast",
        promptVersion: "conversation-title@v1",
        metadata: {
          conversationId: conversation.id,
        },
      });

      // 3. 使用 AI 生成标题（10字以内）
      const result = await generateObject({
        schema: titleSchema,
        model: aiProvider.chatModel,
        system:
          "你是一个专业的标题生成助手。根据用户的第一条消息，生成一个简洁、准确的标题，不超过10个字。",
        prompt: `用户消息：${firstUserMessage}\n\n请生成一个简洁的标题：`,
        temperature: 0.7,
      });

      await recordAIUsage({
        ...telemetry,
        usage: result.usage,
        durationMs: Date.now() - startedAt,
        success: true,
      });

      // 4. 更新会话标题
      await db
        .update(conversations)
        .set({ title: result.object.title })
        .where(eq(conversations.id, conversation.id));

      updatedCount++;
    } catch (error) {
      console.error(
        `[GenerateTitles] Failed to generate title for conversation ${conversation.id}:`,
        error,
      );
      await recordAIUsage({
        endpoint: "/api/chat-sessions/generate-titles",
        userId: _userId ?? undefined,
        requestId: crypto.randomUUID(),
        intent: "conversation-title-generation",
        modelPolicy: "interactive-fast",
        promptVersion: "conversation-title@v1",
        durationMs: 0,
        success: false,
        errorMessage: getErrorMessage(error),
        metadata: {
          conversationId: conversation.id,
        },
      });
      // 继续处理下一个会话
    }
  }

  // 5. 返回更新数量
  return Response.json({
    updated: updatedCount,
    message: `Successfully updated ${updatedCount} conversation titles`,
  });
});
