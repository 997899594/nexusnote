/**
 * Chat Sessions API - CRUD Operations
 *
 * GET: 获取会话列表
 */

import { z } from "zod";
import { conversations, db, desc, eq } from "@/db";
import { parseSearchParamsAs, withAuth } from "@/lib/api";

const ListChatSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const GET = withAuth(async (request, { userId }) => {
  const { limit, offset } = parseSearchParamsAs(request, ListChatSessionsQuerySchema);

  const list = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      messageCount: conversations.messageCount,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ sessions: list });
});
