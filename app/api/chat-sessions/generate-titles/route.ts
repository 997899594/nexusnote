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

import { generateText, Output } from "ai";
import { and } from "drizzle-orm";
import { z } from "zod";
import { conversations, db, eq } from "@/db";
import { getJsonModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { loadPromptResource, renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { withAuth } from "@/lib/api";
import { extractMessageText, loadConversationMessagesMap } from "@/lib/chat/conversation-messages";
import { updateOwnedConversation } from "@/lib/chat/conversation-repository";

// Title generation schema
const titleSchema = z.object({
  title: z.string().max(10),
});

const CONVERSATION_TITLE_SYSTEM_PROMPT = loadPromptResource("conversation-title-system.md");
const buildConversationTitleUserPrompt = (firstUserMessage: string) =>
  renderPromptResource("conversation-title-user.md", {
    first_user_message: firstUserMessage,
  });

export const POST = withAuth(async (_request, { userId }) => {
  // 1. 查询 title = "新对话" 的会话（限制 5 条）
  const conversationsToProcess = await db
    .select({
      id: conversations.id,
    })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.title, "新对话")))
    .limit(5);

  if (conversationsToProcess.length === 0) {
    return Response.json({ updated: 0, message: "No conversations to process" });
  }

  const messagesByConversation = await loadConversationMessagesMap(
    conversationsToProcess.map((conversation) => conversation.id),
  );

  // 2. 提取首条用户消息并生成标题
  let updatedCount = 0;

  for (const conversation of conversationsToProcess) {
    const messages = messagesByConversation.get(conversation.id) ?? [];

    // 找到第一条用户消息
    const firstUserMessage = messages
      .filter((message) => message.role === "user")
      .map(extractMessageText)
      .find((text) => text.length > 0);
    if (!firstUserMessage) {
      console.warn(`[GenerateTitles] No user message found for conversation ${conversation.id}`);
      continue;
    }

    try {
      const startedAt = Date.now();
      const telemetry = createTelemetryContext({
        endpoint: "/api/chat-sessions/generate-titles",
        userId,
        intent: "conversation-title-generation",
        modelPolicy: "interactive-fast",
        promptVersion: "conversation-title@v1",
        metadata: {
          conversationId: conversation.id,
        },
      });

      // 3. 使用 AI 生成标题（10字以内）
      const result = await generateText({
        model: getJsonModelForPolicy("interactive-fast"),
        output: Output.object({ schema: titleSchema }),
        system: CONVERSATION_TITLE_SYSTEM_PROMPT,
        prompt: buildConversationTitleUserPrompt(firstUserMessage),
        temperature: 0.7,
      });

      await recordAIUsage({
        ...telemetry,
        usage: result.usage,
        durationMs: Date.now() - startedAt,
        success: true,
      });

      // 4. 更新会话标题
      await updateOwnedConversation({
        conversationId: conversation.id,
        userId,
        updates: {
          title: result.output.title,
          updatedAt: new Date(),
        },
      });

      updatedCount++;
    } catch (error) {
      console.error(
        `[GenerateTitles] Failed to generate title for conversation ${conversation.id}:`,
        error,
      );
      await recordAIUsage({
        endpoint: "/api/chat-sessions/generate-titles",
        userId,
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
