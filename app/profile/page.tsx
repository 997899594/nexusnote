import { Brain, FileText, GraduationCap, MessageSquare, Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GoldenPathPreview } from "@/components/golden-path/GoldenPathPreview";
import { GoldenPathPreviewSkeleton } from "@/components/golden-path/GoldenPathPreviewSkeleton";
import { AIPreferencesPanel } from "@/components/profile/AIPreferencesPanel";
import { ProfileAiUsagePanel } from "@/components/profile/ProfileAiUsagePanel";
import { FloatingHeader } from "@/components/shared/layout";
import { getDynamicPageSession } from "@/lib/server/page-auth";
import { getProfileStatsWindowStart, getUserStatsCached } from "@/lib/server/profile-data";
import { ProfileSignOut } from "./profile-client";

function getProfileAvatarLabel(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    return trimmedName
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  const emailInitial = email?.trim().charAt(0).toUpperCase();
  return emailInitial || "U";
}

async function ProfilePageContent() {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fprofile");
  }

  const windowStart = getProfileStatsWindowStart();
  const stats = await getUserStatsCached(session.user.id, windowStart.toISOString());

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
    <main className="ui-page-shell min-h-dvh safe-top">
      <FloatingHeader showBackHint showMenuButton />

      <div className="ui-page-frame max-w-4xl ui-bottom-breathing-room pt-24 md:pt-28">
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
                {getProfileAvatarLabel(session.user.name, session.user.email)}
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

        <AIPreferencesPanel />

        <section className="mb-8">
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              AI 使用情况
            </p>
            <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">最近 7 天</h2>
          </div>
          <ProfileAiUsagePanel
            usage={stats.aiUsage}
            windowStartLabel={stats.aiUsage.windowStart.toLocaleDateString("zh-CN", {
              month: "short",
              day: "numeric",
            })}
          />
        </section>

        <section className="mb-8">
          <Suspense fallback={<GoldenPathPreviewSkeleton />}>
            <GoldenPathPreview userId={session.user.id} />
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

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <ProfilePageContent />
    </Suspense>
  );
}
