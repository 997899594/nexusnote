import { and, asc, conversations, db, eq, sql } from "@/db";

interface EnsureLearnConversationInput {
  userId: string;
  courseId: string;
  courseTitle: string;
  chapterIndex: number;
  chapterTitle: string;
}

interface LearnConversationMetadata {
  context: "learn";
  courseId: string;
  courseTitle: string;
  chapterIndex: number;
  chapterTitle: string;
}

function buildLearnConversationTitle(chapterIndex: number, chapterTitle: string): string {
  const cleanTitle = chapterTitle.trim();
  if (cleanTitle.length > 0) {
    return `第 ${chapterIndex + 1} 章 · ${cleanTitle}`.slice(0, 100);
  }
  return `第 ${chapterIndex + 1} 章对话`;
}

function buildLearnConversationMetadata(
  input: EnsureLearnConversationInput,
): LearnConversationMetadata {
  return {
    context: "learn",
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    chapterIndex: input.chapterIndex,
    chapterTitle: input.chapterTitle,
  };
}

export async function ensureLearnConversation(input: EnsureLearnConversationInput) {
  const metadata = buildLearnConversationMetadata(input);
  const title = buildLearnConversationTitle(input.chapterIndex, input.chapterTitle);

  const [existing] = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      intent: conversations.intent,
      messageCount: conversations.messageCount,
      lastMessageAt: conversations.lastMessageAt,
      metadata: conversations.metadata,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, input.userId),
        eq(conversations.intent, "LEARN"),
        sql`${conversations.metadata} ->> 'context' = 'learn'`,
        sql`${conversations.metadata} ->> 'courseId' = ${input.courseId}`,
        sql`${conversations.metadata} ->> 'chapterIndex' = ${String(input.chapterIndex)}`,
      ),
    )
    .orderBy(asc(conversations.createdAt))
    .limit(1);

  if (existing) {
    const shouldRefreshMetadata =
      existing.title !== title ||
      !existing.metadata ||
      typeof existing.metadata !== "object" ||
      (existing.metadata as Record<string, unknown>).chapterTitle !== input.chapterTitle ||
      (existing.metadata as Record<string, unknown>).courseTitle !== input.courseTitle;

    if (shouldRefreshMetadata) {
      const [updated] = await db
        .update(conversations)
        .set({
          title,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, existing.id))
        .returning();

      return updated ?? existing;
    }

    return existing;
  }

  const now = new Date();
  const [created] = await db
    .insert(conversations)
    .values({
      userId: input.userId,
      title,
      intent: "LEARN",
      messageCount: 0,
      lastMessageAt: now,
      metadata,
    })
    .returning();

  return created;
}
