import type { UIMessage } from "ai";
import { conversationMessages, conversations, db, eq } from "@/db";
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
  activeStreamId: string | null,
): Promise<void> {
  const [existing] = await db
    .select({ metadata: conversations.metadata })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

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
    .where(eq(conversations.id, conversationId));
}

export async function getConversationActiveStreamId(
  conversationId: string,
): Promise<string | null> {
  const [existing] = await db
    .select({ metadata: conversations.metadata })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  const metadata = normalizeMetadata(existing?.metadata);
  const activeStreamId = metadata.activeStreamId;

  return typeof activeStreamId === "string" && activeStreamId.length > 0 ? activeStreamId : null;
}

export async function persistConversationMessages(
  conversationId: string,
  messages: UIMessage[],
): Promise<UIMessage[]> {
  const [existing] = await db
    .select({ summary: conversations.summary })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

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
      .where(eq(conversations.id, conversationId));

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
