import { ArrowRight, BookOpen, Clock3 } from "lucide-react";
import Link from "next/link";
import type { RecentLearningItem } from "@/lib/learning/recent-courses-data";

function actionLabel(item: RecentLearningItem): string {
  return item.status === "not_started" ? "开始学习" : "继续下一篇";
}

function formatRemainingTime(minutes: number): string {
  if (minutes < 60) return `约剩 ${minutes} 分钟`;
  return `约剩 ${Math.ceil(minutes / 60)} 小时`;
}

export function LearningMomentumHero({ item }: { item: RecentLearningItem }) {
  return (
    <section className="mb-10 border-y border-black/[0.06] py-7 md:mb-12 md:py-9">
      <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <div className="mb-4 flex items-center gap-2 text-xs font-medium text-[var(--color-text-tertiary)]">
            <BookOpen className="h-4 w-4" />
            <span>{item.status === "not_started" ? "准备开始" : "继续学习"}</span>
          </div>
          <h1 className="max-w-3xl text-2xl font-semibold leading-tight text-[var(--color-text)] md:text-4xl">
            {item.title}
          </h1>
          <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] md:text-base">
            {item.nextSectionTitle
              ? `下一篇：${item.nextSectionTitle}`
              : (item.description ?? "从第一篇开始建立学习节奏。")}
          </p>

          <div className="mt-6 max-w-2xl">
            <div className="mb-2 flex items-center justify-between gap-4 text-xs text-[var(--color-text-tertiary)]">
              <span>
                {item.completedSectionCount}/{item.totalSectionCount} 篇已完成
              </span>
              <span>{item.progressPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500"
                style={{ width: `${item.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          {item.remainingMinutes !== null ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
              <Clock3 className="h-3.5 w-3.5" />
              {formatRemainingTime(item.remainingMinutes)}
            </div>
          ) : null}
          <Link
            href={item.url}
            className="ui-primary-button inline-flex min-h-11 items-center gap-2 rounded-lg px-5 py-3 text-sm font-medium"
          >
            {actionLabel(item)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
