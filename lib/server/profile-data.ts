import "server-only";

import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { aiUsage, conversations, courses, db, notes } from "@/db";
import { getProfileStatsTag } from "@/lib/cache/tags";

export interface ProfileStats {
  conversations: number;
  documents: number;
  courses: number;
  recentActivity: Array<{
    id: string;
    title: string;
    updatedAt: Date | null;
  }>;
  aiUsage: {
    totalTokens: number;
    totalCost: number;
    requestCount: number;
  };
}

export async function getUserStatsCached(userId: string): Promise<ProfileStats> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getProfileStatsTag(userId));

  const [conversationCount, noteCount, courseCount, recentActivity, usageStats] = await Promise.all(
    [
      db
        .select({ count: count() })
        .from(conversations)
        .where(and(eq(conversations.userId, userId), gt(conversations.messageCount, 0))),

      db.select({ count: count() }).from(notes).where(eq(notes.userId, userId)),

      db.select({ count: count() }).from(courses).where(eq(courses.userId, userId)),

      db
        .select({
          id: conversations.id,
          title: conversations.title,
          updatedAt: conversations.updatedAt,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            gt(conversations.messageCount, 0),
            eq(conversations.isArchived, false),
          ),
        )
        .orderBy(desc(conversations.updatedAt))
        .limit(5),

      db
        .select({
          requestCount: count(),
          totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
          totalCostCents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)`,
        })
        .from(aiUsage)
        .where(eq(aiUsage.userId, userId)),
    ],
  );

  const usage = usageStats[0];

  return {
    conversations: conversationCount[0]?.count || 0,
    documents: noteCount[0]?.count || 0,
    courses: courseCount[0]?.count || 0,
    recentActivity,
    aiUsage: {
      totalTokens: Number(usage?.totalTokens ?? 0),
      totalCost: Number(usage?.totalCostCents ?? 0) / 100,
      requestCount: usage?.requestCount || 0,
    },
  };
}
