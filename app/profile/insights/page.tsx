import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Brain,
  Compass,
  FileText,
  GraduationCap,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { KnowledgeInsightStrip } from "@/components/knowledge/KnowledgeInsightStrip";
import { ProfileAiUsagePanel } from "@/components/profile/ProfileAiUsagePanel";
import { FloatingHeader, LibraryAnalysisPageShell } from "@/components/shared/layout";
import { redirectIfUnauthenticated } from "@/lib/auth/page";
import { getGrowthStateLabel } from "@/lib/growth/presentation";
import { buildKnowledgeExcerpt } from "@/lib/knowledge/presentation";
import { getProfileInsightsPageDataCached } from "@/lib/profile/insights-page-data";
import { getProfileStatsWindowStart } from "@/lib/profile/stats-data";

async function ProfileInsightsPageContent() {
  const session = await redirectIfUnauthenticated("/profile/insights");
  const windowStart = getProfileStatsWindowStart();
  const data = await getProfileInsightsPageDataCached(session.user.id, windowStart.toISOString());
  const { usage, overview, focusNotes, insights: topInsights } = data;

  return (
    <LibraryAnalysisPageShell
      header={
        <FloatingHeader
          showBackHint
          showMenuButton
          title="学习洞察"
          subtitle="Insights"
          variant="compact"
        />
      }
    >
      <section className="mb-8">
        <div className="ui-badge-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-black/45">
          <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
          学习洞察
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-black/90 md:text-5xl">
          当前知识流与成长状态
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-8 text-black/55">
          这里集中展示当前方向、焦点、知识信号和 AI 使用趋势，不再把洞察拆散到多个孤立页面。
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
          <Link
            href="/career-trees"
            className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[#eceff3] hover:text-[var(--color-text)]"
          >
            <Compass className="h-4 w-4" />
            查看职业树
          </Link>
          <Link
            href="/editor"
            className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[#eceff3] hover:text-[var(--color-text)]"
          >
            <FileText className="h-4 w-4" />
            打开知识工作台
          </Link>
        </div>
      </section>

      <div className="space-y-8">
        {overview ? (
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-[30px] border border-black/6 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fa_100%)] p-5 md:p-6">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                <Compass className="h-4 w-4" />
                当前方向
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                {overview.direction.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                {overview.direction.summary}
              </p>
              {overview.direction.confidence !== null ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                    候选树 {overview.direction.treesCount ?? 0} 条
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                    置信度 {Math.round(overview.direction.confidence * 100)}%
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                    支持课程 {overview.direction.supportingCoursesCount ?? 0} 门
                  </span>
                </div>
              ) : null}
            </article>

            <article className="rounded-[30px] border border-black/6 bg-[var(--color-panel-soft)] p-5 md:p-6">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                <GraduationCap className="h-4 w-4" />
                当前焦点
              </div>
              <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)]">
                {overview.focus.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                {overview.focus.summary}
              </p>
              {overview.focus.progress !== null ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                    进度 {overview.focus.progress}%
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                    {getGrowthStateLabel(overview.focus.state)}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                    相关材料 {overview.focus.relatedMaterialCount} 条
                  </span>
                </div>
              ) : (
                <div className="mt-4">
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs text-[var(--color-text-secondary)] shadow-sm">
                    相关材料 {overview.focus.relatedMaterialCount} 条
                  </span>
                </div>
              )}
            </article>
          </section>
        ) : null}

        {topInsights.length > 0 ? (
          <section>
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <Brain className="h-4 w-4" />
              Knowledge Insights
            </div>
            <KnowledgeInsightStrip insights={topInsights} />
          </section>
        ) : null}

        {focusNotes.length > 0 ? (
          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  <Compass className="h-4 w-4" />
                  焦点材料
                </div>
                <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">
                  和当前焦点最相关的知识沉淀
                </h2>
              </div>
              <Link
                href="/editor"
                className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
              >
                去工作台
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {focusNotes.map((note) => (
                <Link
                  key={note.id}
                  href={`/editor/${note.id}`}
                  className="rounded-[24px] border border-black/6 bg-white px-4 py-4 shadow-[0_18px_48px_-42px_rgba(15,23,42,0.2)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-soft-panel-hover)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        <FileText className="h-3.5 w-3.5" />
                        知识材料
                      </div>
                      <h3 className="mt-3 text-base font-medium leading-7 text-[var(--color-text)]">
                        {note.title}
                      </h3>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--color-text-secondary)]">
                    {buildKnowledgeExcerpt(
                      note.plainText,
                      note.sourceContext?.selectionText ??
                        note.sourceContext?.latestExcerpt ??
                        null,
                      { maxLength: 100 },
                    )}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

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
    </LibraryAnalysisPageShell>
  );
}

export default function ProfileInsightsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <ProfileInsightsPageContent />
    </Suspense>
  );
}
