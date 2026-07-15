import type { UIMessage } from "ai";
import { and, conversationMessages, conversations, db, eq, sql } from "@/db";
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

async function appendConversationMessages(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  conversationId: string,
  messages: UIMessage[],
): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${conversationId}, 0))`);

  const rows = buildConversationMessageRows({
    conversationId,
    messages,
  });

  const existingRows = await tx
    .select({
      messageId: conversationMessages.messageId,
      position: conversationMessages.position,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId));
  const positionByMessageId = new Map(
    existingRows.map((row) => [row.messageId, row.position] as const),
  );
  let nextPosition = existingRows.reduce((max, row) => Math.max(max, row.position), -1) + 1;

  for (const row of rows) {
    const existingPosition = positionByMessageId.get(row.messageId);
    const position = existingPosition ?? nextPosition++;
    await tx
      .insert(conversationMessages)
      .values({ ...row, position })
      .onConflictDoUpdate({
        target: [conversationMessages.conversationId, conversationMessages.messageId],
        set: {
          role: row.role,
          message: row.message,
          textContent: row.textContent,
        },
      });
  }

  const [count] = await tx
    .select({ value: sql<number>`count(*)::integer` })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId));
  return count?.value ?? 0;
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
}) {
  return {
    ...(params.title !== undefined && { title: params.title }),
    ...(params.summary !== undefined && { summary: params.summary }),
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
  await db
    .update(conversations)
    .set({
      activeStreamId,
      updatedAt: new Date(),
    })
    .where(matchOwnedConversation(conversationId, userId));
}

export async function clearConversationActiveStreamId(
  conversationId: string,
  userId: string,
  expectedStreamId?: string,
): Promise<void> {
  await db
    .update(conversations)
    .set({ activeStreamId: null, updatedAt: new Date() })
    .where(
      and(
        matchOwnedConversation(conversationId, userId),
        expectedStreamId ? eq(conversations.activeStreamId, expectedStreamId) : undefined,
      ),
    );
}

export async function getConversationActiveStreamId(
  conversationId: string,
  userId: string,
): Promise<string | null> {
  const loadedConversation = await loadOwnedConversationWithMetadata(conversationId, userId);
  return loadedConversation?.conversation.activeStreamId ?? null;
}

export async function saveOwnedConversationSnapshot(params: {
  conversationId: string;
  userId: string;
  existingSummary: string | null;
  messages: UIMessage[];
  title?: string;
  summary?: string | null;
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
    const [ownedConversation] = await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(matchOwnedConversation(conversationId, userId))
      .returning();

    if (!ownedConversation) {
      return [];
    }

    const messageCount = await appendConversationMessages(tx, conversationId, snapshot.messages);
    const [conversation] = await tx
      .update(conversations)
      .set(buildConversationActivityUpdate({ title, summary: summaryUpdate, messageCount }))
      .where(matchOwnedConversation(conversationId, userId))
      .returning();

    return [
      {
        conversation: conversation ?? ownedConversation,
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
    const messageCount = await appendConversationMessages(tx, conversationId, snapshot.messages);
    await tx
      .update(conversations)
      .set(
        buildConversationActivityUpdate({
          messageCount,
          summary: nextSummary,
        }),
      )
      .where(matchOwnedConversation(conversationId, userId));
  });

  return loadConversationMessages(conversationId);
}
