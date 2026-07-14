import { ArrowRight, BookOpen, Check } from "lucide-react";
import Link from "next/link";
import type { RecentLearningItem } from "@/lib/learning/recent-courses-data";

function itemDescription(item: RecentLearningItem): string {
  if (item.status === "completed") return "课程已完成";
  if (item.nextSectionTitle) return `下一篇：${item.nextSectionTitle}`;
  return item.description ?? "开始阅读第一篇内容";
}

export function RecentCard({ item }: { item: RecentLearningItem }) {
  return (
    <Link
      href={item.url}
      aria-label={`${item.status === "completed" ? "查看" : "继续学习"}：${item.title}`}
      className="group flex min-h-48 w-full flex-col rounded-lg border border-black/[0.07] bg-white p-5 text-left transition-[border-color,box-shadow] hover:border-black/[0.14] hover:shadow-[0_18px_44px_-36px_rgba(15,23,42,0.45)]"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-panel-soft)]">
          {item.status === "completed" ? (
            <Check className="h-4 w-4 text-[var(--color-text-secondary)]" />
          ) : (
            <BookOpen className="h-4 w-4 text-[var(--color-text-secondary)]" />
          )}
        </span>
        <span className="pt-1 text-xs text-[var(--color-text-muted)]">{item.timeLabel}</span>
      </div>

      <h3 className="line-clamp-2 text-sm font-semibold leading-6 text-[var(--color-text)]">
        {item.title}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs leading-6 text-[var(--color-text-secondary)]">
        {itemDescription(item)}
      </p>

      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-center justify-between text-[0.6875rem] text-[var(--color-text-tertiary)]">
          <span>{item.status === "completed" ? "已完成" : `${item.progressPercent}%`}</span>
          <span>
            {item.completedSectionCount}/{item.totalSectionCount}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)]"
            style={{ width: `${item.progressPercent}%` }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
          <span>{item.status === "completed" ? "查看课程" : "继续学习"}</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
