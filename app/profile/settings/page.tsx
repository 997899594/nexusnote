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
      header={<FloatingHeader showBackHint title="偏好设置" variant="compact" />}
    >
      <section className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-tertiary)]">偏好设置</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
            学习助手默认设置
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/profile"
            className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-active)] hover:text-[var(--color-text)]"
          >
            <ArrowLeft className="h-4 w-4" />
            个人中心
          </Link>
          <Link
            href="/profile/insights"
            className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-active)] hover:text-[var(--color-text)]"
          >
            <BarChart3 className="h-4 w-4" />
            学习洞察
          </Link>
          <ProfileSignOut />
        </div>
      </section>

      <section className="mb-6">
        <div className="ui-surface-card rounded-3xl border border-black/6 px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="ui-primary-button flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold">
              {getProfileAvatarLabel(session.user.name, session.user.email)}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-[var(--color-text)]">
                {session.user.name || "学习者"}
              </h2>
              <p className="mt-1 truncate text-sm text-[var(--color-text-tertiary)]">
                {session.user.email}
              </p>
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
