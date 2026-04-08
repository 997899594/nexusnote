import { and, conversations, db, eq } from "@/db";

interface ConversationOwnershipRecord {
  userId: string | null;
  summary: string | null;
}

export interface OwnedConversationSummary {
  exists: boolean;
  summary: string | null;
}

export class ConversationOwnershipError extends Error {
  constructor() {
    super("Conversation ownership mismatch");
    this.name = "ConversationOwnershipError";
  }
}

async function getConversationOwnershipRecord(
  conversationId: string,
): Promise<ConversationOwnershipRecord | null> {
  const [conversation] = await db
    .select({
      userId: conversations.userId,
      summary: conversations.summary,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return conversation ?? null;
}

export async function getOwnedConversationSummary(
  conversationId: string,
  userId: string,
): Promise<OwnedConversationSummary> {
  const conversation = await getConversationOwnershipRecord(conversationId);

  if (!conversation) {
    return {
      exists: false,
      summary: null,
    };
  }

  if (conversation.userId !== userId) {
    throw new ConversationOwnershipError();
  }

  return {
    exists: true,
    summary: conversation.summary ?? null,
  };
}

export async function touchOwnedConversation(params: {
  conversationId: string;
  userId: string;
  title: string;
  messageCount: number;
  intent: "CHAT";
}): Promise<void> {
  const { conversationId, userId, title, messageCount, intent } = params;

  const [updated] = await db
    .update(conversations)
    .set({
      messageCount,
      lastMessageAt: new Date(),
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });

  if (updated) {
    return;
  }

  try {
    await db.insert(conversations).values({
      id: conversationId,
      userId,
      title,
      intent,
      messageCount,
    });
    return;
  } catch {
    const conversation = await getConversationOwnershipRecord(conversationId);

    if (!conversation) {
      throw new Error("Conversation upsert race without persisted row");
    }

    if (conversation.userId !== userId) {
      throw new ConversationOwnershipError();
    }

    await db
      .update(conversations)
      .set({
        messageCount,
        lastMessageAt: new Date(),
      })
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  }
}
