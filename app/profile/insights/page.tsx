import {
  ArrowUpRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  Compass,
  FileText,
  GraduationCap,
  RotateCcw,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { KnowledgeInsightStrip } from "@/components/knowledge/KnowledgeInsightStrip";
import { FloatingHeader, LibraryAnalysisPageShell } from "@/components/shared/layout";
import { redirectIfUnauthenticated } from "@/lib/auth/page";
import { getCareerNodeStateLabel } from "@/lib/career-tree/presentation";
import { buildKnowledgeExcerpt } from "@/lib/knowledge/presentation";
import { PAGE_BACK_TARGETS } from "@/lib/navigation/app-navigation";
import { getProfileInsightsPageDataCached } from "@/lib/profile/insights-page-data";
import { getProfileStatsWindowStart } from "@/lib/profile/stats-data";

async function ProfileInsightsPageContent() {
  const session = await redirectIfUnauthenticated("/profile/insights");
  const windowStart = getProfileStatsWindowStart();
  const data = await getProfileInsightsPageDataCached(session.user.id, windowStart.toISOString());
  const { learning, overview, focusNotes, insights: topInsights } = data;

  return (
    <LibraryAnalysisPageShell
      header={
        <FloatingHeader
          showBackHint
          backHref={PAGE_BACK_TARGETS.profileInsights.href}
          backLabel={PAGE_BACK_TARGETS.profileInsights.label}
          backAriaLabel={PAGE_BACK_TARGETS.profileInsights.ariaLabel}
          title="学习洞察"
          variant="compact"
        />
      }
    >
      <section className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-tertiary)]">学习洞察</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
            知识与成长状态
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/profile/settings"
            className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-active)] hover:text-[var(--color-text)]"
          >
            <Settings2 className="h-4 w-4" />
            偏好设置
          </Link>
          <Link
            href="/career-trees"
            className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-active)] hover:text-[var(--color-text)]"
          >
            <Compass className="h-4 w-4" />
            职业树
          </Link>
          <Link
            href="/editor"
            className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-active)] hover:text-[var(--color-text)]"
          >
            <FileText className="h-4 w-4" />
            知识工作台
          </Link>
        </div>
      </section>

      <div className="space-y-8">
        <section className="grid border-y border-black/[0.06] sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "活跃学习日",
              value: learning.activeDays,
              detail: "最近 7 天",
              icon: CalendarDays,
            },
            {
              label: "完成篇数",
              value: learning.completedSections,
              detail: "最近 7 天",
              icon: CheckCircle2,
            },
            {
              label: "恢复学习",
              value: learning.resumedSessions,
              detail: "再次打开课程",
              icon: RotateCcw,
            },
            {
              label: "课程完成率",
              value: `${learning.completionRate}%`,
              detail: `${learning.completedCourses}/${learning.startedCourses} 门`,
              icon: GraduationCap,
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="border-black/[0.06] px-4 py-5 sm:border-r last:border-r-0"
            >
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <metric.icon className="h-4 w-4" />
                {metric.label}
              </div>
              <div className="mt-3 text-3xl font-semibold text-[var(--color-text)]">
                {metric.value}
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">{metric.detail}</div>
            </div>
          ))}
        </section>

        {overview ? (
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="ui-message-card rounded-[30px] p-5 md:p-6">
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
                  <span className="ui-badge-pill rounded-full px-3 py-1.5">
                    可选方向 {overview.direction.treesCount ?? 0} 个
                  </span>
                  <span className="ui-badge-pill rounded-full px-3 py-1.5">
                    支持课程 {overview.direction.supportingCoursesCount ?? 0} 门
                  </span>
                </div>
              ) : null}
            </article>

            <article className="ui-message-card rounded-[30px] bg-[var(--color-panel-soft)] p-5 md:p-6">
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
                  <span className="ui-badge-pill rounded-full px-3 py-1.5">
                    进度 {overview.focus.progress}%
                  </span>
                  <span className="ui-badge-pill rounded-full px-3 py-1.5">
                    {getCareerNodeStateLabel(overview.focus.state)}
                  </span>
                  <span className="ui-badge-pill rounded-full px-3 py-1.5">
                    相关材料 {overview.focus.relatedMaterialCount} 条
                  </span>
                </div>
              ) : (
                <div className="mt-4">
                  <span className="ui-badge-pill rounded-full px-3 py-1.5 text-xs text-[var(--color-text-secondary)]">
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
              知识线索
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
                  和当前焦点最相关的学习笔记
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
                  className="ui-message-card rounded-[24px] px-4 py-4 transition-shadow hover:[box-shadow:var(--shadow-soft-panel-hover)]"
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
