import {
  ArrowRight,
  BarChart3,
  Brain,
  Compass,
  FileText,
  GraduationCap,
  type LucideIcon,
  MessageSquare,
  Settings2,
  User,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileCareerTreeSummary } from "@/components/profile/ProfileCareerTreeSummary";
import { ProfileCareerTreeSummarySkeleton } from "@/components/profile/ProfileCareerTreeSummarySkeleton";
import { redirectIfUnauthenticated } from "@/lib/auth/page";
import { getProfileAvatarLabel, getProfileDisplayName } from "@/lib/profile/avatar";
import { getProfileHomeDataCached } from "@/lib/profile/home-data";
import { ProfileSignOut } from "./profile-client";

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl bg-[var(--color-panel-soft)] px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
        {value}
      </div>
    </div>
  );
}

function ShortcutCard({
  href,
  icon: Icon,
  title,
  meta,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-black/6 bg-white px-4 py-4 transition-colors hover:bg-[var(--color-hover)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--color-text)]">{title}</div>
          <div className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">{meta}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

async function ProfilePageContent() {
  const session = await redirectIfUnauthenticated("/profile");
  const { overview, primaryLearningEntry } = await getProfileHomeDataCached(session.user.id);
  const avatarLabel = getProfileAvatarLabel(session.user.name, session.user.email);
  const displayName = getProfileDisplayName(session.user.name, session.user.email);

  return (
    <main className="ui-page-shell min-h-dvh">
      <div className="ui-page-frame ui-bottom-breathing-room max-w-4xl pt-6 md:pt-10">
        <section className="ui-surface-card-lg mb-5 rounded-[2rem] border border-black/6 p-5 md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="ui-primary-button flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[1.4rem] text-2xl font-semibold">
                {avatarLabel ? <span>{avatarLabel}</span> : <User className="h-7 w-7" />}
              </div>
              <div className="min-w-0 pt-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  个人中心
                </p>
                <h1 className="mt-2 truncate text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)] md:text-3xl">
                  {displayName}
                </h1>
                <p className="mt-1 truncate text-sm text-[var(--color-text-tertiary)]">
                  {session.user.email}
                </p>
              </div>
            </div>
            <ProfileSignOut />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <StatTile icon={MessageSquare} label="对话" value={overview.conversations} />
            <StatTile icon={FileText} label="笔记" value={overview.documents} />
            <StatTile icon={GraduationCap} label="课程" value={overview.courses} />
          </div>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <Link
            href={primaryLearningEntry.href}
            className="group ui-surface-card-lg flex min-h-[15rem] flex-col justify-between rounded-[2rem] border border-black/6 p-5 transition-shadow hover:[box-shadow:var(--shadow-soft-panel-hover)] md:p-6"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-panel-strong)] text-white">
                <Brain className="h-5 w-5" />
              </div>
              <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                继续学习
              </p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.04em] text-[var(--color-text)]">
                {primaryLearningEntry.title}
              </h2>
              <p className="mt-3 line-clamp-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                {primaryLearningEntry.description}
              </p>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
              {primaryLearningEntry.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>

          <div className="grid gap-3">
            <ShortcutCard href="/career" icon={Compass} title="职业地图" meta="校准职业方向" />
            <ShortcutCard
              href="/profile/settings"
              icon={Settings2}
              title="偏好设置"
              meta="讲解、语气与学习方式"
            />
            <ShortcutCard
              href="/profile/insights"
              icon={BarChart3}
              title="学习洞察"
              meta="用量、焦点与知识信号"
            />
          </div>
        </section>

        <section>
          <Suspense fallback={<ProfileCareerTreeSummarySkeleton />}>
            <ProfileCareerTreeSummary userId={session.user.id} />
          </Suspense>
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
