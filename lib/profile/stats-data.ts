import "server-only";

import { and, count, eq, gt } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { conversations, courses, db, notes } from "@/db";
import { getProfileStatsTag } from "@/lib/cache/tags";

export interface ProfileOverview {
  conversations: number;
  documents: number;
  courses: number;
}

function readCount(rows: Array<{ count: number }>): number {
  return Number(rows[0]?.count ?? 0);
}

export function getProfileStatsWindowStart(referenceDate = new Date()): Date {
  const windowStart = new Date(referenceDate);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - 6);
  return windowStart;
}

export async function getUserProfileOverviewCached(userId: string): Promise<ProfileOverview> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getProfileStatsTag(userId));

  const [conversationCount, noteCount, courseCount] = await Promise.all([
    db
      .select({ count: count() })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), gt(conversations.messageCount, 0))),
    db.select({ count: count() }).from(notes).where(eq(notes.userId, userId)),
    db.select({ count: count() }).from(courses).where(eq(courses.userId, userId)),
  ]);

  return {
    conversations: readCount(conversationCount),
    documents: readCount(noteCount),
    courses: readCount(courseCount),
  };
}
