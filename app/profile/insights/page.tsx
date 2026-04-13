import { ArrowLeft, BarChart3, Settings2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileAiUsagePanel } from "@/components/profile/ProfileAiUsagePanel";
import { FloatingHeader } from "@/components/shared/layout";
import { redirectIfUnauthenticated } from "@/lib/server/page-auth";
import {
  getProfileStatsWindowStart,
  getUserProfileInsightsCached,
} from "@/lib/server/profile-data";

async function ProfileInsightsPageContent() {
  const session = await redirectIfUnauthenticated("/profile/insights");
  const windowStart = getProfileStatsWindowStart();
  const usage = await getUserProfileInsightsCached(session.user.id, windowStart.toISOString());

  return (
    <main className="ui-page-shell min-h-dvh">
      <FloatingHeader
        showBackHint
        showMenuButton
        title="学习洞察"
        subtitle="Insights"
        variant="compact"
      />

      <div className="ui-page-frame ui-floating-header-offset max-w-4xl ui-bottom-breathing-room">
        <section className="mb-8">
          <div className="ui-badge-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-black/45">
            <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
            学习洞察
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-black/90 md:text-5xl">
            最近 7 天的 AI 使用情况
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-black/55">
            这部分保留完整分析图表，避免把个人首页再次撑回控制台。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[#eceff3] hover:text-[var(--color-text)]"
            >
              <ArrowLeft className="h-4 w-4" />
              返回个人中心
            </Link>
            <Link
              href="/profile/settings"
              className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[#eceff3] hover:text-[var(--color-text)]"
            >
              <Settings2 className="h-4 w-4" />
              打开偏好设置
            </Link>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            <BarChart3 className="h-4 w-4" />
            AI Usage Insights
          </div>
          <ProfileAiUsagePanel
            usage={usage}
            windowStartLabel={usage.windowStart.toLocaleDateString("zh-CN", {
              month: "short",
              day: "numeric",
            })}
          />
        </section>
      </div>
    </main>
  );
}

export default function ProfileInsightsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <ProfileInsightsPageContent />
    </Suspense>
  );
}
