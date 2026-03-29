/**
 * Chat Session API - Single Session Operations
 *
 * GET: 获取会话详情
 * PATCH: 更新会话（标题、消息、归档状态）
 * DELETE: 删除会话
 */

import type { UIMessage } from "ai";
import { conversationMessages, conversations, db, eq } from "@/db";
import { withDynamicAuth } from "@/lib/api";
import { revalidateProfileStats } from "@/lib/cache/tags";
import {
  buildConversationMessageRows,
  loadConversationMessages,
} from "@/lib/chat/conversation-messages";
import { isUuidString } from "@/lib/chat/session-id";
import { buildPersistedMessageSnapshot } from "@/lib/chat/session-messages";

interface UpdateSessionBody {
  title?: string;
  messages?: UIMessage[];
  summary?: string;
  isArchived?: boolean;
}

export const GET = withDynamicAuth<unknown, { id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    if (!isUuidString(id)) {
      return Response.json({ error: "Invalid session id" }, { status: 400 });
    }

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);

    if (!conv) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (conv.userId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const messages = await loadConversationMessages(id);

    return Response.json({ session: { ...conv, messages } });
  },
);

export const PATCH = withDynamicAuth<unknown, { id: string }>(
  async (request, { userId, params }) => {
    const { id } = params;

    if (!isUuidString(id)) {
      return Response.json({ error: "Invalid session id" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (existing.userId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body: UpdateSessionBody = await request.json();
    const { title, messages, summary, isArchived } = body;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updates.title = title;
    if (messages !== undefined) {
      const snapshot = buildPersistedMessageSnapshot(messages);

      updates.messageCount = messages.length;
      updates.lastMessageAt = new Date();

      if (snapshot.trimmed && summary === undefined && !existing.summary) {
        updates.summary = "较早的对话内容已折叠，仅保留最近消息。";
      }
    }
    if (summary !== undefined) updates.summary = summary;
    if (isArchived !== undefined) updates.isArchived = isArchived;

    const updated = await db.transaction(async (tx) => {
      const [conversation] = await tx
        .update(conversations)
        .set(updates)
        .where(eq(conversations.id, id))
        .returning();

      if (!conversation) {
        return null;
      }

      if (messages !== undefined) {
        const snapshot = buildPersistedMessageSnapshot(messages);
        const rows = buildConversationMessageRows({
          conversationId: id,
          messages: snapshot.messages,
        });

        await tx.delete(conversationMessages).where(eq(conversationMessages.conversationId, id));

        if (rows.length > 0) {
          await tx.insert(conversationMessages).values(rows);
        }

        return {
          ...conversation,
          messages: snapshot.messages,
        };
      }

      const persistedMessages = await loadConversationMessages(id);
      return {
        ...conversation,
        messages: persistedMessages,
      };
    });

    revalidateProfileStats(userId);

    return Response.json({ session: updated });
  },
);

export const DELETE = withDynamicAuth<unknown, { id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;

    if (!isUuidString(id)) {
      return Response.json({ error: "Invalid session id" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!existing) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (existing.userId !== userId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.delete(conversations).where(eq(conversations.id, id));
    revalidateProfileStats(userId);

    return Response.json({ success: true });
  },
);
