import { and, conversations, db, eq } from "@/db";

type ConversationRecord = typeof conversations.$inferSelect;

export interface OwnedConversationUpdate {
  title?: string;
  intent?: string;
  summary?: string | null;
  messageCount?: number | null;
  lastMessageAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  isArchived?: boolean | null;
  updatedAt?: Date | null;
  titleGeneratedAt?: Date | null;
}

export class ConversationUnavailableError extends Error {
  constructor() {
    super("Conversation is unavailable for this user");
    this.name = "ConversationUnavailableError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function getOwnedConversation(
  conversationId: string,
  userId: string,
): Promise<ConversationRecord | null> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  return conversation ?? null;
}

export async function getOwnedLearnConversation(params: {
  userId: string;
  courseId: string;
  chapterIndex: number;
}): Promise<ConversationRecord | null> {
  const { userId, courseId, chapterIndex } = params;
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.intent, "LEARN"),
        eq(conversations.learnCourseId, courseId),
        eq(conversations.learnChapterIndex, chapterIndex),
      ),
    )
    .limit(1);

  return conversation ?? null;
}

export async function getOwnedConversationSummary(
  conversationId: string,
  userId: string,
): Promise<string | null> {
  const conversation = await getOwnedConversation(conversationId, userId);
  return conversation?.summary ?? null;
}

export async function updateOwnedConversation(params: {
  conversationId: string;
  userId: string;
  updates: OwnedConversationUpdate;
}): Promise<ConversationRecord | null> {
  const { conversationId, userId, updates } = params;
  const [updated] = await db
    .update(conversations)
    .set(updates)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning();

  return updated ?? null;
}

export async function deleteOwnedConversation(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const [deleted] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });

  return Boolean(deleted);
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
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const [racedUpdate] = await db
      .update(conversations)
      .set({
        messageCount,
        lastMessageAt: new Date(),
      })
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .returning({ id: conversations.id });

    if (racedUpdate) {
      return;
    }

    throw new ConversationUnavailableError();
  }
}
