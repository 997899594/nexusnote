import "server-only";

import { and, count, desc, eq, gt, type SQL, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { aiUsage, conversations, courses, db, notes } from "@/db";
import { getProfileStatsTag } from "@/lib/cache/tags";

export interface ProfileAIUsageBreakdownItem {
  key: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

export interface ProfileAIUsageDailyItem {
  dayKey: string;
  label: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

export interface ProfileRecentActivityItem {
  id: string;
  title: string;
  updatedAt: Date | null;
}

export interface ProfileOverview {
  conversations: number;
  documents: number;
  courses: number;
  recentActivity: ProfileRecentActivityItem[];
}

export interface ProfileAIUsageStats {
  windowStart: Date;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  activeDays: number;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;
  peakDay: ProfileAIUsageDailyItem | null;
  daily: ProfileAIUsageDailyItem[];
  byPolicy: ProfileAIUsageBreakdownItem[];
  byWorkflow: ProfileAIUsageBreakdownItem[];
  byProvider: ProfileAIUsageBreakdownItem[];
}

type CountRow = { count: number };

type UsageBreakdownRow = {
  key: string;
  requestCount: number;
  totalTokens: number;
  totalCostCents: number;
};

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function toCost(totalCostCents: number | string | null | undefined): number {
  return toNumber(totalCostCents) / 100;
}

function readCount(rows: CountRow[]): number {
  return toNumber(rows[0]?.count);
}

function normalizeUsageBreakdown(rows: UsageBreakdownRow[]): ProfileAIUsageBreakdownItem[] {
  return rows.map((row) => ({
    key: row.key,
    requestCount: toNumber(row.requestCount),
    totalTokens: toNumber(row.totalTokens),
    totalCost: toCost(row.totalCostCents),
  }));
}

function buildDailyUsage(
  windowStart: Date,
  usageByDay: Array<{
    dayKey: string;
    requestCount: number;
    totalTokens: number;
    totalCostCents: number;
  }>,
): ProfileAIUsageDailyItem[] {
  const dailyByKey = new Map(
    usageByDay.map((row) => [
      row.dayKey,
      {
        requestCount: toNumber(row.requestCount),
        totalTokens: toNumber(row.totalTokens),
        totalCost: toCost(row.totalCostCents),
      },
    ]),
  );

  return Array.from({ length: 7 }, (_, index) => {
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
}

function pickPeakUsageDay(daily: ProfileAIUsageDailyItem[]): ProfileAIUsageDailyItem | null {
  return (
    daily.reduce<ProfileAIUsageDailyItem | null>((currentPeak, item) => {
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
    }, null) ?? null
  );
}

async function loadUsageBreakdown(params: {
  userId: string;
  windowStart: Date;
  keyExpression: SQL<string>;
  limit: number;
}): Promise<UsageBreakdownRow[]> {
  return db
    .select({
      key: params.keyExpression,
      requestCount: count(),
      totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
      totalCostCents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, params.userId), gt(aiUsage.createdAt, params.windowStart)))
    .groupBy(params.keyExpression)
    .orderBy(desc(count()))
    .limit(params.limit);
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

  const [conversationCount, noteCount, courseCount, recentActivity] = await Promise.all([
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
  ]);

  return {
    conversations: readCount(conversationCount),
    documents: readCount(noteCount),
    courses: readCount(courseCount),
    recentActivity,
  };
}

export async function getUserProfileInsightsCached(
  userId: string,
  windowStartIso: string,
): Promise<ProfileAIUsageStats> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getProfileStatsTag(userId));
  const windowStart = new Date(windowStartIso);
  const usageWindowWhere = and(eq(aiUsage.userId, userId), gt(aiUsage.createdAt, windowStart));

  const [usageStats, usageByDay, usageByPolicy, usageByWorkflow, usageByProvider] =
    await Promise.all([
      db
        .select({
          requestCount: count(),
          totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
          totalCostCents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)`,
        })
        .from(aiUsage)
        .where(usageWindowWhere),

      db
        .select({
          dayKey: sql<string>`to_char(date_trunc('day', ${aiUsage.createdAt}), 'YYYY-MM-DD')`,
          requestCount: count(),
          totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
          totalCostCents: sql<number>`coalesce(sum(${aiUsage.costCents}), 0)`,
        })
        .from(aiUsage)
        .where(usageWindowWhere)
        .groupBy(sql`date_trunc('day', ${aiUsage.createdAt})`)
        .orderBy(sql`date_trunc('day', ${aiUsage.createdAt}) asc`),

      loadUsageBreakdown({
        userId,
        windowStart,
        keyExpression: sql<string>`coalesce(${aiUsage.modelPolicy}, ${aiUsage.metadata} ->> 'modelPolicy', 'unknown')`,
        limit: 3,
      }),

      loadUsageBreakdown({
        userId,
        windowStart,
        keyExpression: sql<string>`coalesce(${aiUsage.workflow}, ${aiUsage.endpoint}, 'unknown')`,
        limit: 4,
      }),

      loadUsageBreakdown({
        userId,
        windowStart,
        keyExpression: sql<string>`coalesce(${aiUsage.provider}, ${aiUsage.metadata} ->> 'provider', 'unknown')`,
        limit: 3,
      }),
    ]);

  const usage = usageStats[0];
  const daily = buildDailyUsage(windowStart, usageByDay);
  const requestCount = toNumber(usage?.requestCount);
  const totalTokens = toNumber(usage?.totalTokens);
  const totalCost = toCost(usage?.totalCostCents);
  const activeDays = daily.filter((item) => item.requestCount > 0).length;
  const peakDay = pickPeakUsageDay(daily);

  return {
    windowStart,
    totalTokens,
    totalCost,
    requestCount,
    activeDays,
    avgTokensPerRequest: requestCount > 0 ? totalTokens / requestCount : 0,
    avgCostPerRequest: requestCount > 0 ? totalCost / requestCount : 0,
    peakDay,
    daily,
    byPolicy: normalizeUsageBreakdown(usageByPolicy),
    byWorkflow: normalizeUsageBreakdown(usageByWorkflow),
    byProvider: normalizeUsageBreakdown(usageByProvider),
  };
}
