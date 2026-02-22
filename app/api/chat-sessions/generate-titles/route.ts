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

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { aiProvider, safeGenerateObject } from "@/lib/ai/core";
import { conversations, db, eq } from "@/db";
import { authOptions } from "../../auth/[...nextauth]/route";

// Title generation schema
const titleSchema = z.object({
  title: z.string().max(10),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

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
      return NextResponse.json({ updated: 0, message: "No conversations to process" });
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
        // 3. 使用 AI 生成标题（10字以内）
        const result = await safeGenerateObject({
          schema: titleSchema,
          model: aiProvider.chatModel,
          system: "你是一个专业的标题生成助手。根据用户的第一条消息，生成一个简洁、准确的标题，不超过10个字。",
          prompt: `用户消息：${firstUserMessage}\n\n请生成一个简洁的标题：`,
          temperature: 0.7,
        });

        // 4. 更新会话标题
        await db
          .update(conversations)
          .set({ title: result.title })
          .where(eq(conversations.id, conversation.id));

        updatedCount++;
      } catch (error) {
        console.error(`[GenerateTitles] Failed to generate title for conversation ${conversation.id}:`, error);
        // 继续处理下一个会话
      }
    }

    // 5. 返回更新数量
    return NextResponse.json({
      updated: updatedCount,
      message: `Successfully updated ${updatedCount} conversation titles`,
    });
  } catch (error) {
    console.error("[GenerateTitles] POST error:", error);
    return NextResponse.json({ error: "Failed to generate titles" }, { status: 500 });
  }
}
