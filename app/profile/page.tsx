/**
 * Profile Page - User Personal Space
 *
 * 展示用户信息、AI 学习统计、活动时间线等
 */

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  conversations,
  documents,
  courseProfiles,
  flashcards,
} from "@/db";
import { desc, count, eq, and, gt } from "drizzle-orm";
import { FloatingHeader } from "@/components/shared/layout";
import { SkillGraph } from "@/components/profile/SkillGraph";
import { SkillGraphSkeleton } from "@/components/profile/SkillGraphSkeleton";
import {
  Brain,
  MessageSquare,
  FileText,
  GraduationCap,
  StickyNote,
  Zap,
  TrendingUp,
  Clock,
  Target,
  Settings,
} from "lucide-react";
import { ProfileSignOut } from "./profile-client";

// 获取用户统计数据
async function getUserStats(userId: string) {
  const [
    conversationCount,
    documentCount,
    courseCount,
    flashcardCount,
    recentActivity,
  ] = await Promise.all([
    // 对话数量
    db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(eq(conversations.userId, userId), gt(conversations.messageCount, 0)),
      ),

    // Note: documents are workspace-scoped, showing all accessible documents
    db.select({ count: count() }).from(documents),

    // 课程数量
    db
      .select({ count: count() })
      .from(courseProfiles)
      .where(eq(courseProfiles.userId, userId)),

    // Note: flashcards are workspace-scoped, showing all accessible flashcards
    db.select({ count: count() }).from(flashcards),

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
  ]);

  return {
    conversations: conversationCount[0]?.count || 0,
    documents: documentCount[0]?.count || 0,
    courses: courseCount[0]?.count || 0,
    flashcards: flashcardCount[0]?.count || 0,
    recentActivity,
    aiUsage: {
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0,
    },
  };
}

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const stats = await getUserStats(session.user.id);

  const statsCards = [
    {
      label: "AI 对话",
      value: stats.conversations,
      icon: MessageSquare,
      color: "bg-blue-500",
      href: "/",
    },
    {
      label: "学习笔记",
      value: stats.documents,
      icon: FileText,
      color: "bg-emerald-500",
      href: "/editor",
    },
    {
      label: "AI 课程",
      value: stats.courses,
      icon: GraduationCap,
      color: "bg-purple-500",
      href: "/interview",
    },
    {
      label: "闪卡复习",
      value: stats.flashcards,
      icon: StickyNote,
      color: "bg-amber-500",
      href: "/flashcards",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <FloatingHeader showBackHint />

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        {/* 用户信息卡片 */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-[var(--shadow-elevated)] p-8">
            <div className="flex items-start gap-6">
              {/* 头像 */}
              <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center text-[var(--color-accent-fg)] text-2xl font-bold flex-shrink-0">
                {session.user.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || session.user.email[0].toUpperCase()}
              </div>

              {/* 信息 */}
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-zinc-900 mb-1">
                  {session.user.name || "学习者"}
                </h1>
                <p className="text-zinc-500 mb-4">{session.user.email}</p>

                {/* 快捷操作 */}
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors">
                    <Settings className="w-4 h-4" />
                    设置
                  </button>
                  <ProfileSignOut />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI 学习统计 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-700 mb-4">AI 学习统计</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statsCards.map((card) => {
              const Icon = card.icon;
              return (
                <a
                  key={card.label}
                  href={card.href}
                  className="bg-white rounded-xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] p-5 transition-shadow cursor-pointer"
                >
                  <div className={`${card.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-zinc-900 mb-1">
                    {card.value}
                  </div>
                  <div className="text-sm text-zinc-500">{card.label}</div>
                </a>
              );
            })}
          </div>
        </section>

        {/* AI 使用统计 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-700 mb-4">
            <Brain className="w-5 h-5 inline mr-2 text-violet-500" />
            AI 使用情况
          </h2>
          <div className="bg-white rounded-xl shadow-[var(--shadow-card)] p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <div className="text-sm text-zinc-500">请求数</div>
                  <div className="text-xl font-semibold text-zinc-900">
                    {stats.aiUsage.requestCount}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-zinc-500">Token 数</div>
                  <div className="text-xl font-semibold text-zinc-900">
                    {(stats.aiUsage.totalTokens / 1000).toFixed(1)}k
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Target className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm text-zinc-500">预估花费</div>
                  <div className="text-xl font-semibold text-zinc-900">
                    ${stats.aiUsage.totalCost.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 技能图谱 */}
        <section className="mb-8">
          <Suspense fallback={<SkillGraphSkeleton />}>
            <SkillGraph userId={session.user.id} />
          </Suspense>
        </section>

        {/* 最近活动 */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-700 mb-4">
            <Clock className="w-5 h-5 inline mr-2 text-zinc-400" />
            最近活动
          </h2>
          <div className="bg-white rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
            {stats.recentActivity.length > 0 ? (
              <div className="divide-y divide-zinc-100">
                {stats.recentActivity.map((activity) => (
                  <a
                    key={activity.id}
                    href={`/chat/${activity.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-zinc-900 truncate">
                        {activity.title}
                      </div>
                      <div className="text-sm text-zinc-500">
                        {activity.updatedAt
                          ? new Date(activity.updatedAt).toLocaleDateString(
                              "zh-CN",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )
                          : "最近"}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-400">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>开始第一次 AI 对话吧！</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
