/**
 * Chat Sessions API - CRUD Operations
 *
 * GET: 获取会话列表
 * POST: 创建新会话（不保存消息，返回 pendingMessage 让前端发送）
 */

import { conversations, db, desc, eq, sql } from "@/db";
import { withOptionalAuth } from "@/lib/api";

interface CreateSessionBody {
  title?: string;
  intent?: string;
  firstMessage?: string;
}

export const GET = withOptionalAuth(async (request, { userId }) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const list = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      intent: conversations.intent,
      summary: conversations.summary,
      messageCount: conversations.messageCount,
      lastMessageAt: conversations.lastMessageAt,
      isArchived: conversations.isArchived,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(userId ? eq(conversations.userId, userId) : sql`1=1`)
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ sessions: list });
});

export const POST = withOptionalAuth(async (request, { userId }) => {
  const body: CreateSessionBody = await request.json();
  const { title = "新对话", intent = "CHAT", firstMessage } = body;

  const now = new Date();

  // 不保存消息到数据库，让 useChat 成为唯一消息源
  // 返回 pendingMessage 让前端自动发送
  const [newSession] = await db
    .insert(conversations)
    .values({
      userId,
      title: firstMessage
        ? firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "")
        : title,
      intent,
      messageCount: 0,
      lastMessageAt: now,
    })
    .returning();

  return Response.json({
    session: newSession,
    pendingMessage: firstMessage || null,
  });
});
