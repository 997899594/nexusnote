/**
 * Chat Sessions API - CRUD Operations
 *
 * GET: 获取会话列表
 */

import { conversations, db, desc, eq } from "@/db";
import { withAuth } from "@/lib/api";

export const GET = withAuth(async (request, { userId }) => {
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
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ sessions: list });
});
