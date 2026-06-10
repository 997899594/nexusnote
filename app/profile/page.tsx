import { ArrowRight, Brain, Settings2, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileCareerTreeSummary } from "@/components/profile/ProfileCareerTreeSummary";
import { ProfileCareerTreeSummarySkeleton } from "@/components/profile/ProfileCareerTreeSummarySkeleton";
import { redirectIfUnauthenticated } from "@/lib/auth/page";
import { getProfileAvatarLabel, getProfileDisplayName } from "@/lib/profile/avatar";
import { getProfileHomeDataCached } from "@/lib/profile/home-data";
import { ProfileSignOut } from "./profile-client";

async function ProfilePageContent() {
  const session = await redirectIfUnauthenticated("/profile");
  const { primaryLearningEntry } = await getProfileHomeDataCached(session.user.id);
  const avatarLabel = getProfileAvatarLabel(session.user.name, session.user.email);
  const displayName = getProfileDisplayName(session.user.name, session.user.email);

  return (
    <main className="ui-page-shell min-h-dvh">
      <div className="ui-page-frame ui-bottom-breathing-room max-w-4xl pt-6 md:pt-10">
        <section className="ui-surface-card-lg mb-5 rounded-[2rem] border border-black/6 p-5 md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="ui-primary-button flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[1.2rem] text-xl font-semibold">
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
            <div className="flex items-center gap-2">
              <Link
                href="/profile/settings"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--color-panel-soft)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-active)] hover:text-[var(--color-text)]"
              >
                <Settings2 className="h-4 w-4" />
                设置
              </Link>
              <ProfileSignOut />
            </div>
          </div>
        </section>

        <section className="mb-5">
          <Link
            href={primaryLearningEntry.href}
            className="group ui-surface-card-lg flex min-h-[13rem] flex-col justify-between rounded-[2rem] border border-black/6 p-5 transition-shadow hover:[box-shadow:var(--shadow-soft-panel-hover)] md:p-6"
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
