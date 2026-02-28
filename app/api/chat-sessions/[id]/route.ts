/**
 * Chat Session API - Single Session Operations
 *
 * GET: 获取会话详情
 * PATCH: 更新会话（标题、消息、归档状态）
 * DELETE: 删除会话
 */

import type { UIMessage } from "ai";
import { conversations, db, eq } from "@/db";
import { withDynamicOptionalAuth } from "@/lib/api";

interface UpdateSessionBody {
  title?: string;
  messages?: UIMessage[];
  summary?: string;
  isArchived?: boolean;
}

export const GET = withDynamicOptionalAuth<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);

    if (!conv) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (userId && conv.userId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    return Response.json({ session: conv });
  }
);

export const PATCH = withDynamicOptionalAuth<{ id: string }>(
  async (request, { userId, params }) => {
    const { id } = params;

    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (userId && existing.userId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body: UpdateSessionBody = await request.json();
    const { title, messages, summary, isArchived } = body;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updates.title = title;
    if (messages !== undefined) {
      updates.messages = messages;
      updates.messageCount = messages.length;
      updates.lastMessageAt = new Date();
    }
    if (summary !== undefined) updates.summary = summary;
    if (isArchived !== undefined) updates.isArchived = isArchived;

    const [updated] = await db
      .update(conversations)
      .set(updates)
      .where(eq(conversations.id, id))
      .returning();

    return Response.json({ session: updated });
  }
);

export const DELETE = withDynamicOptionalAuth<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (userId && existing.userId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.delete(conversations).where(eq(conversations.id, id));

    return Response.json({ success: true });
  }
);
