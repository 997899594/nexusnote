import type { UIMessage } from "ai";
import { and, conversationMessages, conversations, db, eq } from "@/db";
import { summarizeDroppedConversationMessages } from "@/lib/chat/conversation-memory";
import {
  buildConversationMessageRows,
  loadConversationMessages,
} from "@/lib/chat/conversation-messages";
import { buildPersistedMessageSnapshot } from "@/lib/chat/session-messages";

type ConversationMetadata = Record<string, unknown>;

function normalizeMetadata(metadata: unknown): ConversationMetadata {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as ConversationMetadata;
  }

  return {};
}

export async function setConversationActiveStreamId(
  conversationId: string,
  userId: string,
  activeStreamId: string | null,
): Promise<void> {
  const [existing] = await db
    .select({ metadata: conversations.metadata })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  if (!existing) {
    return;
  }

  const metadata = normalizeMetadata(existing?.metadata);
  const nextMetadata = {
    ...metadata,
    activeStreamId,
  };

  await db
    .update(conversations)
    .set({
      metadata: nextMetadata,
      updatedAt: new Date(),
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
}

export async function getConversationActiveStreamId(
  conversationId: string,
  userId: string,
): Promise<string | null> {
  const [existing] = await db
    .select({ metadata: conversations.metadata })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  const metadata = normalizeMetadata(existing?.metadata);
  const activeStreamId = metadata.activeStreamId;

  return typeof activeStreamId === "string" && activeStreamId.length > 0 ? activeStreamId : null;
}

export async function saveOwnedConversationSnapshot(params: {
  conversationId: string;
  userId: string;
  existingSummary: string | null;
  messages: UIMessage[];
  title?: string;
  summary?: string | null;
  isArchived?: boolean;
  trimmedSummaryFallback?: string | null;
}): Promise<{
  conversation: typeof conversations.$inferSelect;
  messages: UIMessage[];
} | null> {
  const {
    conversationId,
    userId,
    existingSummary,
    messages,
    title,
    summary,
    isArchived,
    trimmedSummaryFallback = null,
  } = params;

  const snapshot = buildPersistedMessageSnapshot(messages);
  const summaryUpdate =
    summary !== undefined
      ? summary
      : snapshot.trimmed && !existingSummary
        ? trimmedSummaryFallback
        : undefined;

  const [result] = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .update(conversations)
      .set({
        ...(title !== undefined && { title }),
        ...(summaryUpdate !== undefined && { summary: summaryUpdate }),
        ...(isArchived !== undefined && { isArchived }),
        messageCount: messages.length,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .returning();

    if (!conversation) {
      return [];
    }

    const rows = buildConversationMessageRows({
      conversationId,
      messages: snapshot.messages,
    });

    await tx
      .delete(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId));

    if (rows.length > 0) {
      await tx.insert(conversationMessages).values(rows);
    }

    return [
      {
        conversation,
        messages: snapshot.messages,
      },
    ];
  });

  return result ?? null;
}

export async function persistConversationMessages(
  conversationId: string,
  userId: string,
  messages: UIMessage[],
): Promise<UIMessage[]> {
  const [existing] = await db
    .select({ summary: conversations.summary })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  if (!existing) {
    return messages;
  }

  const snapshot = buildPersistedMessageSnapshot(messages);
  const nextSummary = snapshot.trimmed
    ? await summarizeDroppedConversationMessages({
        existingSummary: existing?.summary ?? null,
        droppedMessages: snapshot.droppedMessages,
      })
    : (existing?.summary ?? null);

  await db.transaction(async (tx) => {
    await tx
      .update(conversations)
      .set({
        messageCount: messages.length,
        lastMessageAt: new Date(),
        summary: nextSummary,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));

    const rows = buildConversationMessageRows({
      conversationId,
      messages: snapshot.messages,
    });

    await tx
      .delete(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId));

    if (rows.length > 0) {
      await tx.insert(conversationMessages).values(rows);
    }
  });

  return loadConversationMessages(conversationId);
}
