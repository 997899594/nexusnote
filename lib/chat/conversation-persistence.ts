import type { UIMessage } from "ai";
import { conversationMessages, conversations, db, eq } from "@/db";
import { summarizeDroppedConversationMessages } from "@/lib/chat/conversation-memory";
import {
  buildConversationMessageRows,
  loadConversationMessages,
} from "@/lib/chat/conversation-messages";
import { getOwnedConversation, matchOwnedConversation } from "@/lib/chat/conversation-repository";

type ConversationMetadata = Record<string, unknown>;
type OwnedConversationRecord = NonNullable<Awaited<ReturnType<typeof getOwnedConversation>>>;
interface PersistedMessageSnapshot {
  messages: UIMessage[];
  droppedMessages: UIMessage[];
  droppedCount: number;
  trimmed: boolean;
}

const MAX_PERSISTED_MESSAGES = 80;
const MAX_PERSISTED_MESSAGE_BYTES = 120_000;

function normalizeMetadata(metadata: unknown): ConversationMetadata {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as ConversationMetadata;
  }

  return {};
}

function getSerializedMessageBytes(messages: UIMessage[]): number {
  return new TextEncoder().encode(JSON.stringify(messages)).length;
}

function buildPersistedMessageSnapshot(messages: UIMessage[]): PersistedMessageSnapshot {
  if (messages.length === 0) {
    return {
      messages,
      droppedMessages: [],
      droppedCount: 0,
      trimmed: false,
    };
  }

  let persisted = messages.slice(-MAX_PERSISTED_MESSAGES);
  let droppedCount = Math.max(0, messages.length - persisted.length);

  while (
    persisted.length > 1 &&
    getSerializedMessageBytes(persisted) > MAX_PERSISTED_MESSAGE_BYTES
  ) {
    persisted = persisted.slice(1);
    droppedCount += 1;
  }

  return {
    messages: persisted,
    droppedMessages: messages.slice(0, Math.max(0, messages.length - persisted.length)),
    droppedCount,
    trimmed: droppedCount > 0,
  };
}

async function replaceConversationMessages(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  conversationId: string,
  messages: UIMessage[],
): Promise<void> {
  const rows = buildConversationMessageRows({
    conversationId,
    messages,
  });

  await tx
    .delete(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId));

  if (rows.length === 0) {
    return;
  }

  await tx.insert(conversationMessages).values(rows);
}

async function loadOwnedConversationWithMetadata(
  conversationId: string,
  userId: string,
): Promise<{
  conversation: OwnedConversationRecord;
  metadata: ConversationMetadata;
} | null> {
  const conversation = await getOwnedConversation(conversationId, userId);
  if (!conversation) {
    return null;
  }

  return {
    conversation,
    metadata: normalizeMetadata(conversation.metadata),
  };
}

function buildConversationActivityUpdate(params: {
  messageCount: number;
  title?: string;
  summary?: string | null;
  isArchived?: boolean;
}) {
  return {
    ...(params.title !== undefined && { title: params.title }),
    ...(params.summary !== undefined && { summary: params.summary }),
    ...(params.isArchived !== undefined && { isArchived: params.isArchived }),
    messageCount: params.messageCount,
    lastMessageAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function setConversationActiveStreamId(
  conversationId: string,
  userId: string,
  activeStreamId: string | null,
): Promise<void> {
  const loadedConversation = await loadOwnedConversationWithMetadata(conversationId, userId);
  if (!loadedConversation) {
    return;
  }

  const nextMetadata = {
    ...loadedConversation.metadata,
    activeStreamId,
  };

  await db
    .update(conversations)
    .set({
      metadata: nextMetadata,
      updatedAt: new Date(),
    })
    .where(matchOwnedConversation(conversationId, userId));
}

export async function getConversationActiveStreamId(
  conversationId: string,
  userId: string,
): Promise<string | null> {
  const loadedConversation = await loadOwnedConversationWithMetadata(conversationId, userId);
  const activeStreamId = loadedConversation?.metadata.activeStreamId;

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
      .set(
        buildConversationActivityUpdate({
          title,
          summary: summaryUpdate,
          isArchived,
          messageCount: messages.length,
        }),
      )
      .where(matchOwnedConversation(conversationId, userId))
      .returning();

    if (!conversation) {
      return [];
    }

    await replaceConversationMessages(tx, conversationId, snapshot.messages);

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
  const loadedConversation = await loadOwnedConversationWithMetadata(conversationId, userId);
  if (!loadedConversation) {
    return messages;
  }

  const snapshot = buildPersistedMessageSnapshot(messages);
  const nextSummary = snapshot.trimmed
    ? await summarizeDroppedConversationMessages({
        existingSummary: loadedConversation.conversation.summary ?? null,
        droppedMessages: snapshot.droppedMessages,
      })
    : (loadedConversation.conversation.summary ?? null);

  await db.transaction(async (tx) => {
    await tx
      .update(conversations)
      .set(
        buildConversationActivityUpdate({
          messageCount: messages.length,
          summary: nextSummary,
        }),
      )
      .where(matchOwnedConversation(conversationId, userId));

    await replaceConversationMessages(tx, conversationId, snapshot.messages);
  });

  return loadConversationMessages(conversationId);
}
