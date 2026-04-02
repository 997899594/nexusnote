import "server-only";

import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { aiUsage, conversations, courses, db, notes } from "@/db";
import { getProfileStatsTag } from "@/lib/cache/tags";

interface AIUsageBreakdownItem {
  key: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

interface AIUsageDailyItem {
  dayKey: string;
  label: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

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
    windowStart: Date;
    totalTokens: number;
    totalCost: number;
    requestCount: number;
    activeDays: number;
    avgTokensPerRequest: number;
    avgCostPerRequest: number;
    peakDay: AIUsageDailyItem | null;
    daily: AIUsageDailyItem[];
    byPolicy: AIUsageBreakdownItem[];
    byWorkflow: AIUsageBreakdownItem[];
    byProvider: AIUsageBreakdownItem[];
  };
}

export function getProfileStatsWindowStart(referenceDate = new Date()): Date {
  const windowStart = new Date(referenceDate);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - 6);
  return windowStart;
}

export async function getUserStatsCached(
  userId: string,
  windowStartIso: string,
): Promise<ProfileStats> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getProfileStatsTag(userId));
  const windowStart = new Date(windowStartIso);

  const [
    conversationCount,
    noteCount,
    courseCount,
    recentActivity,
    usageStats,
    usageByDay,
    usageByPolicy,
    usageByWorkflow,
    usageByProvider,
  ] = await Promise.all([
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
      .where(and(eq(aiUsage.userId, userId), gt(aiUsage.createdAt, windowStart))),

    db
      .select({
        dayKey: sql<string>`to_char(date_trunc('day', ${aiUsage.createdAt}), 'YYYY-MM-DD')`,
        requestCount: count(),
        totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
        totalCostCents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)`,
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gt(aiUsage.createdAt, windowStart)))
      .groupBy(sql`date_trunc('day', ${aiUsage.createdAt})`)
      .orderBy(sql`date_trunc('day', ${aiUsage.createdAt}) asc`),

    db
      .select({
        key: sql<string>`coalesce(${aiUsage.modelPolicy}, ${aiUsage.metadata} ->> 'modelPolicy', 'unknown')`,
        requestCount: count(),
        totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
        totalCostCents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)`,
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gt(aiUsage.createdAt, windowStart)))
      .groupBy(
        sql`coalesce(${aiUsage.modelPolicy}, ${aiUsage.metadata} ->> 'modelPolicy', 'unknown')`,
      )
      .orderBy(desc(count()))
      .limit(3),

    db
      .select({
        key: sql<string>`coalesce(${aiUsage.workflow}, ${aiUsage.endpoint}, 'unknown')`,
        requestCount: count(),
        totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
        totalCostCents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)`,
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gt(aiUsage.createdAt, windowStart)))
      .groupBy(sql`coalesce(${aiUsage.workflow}, ${aiUsage.endpoint}, 'unknown')`)
      .orderBy(desc(count()))
      .limit(4),

    db
      .select({
        key: sql<string>`coalesce(${aiUsage.provider}, ${aiUsage.metadata} ->> 'provider', 'unknown')`,
        requestCount: count(),
        totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
        totalCostCents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)`,
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gt(aiUsage.createdAt, windowStart)))
      .groupBy(sql`coalesce(${aiUsage.provider}, ${aiUsage.metadata} ->> 'provider', 'unknown')`)
      .orderBy(desc(count()))
      .limit(3),
  ]);

  const usage = usageStats[0];
  const dailyByKey = new Map(
    usageByDay.map((row) => [
      row.dayKey,
      {
        requestCount: Number(row.requestCount ?? 0),
        totalTokens: Number(row.totalTokens ?? 0),
        totalCost: Number(row.totalCostCents ?? 0) / 100,
      },
    ]),
  );
  const normalizeBreakdown = (
    rows: Array<{
      key: string;
      requestCount: number;
      totalTokens: number;
      totalCostCents: number;
    }>,
  ): AIUsageBreakdownItem[] =>
    rows.map((row) => ({
      key: row.key,
      requestCount: Number(row.requestCount ?? 0),
      totalTokens: Number(row.totalTokens ?? 0),
      totalCost: Number(row.totalCostCents ?? 0) / 100,
    }));
  const daily = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(windowStart);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + index);

    const dayKey = day.toLocaleDateString("sv-SE");
    const usageForDay = dailyByKey.get(dayKey);

    return {
      dayKey,
      label: day.toLocaleDateString("zh-CN", { weekday: "short" }),
      requestCount: usageForDay?.requestCount ?? 0,
      totalTokens: usageForDay?.totalTokens ?? 0,
      totalCost: usageForDay?.totalCost ?? 0,
    };
  });
  const requestCount = Number(usage?.requestCount ?? 0);
  const totalTokens = Number(usage?.totalTokens ?? 0);
  const totalCost = Number(usage?.totalCostCents ?? 0) / 100;
  const activeDays = daily.filter((item) => item.requestCount > 0).length;
  const peakDay =
    daily.reduce<AIUsageDailyItem | null>((currentPeak, item) => {
      if (item.requestCount <= 0) {
        return currentPeak;
      }

      if (!currentPeak || item.requestCount > currentPeak.requestCount) {
        return item;
      }

      if (
        item.requestCount === currentPeak.requestCount &&
        item.totalTokens > currentPeak.totalTokens
      ) {
        return item;
      }

      return currentPeak;
    }, null) ?? null;

  return {
    conversations: conversationCount[0]?.count || 0,
    documents: noteCount[0]?.count || 0,
    courses: courseCount[0]?.count || 0,
    recentActivity,
    aiUsage: {
      windowStart,
      totalTokens,
      totalCost,
      requestCount,
      activeDays,
      avgTokensPerRequest: requestCount > 0 ? totalTokens / requestCount : 0,
      avgCostPerRequest: requestCount > 0 ? totalCost / requestCount : 0,
      peakDay,
      daily,
      byPolicy: normalizeBreakdown(usageByPolicy),
      byWorkflow: normalizeBreakdown(usageByWorkflow),
      byProvider: normalizeBreakdown(usageByProvider),
    },
  };
}
