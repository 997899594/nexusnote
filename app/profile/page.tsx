import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Compass,
  FileText,
  type LucideIcon,
  MessageCircle,
  Settings2,
  User,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileCareerTreeSummary } from "@/components/profile/ProfileCareerTreeSummary";
import { ProfileCareerTreeSummarySkeleton } from "@/components/profile/ProfileCareerTreeSummarySkeleton";
import { AppBackLink } from "@/components/shared/layout/AppBackLink";
import { redirectIfUnauthenticated } from "@/lib/auth/page";
import { PAGE_BACK_TARGETS } from "@/lib/navigation/app-navigation";
import { getProfileAvatarLabel, getProfileDisplayName } from "@/lib/profile/avatar";
import { getProfileHomeDataCached } from "@/lib/profile/home-data";
import { ProfileSignOut } from "./profile-client";

interface ProfileStatItem {
  label: string;
  value: number;
}

interface WorkspaceEntry {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const WORKSPACE_ENTRIES: WorkspaceEntry[] = [
  {
    title: "课程访谈",
    description: "生成新的学习路线",
    href: "/interview",
    icon: MessageCircle,
  },
  {
    title: "职业树",
    description: "看方向和下一步",
    href: "/career-trees",
    icon: Compass,
  },
  {
    title: "知识工作台",
    description: "整理笔记与线索",
    href: "/editor",
    icon: FileText,
  },
  {
    title: "学习洞察",
    description: "查看状态与用量",
    href: "/profile/insights",
    icon: BarChart3,
  },
];

function ProfileStatStrip({ items }: { items: ProfileStatItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-[1.35rem] bg-[var(--color-panel-soft)] p-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-[1rem] bg-white/70 px-3 py-3">
          <div className="text-xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
            {item.value}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function WorkspaceEntryLink({ entry }: { entry: WorkspaceEntry }) {
  const Icon = entry.icon;

  return (
    <Link
      href={entry.href}
      className="group flex items-center justify-between gap-4 rounded-[1.4rem] border border-black/[0.06] bg-white px-4 py-4 transition-colors hover:bg-[var(--color-panel-soft)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)] transition-colors group-hover:bg-white group-hover:text-[var(--color-text)]">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-[var(--color-text)]">
            {entry.title}
          </span>
          <span className="mt-1 block truncate text-xs text-[var(--color-text-tertiary)]">
            {entry.description}
          </span>
        </span>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-text)]" />
    </Link>
  );
}

async function ProfilePageContent() {
  const session = await redirectIfUnauthenticated("/profile");
  const { overview, primaryLearningEntry } = await getProfileHomeDataCached(session.user.id);
  const avatarLabel = getProfileAvatarLabel(session.user.name, session.user.email);
  const displayName = getProfileDisplayName(session.user.name, session.user.email);
  const statItems: ProfileStatItem[] = [
    { label: "课程", value: overview.courses },
    { label: "笔记", value: overview.documents },
    { label: "对话", value: overview.conversations },
  ];

  return (
    <main className="ui-page-shell min-h-dvh">
      <div className="ui-page-frame ui-bottom-breathing-room max-w-5xl pt-4 md:pt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <AppBackLink target={PAGE_BACK_TARGETS.profile} variant="soft" />
          <Link
            href="/profile/settings"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--color-panel-soft)] px-3 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-active)] hover:text-[var(--color-text)]"
          >
            <Settings2 className="h-3.5 w-3.5" />
            设置
          </Link>
        </div>

        <section className="ui-surface-card-lg mb-5 rounded-[2rem] border border-black/[0.06] p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-center">
            <div className="flex min-w-0 items-start gap-4">
              <div className="ui-primary-button flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] text-xl font-semibold">
                {avatarLabel ? <span>{avatarLabel}</span> : <User className="h-7 w-7" />}
              </div>
              <div className="min-w-0 pt-1">
                <h1 className="truncate text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)] md:text-3xl">
                  {displayName}
                </h1>
                <p className="mt-1 truncate text-sm text-[var(--color-text-tertiary)]">
                  {session.user.email}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <ProfileStatStrip items={statItems} />
              <div className="flex justify-end">
                <ProfileSignOut />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Link
            href={primaryLearningEntry.href}
            className="group ui-surface-card-lg flex min-h-[15rem] flex-col justify-between rounded-[2rem] border border-black/[0.06] p-5 transition-shadow hover:[box-shadow:var(--shadow-soft-panel-hover)] md:p-6"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-panel-strong)] text-white">
                {overview.courses > 0 ? (
                  <Brain className="h-5 w-5" />
                ) : (
                  <BookOpen className="h-5 w-5" />
                )}
              </div>
              <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                学习
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

          <section className="ui-surface-card-lg rounded-[2rem] border border-black/[0.06] p-3 md:p-4">
            <div className="px-2 pb-3 pt-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                入口
              </p>
            </div>
            <div className="grid gap-2">
              {WORKSPACE_ENTRIES.map((entry) => (
                <WorkspaceEntryLink key={entry.href} entry={entry} />
              ))}
            </div>
          </section>
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
