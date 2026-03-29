/**
 * Profile Page - User Personal Space
 *
 * 展示用户信息、AI 学习统计、活动时间线等
 */

export const dynamic = "force-dynamic";

import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import {
  Brain,
  FileText,
  GraduationCap,
  MessageSquare,
  Settings,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SkillGraph } from "@/components/profile/SkillGraph";
import { SkillGraphSkeleton } from "@/components/profile/SkillGraphSkeleton";
import { FloatingHeader } from "@/components/shared/layout";
import { aiUsage, conversations, courses, db, notes } from "@/db";
import { auth } from "@/lib/auth";
import { ProfileSignOut } from "./profile-client";

// 获取用户统计数据
async function getUserStats(userId: string) {
  const [conversationCount, noteCount, courseCount, recentActivity, usageStats] = await Promise.all(
    [
      // 对话数量
      db
        .select({ count: count() })
        .from(conversations)
        .where(and(eq(conversations.userId, userId), gt(conversations.messageCount, 0))),

      db.select({ count: count() }).from(notes).where(eq(notes.userId, userId)),

      // 课程数量
      db.select({ count: count() }).from(courses).where(eq(courses.userId, userId)),

      // 最近活动
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

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fprofile");
  }

  const stats = await getUserStats(session.user.id);

  const statsCards = [
    {
      label: "学习对话",
      value: stats.conversations,
      icon: MessageSquare,
      href: "/",
    },
    {
      label: "学习笔记",
      value: stats.documents,
      icon: FileText,
      href: "/editor",
    },
    {
      label: "课程数量",
      value: stats.courses,
      icon: GraduationCap,
      href: "/interview",
    },
  ];

  return (
    <main className="ui-page-shell min-h-screen safe-top">
      <FloatingHeader showBackHint showMenuButton />

      <div className="mx-auto max-w-4xl px-4 pb-20 pt-20 md:px-6 md:pb-20 md:pt-28">
        <section className="mb-8">
          <div className="ui-badge-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-black/45">
            <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
            学习档案
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-black/90 md:text-5xl">
            你的学习记录
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-black/55">
            在这里查看课程、笔记、学习进度和 AI 使用情况。
          </p>
        </section>

        <section className="mb-8">
          <div className="ui-surface-card-lg rounded-3xl p-5 md:p-8">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="ui-primary-button flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold md:h-20 md:w-20 md:text-2xl">
                {session.user.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || session.user.email[0].toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="mb-1 truncate text-lg font-semibold text-[var(--color-text)] md:text-2xl">
                  {session.user.name || "学习者"}
                </h2>
                <p className="mb-3 truncate text-sm text-[var(--color-text-tertiary)] md:mb-4 md:text-base">
                  {session.user.email}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="ui-surface-soft flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[#eceff3] hover:text-[var(--color-text)]"
                  >
                    <Settings className="w-4 h-4" />
                    设置
                  </button>
                  <ProfileSignOut />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              学习概览
            </p>
            <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">你的学习数据</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4 sm:grid-cols-2 md:grid-cols-4">
            {statsCards.map((card) => {
              const Icon = card.icon;
              return (
                <a
                  key={card.label}
                  href={card.href}
                  className="ui-surface-card touch-target cursor-pointer rounded-2xl p-4 transition-shadow hover:[box-shadow:var(--shadow-soft-panel-hover)] active:scale-[0.98] md:p-5"
                >
                  <div className="ui-icon-chip mb-3 flex h-10 w-10 items-center justify-center md:h-11 md:w-11">
                    <Icon className="w-4 h-4 text-[var(--color-text-secondary)] md:w-5 md:h-5" />
                  </div>
                  <div className="mb-0.5 text-lg font-semibold text-[var(--color-text)] md:mb-1 md:text-2xl">
                    {card.value}
                  </div>
                  <div className="text-xs md:text-sm text-[var(--color-text-tertiary)]">
                    {card.label}
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              AI 使用情况
            </p>
            <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">本周使用</h2>
          </div>
          <div className="ui-surface-card rounded-2xl p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#f3f5f8] md:h-12 md:w-12">
                  <Zap className="w-5 h-5 text-[var(--color-text-secondary)] md:w-6 md:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs md:text-sm text-[var(--color-text-tertiary)]">请求数</div>
                  <div className="text-base md:text-xl font-semibold text-[var(--color-text)] truncate">
                    {stats.aiUsage.requestCount}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#f3f5f8] md:h-12 md:w-12">
                  <TrendingUp className="w-5 h-5 text-[var(--color-text-secondary)] md:w-6 md:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs md:text-sm text-[var(--color-text-tertiary)]">
                    Token 数
                  </div>
                  <div className="text-base md:text-xl font-semibold text-[var(--color-text)]">
                    {(stats.aiUsage.totalTokens / 1000).toFixed(1)}k
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#f3f5f8] md:h-12 md:w-12">
                  <Target className="w-5 h-5 text-[var(--color-text-secondary)] md:w-6 md:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs md:text-sm text-[var(--color-text-tertiary)]">
                    预估花费
                  </div>
                  <div className="text-base md:text-xl font-semibold text-[var(--color-text)]">
                    ${stats.aiUsage.totalCost.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <Suspense fallback={<SkillGraphSkeleton />}>
            <SkillGraph userId={session.user.id} />
          </Suspense>
        </section>

        <section>
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              最近活动
            </p>
            <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">继续之前的对话</h2>
          </div>
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_20px_48px_-34px_rgba(15,23,42,0.16)]">
            {stats.recentActivity.length > 0 ? (
              <div className="space-y-1 p-1">
                {stats.recentActivity.map((activity) => (
                  <a
                    key={activity.id}
                    href={`/chat/${activity.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-[var(--color-hover)] transition-colors"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#f3f5f8]">
                      <MessageSquare className="w-5 h-5 text-[var(--color-text-secondary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--color-text)] truncate">
                        {activity.title}
                      </div>
                      <div className="text-sm text-[var(--color-text-tertiary)]">
                        {activity.updatedAt
                          ? new Date(activity.updatedAt).toLocaleDateString("zh-CN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "最近"}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-[var(--color-text-muted)]">
                <Brain className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p>还没有最近活动</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
