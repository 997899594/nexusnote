import { conversations, db } from "@/db";
import {
  getOwnedLearnConversation,
  updateOwnedConversation,
} from "@/lib/chat/conversation-repository";

interface EnsureLearnConversationInput {
  userId: string;
  courseId: string;
  courseTitle: string;
  chapterIndex: number;
  chapterTitle: string;
}

interface LearnConversationMetadata extends Record<string, unknown> {
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
  const refreshMetadata = async (
    conversation: NonNullable<Awaited<ReturnType<typeof getOwnedLearnConversation>>>,
  ) => {
    const shouldRefreshMetadata =
      conversation.title !== title ||
      !conversation.metadata ||
      typeof conversation.metadata !== "object" ||
      (conversation.metadata as Record<string, unknown>).chapterTitle !== input.chapterTitle ||
      (conversation.metadata as Record<string, unknown>).courseTitle !== input.courseTitle;

    if (!shouldRefreshMetadata) {
      return conversation;
    }

    const updated = await updateOwnedConversation({
      conversationId: conversation.id,
      userId: input.userId,
      updates: {
        title,
        metadata,
        updatedAt: new Date(),
      },
    });

    return updated ?? conversation;
  };

  const existing = await getOwnedLearnConversation({
    userId: input.userId,
    courseId: input.courseId,
    chapterIndex: input.chapterIndex,
  });

  if (existing) {
    return refreshMetadata(existing);
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
      learnCourseId: input.courseId,
      learnChapterIndex: input.chapterIndex,
      metadata,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const raced = await getOwnedLearnConversation({
    userId: input.userId,
    courseId: input.courseId,
    chapterIndex: input.chapterIndex,
  });

  if (!raced) {
    throw new Error("Learn conversation upsert race without persisted row");
  }

  return refreshMetadata(raced);
}
