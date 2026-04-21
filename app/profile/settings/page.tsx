import { ArrowLeft, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AIPreferencesPanel } from "@/components/profile/AIPreferencesPanel";
import { FloatingHeader, LibraryAnalysisPageShell } from "@/components/shared/layout";
import { redirectIfUnauthenticated } from "@/lib/auth/page";
import { getProfileAvatarLabel } from "@/lib/profile/avatar";
import { ProfileSignOut } from "../profile-client";

async function ProfileSettingsPageContent() {
  const session = await redirectIfUnauthenticated("/profile/settings");

  return (
    <LibraryAnalysisPageShell
      header={
        <FloatingHeader
          showBackHint
          showMenuButton
          title="偏好设置"
          subtitle="Settings"
          variant="compact"
        />
      }
    >
      <section className="mb-8">
        <div className="ui-badge-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-black/45">
          <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
          偏好设置
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-black/90 md:text-5xl">
          管理默认行为
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-8 text-black/55">
          这里处理长期默认值，不把这些表单再塞回个人首页。
        </p>
      </section>

      <section className="mb-8">
        <div className="ui-surface-card-lg rounded-3xl p-5 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="ui-primary-button flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold md:h-20 md:w-20 md:text-2xl">
                {getProfileAvatarLabel(session.user.name, session.user.email)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[var(--color-text)] md:text-2xl">
                  {session.user.name || "学习者"}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-tertiary)] md:text-base">
                  {session.user.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/profile"
                className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[#eceff3] hover:text-[var(--color-text)]"
              >
                <ArrowLeft className="h-4 w-4" />
                返回个人中心
              </Link>
              <Link
                href="/profile/insights"
                className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[#eceff3] hover:text-[var(--color-text)]"
              >
                <BarChart3 className="h-4 w-4" />
                查看学习洞察
              </Link>
              <ProfileSignOut />
            </div>
          </div>
        </div>
      </section>

      <AIPreferencesPanel />
    </LibraryAnalysisPageShell>
  );
}

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <ProfileSettingsPageContent />
    </Suspense>
  );
}
