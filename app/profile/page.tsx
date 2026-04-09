import {
  ArrowRight,
  Brain,
  Compass,
  FileText,
  GraduationCap,
  type LucideIcon,
  MessageSquare,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileGoldenPathSummary } from "@/components/profile/ProfileGoldenPathSummary";
import { ProfileGoldenPathSummarySkeleton } from "@/components/profile/ProfileGoldenPathSummarySkeleton";
import { FloatingHeader } from "@/components/shared/layout";
import { getProfileAvatarLabel } from "@/lib/profile/avatar";
import { redirectIfUnauthenticated } from "@/lib/server/page-auth";
import {
  getUserProfileOverviewCached,
  type ProfileRecentActivityItem,
} from "@/lib/server/profile-data";
import { ProfileSignOut } from "./profile-client";

function formatActivityTime(updatedAt: Date | null): string {
  if (!updatedAt) {
    return "最近使用";
  }

  return new Date(updatedAt).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OverviewPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)]">
      <Icon className="h-4 w-4" />
      <span>
        {label} {value}
      </span>
    </div>
  );
}

function HubEntryCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="ui-surface-card rounded-3xl p-5 transition-shadow hover:[box-shadow:var(--shadow-soft-panel-hover)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="ui-icon-chip flex h-10 w-10 items-center justify-center">
            <Icon className="h-5 w-5 text-[var(--color-text-secondary)]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[var(--color-text)]">{title}</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--color-text-tertiary)]">{description}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-[var(--color-text-muted)]" />
      </div>
    </Link>
  );
}

function RecentActivityRow({ activity }: { activity: ProfileRecentActivityItem }) {
  return (
    <Link
      href={`/chat/${activity.id}`}
      className="flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-white/70"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-[var(--color-text-secondary)]">
        <MessageSquare className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--color-text)]">
          {activity.title}
        </div>
        <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          {formatActivityTime(activity.updatedAt)}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)]" />
    </Link>
  );
}

async function ProfilePageContent() {
  const session = await redirectIfUnauthenticated("/profile");
  const overview = await getUserProfileOverviewCached(session.user.id);
  const primaryActivity = overview.recentActivity[0] ?? null;
  const secondaryActivities = overview.recentActivity.slice(1, 4);

  return (
    <main className="ui-page-shell min-h-dvh">
      <FloatingHeader showBackHint showMenuButton />

      <div className="ui-page-frame ui-floating-header-offset max-w-4xl ui-bottom-breathing-room">
        <section className="mb-8">
          <div className="ui-badge-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-black/45">
            <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
            个人中心
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-black/90 md:text-5xl">
            把下一步留在眼前
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-black/55">
            这里只保留最重要的入口：继续学习、查看主线、管理偏好。
          </p>
        </section>

        <section className="mb-8">
          <div className="ui-surface-card-lg rounded-3xl p-5 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-6">
              <div className="flex items-start gap-4 md:gap-6">
                <div className="ui-primary-button flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold md:h-20 md:w-20 md:text-2xl">
                  {getProfileAvatarLabel(session.user.name, session.user.email)}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="mb-1 truncate text-lg font-semibold text-[var(--color-text)] md:text-2xl">
                    {session.user.name || "学习者"}
                  </h2>
                  <p className="truncate text-sm text-[var(--color-text-tertiary)] md:text-base">
                    {session.user.email}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <OverviewPill
                      icon={MessageSquare}
                      label="对话"
                      value={overview.conversations}
                    />
                    <OverviewPill icon={FileText} label="笔记" value={overview.documents} />
                    <OverviewPill icon={GraduationCap} label="课程" value={overview.courses} />
                  </div>
                </div>
              </div>

              <ProfileSignOut />
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="ui-surface-card-lg rounded-3xl p-5 md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="ui-primary-button flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold md:h-20 md:w-20 md:text-2xl">
                <Brain className="h-6 w-6 md:h-8 md:w-8" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  <Brain className="h-4 w-4" />
                  继续学习
                </div>
                {primaryActivity ? (
                  <>
                    <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)] md:text-2xl">
                      {primaryActivity.title}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--color-text-tertiary)]">
                      上次更新于 {formatActivityTime(primaryActivity.updatedAt)}
                      。从这里继续，不需要先翻整页记录。
                    </p>
                    <div className="mt-4">
                      <Link
                        href={`/chat/${primaryActivity.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                      >
                        继续这次对话
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)] md:text-2xl">
                      还没有可继续的学习记录
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--color-text-tertiary)]">
                      从一次课程访谈开始，生成第一门课后，这里就会成为你的学习起点。
                    </p>
                    <div className="mt-4">
                      <Link
                        href="/interview"
                        className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                      >
                        开始课程访谈
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>

            {secondaryActivities.length > 0 ? (
              <div className="mt-6 rounded-3xl bg-[var(--color-panel-soft)] p-3">
                <div className="mb-2 px-3 pt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  最近活动
                </div>
                <div className="space-y-1">
                  {secondaryActivities.map((activity) => (
                    <RecentActivityRow key={activity.id} activity={activity} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mb-8">
          <Suspense fallback={<ProfileGoldenPathSummarySkeleton />}>
            <ProfileGoldenPathSummary userId={session.user.id} />
          </Suspense>
        </section>

        <section>
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              管理入口
            </p>
            <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">偏好与洞察</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <HubEntryCard
              href="/profile/settings"
              icon={Settings2}
              title="偏好与皮肤"
              description="管理 AI 默认语气、讲解方式、皮肤和学习偏好。"
            />
            <HubEntryCard
              href="/profile/insights"
              icon={Compass}
              title="学习洞察"
              description="查看最近 7 天的 AI 使用趋势、工作流分布和成本情况。"
            />
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
