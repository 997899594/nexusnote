"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { ChapterList } from "./ChapterList";

interface LearnSidebarProps {
  courseTitle: string;
  width: number;
  onCollapse?: () => void;
}

export function LearnSidebar({ courseTitle, width, onCollapse }: LearnSidebarProps) {
  const chapters = useLearnStore((s) => s.chapters);
  const completedSections = useLearnStore((s) => s.completedSections);
  const totalSections = chapters.reduce((total, chapter) => total + chapter.sections.length, 0);
  const completedCount = chapters.reduce(
    (total, chapter) =>
      total + chapter.sections.filter((section) => completedSections.has(section.nodeId)).length,
    0,
  );
  const progress = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  return (
    <div
      className="flex h-full w-full flex-col bg-white/72 safe-top safe-bottom"
      style={{ maxWidth: width }}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-black/[0.04] px-4 pb-5 pt-5 lg:px-5">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/profile"
              aria-label="回到个人中心"
              className={cn(
                "flex h-9 items-center justify-center rounded-full px-3 text-xs font-medium",
                "text-[var(--color-text-secondary)]",
                "hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
                "transition-colors duration-200",
              )}
            >
              返回
            </Link>
            {onCollapse ? (
              <button
                type="button"
                onClick={onCollapse}
                aria-label="收起目录"
                className={cn(
                  "hidden h-9 items-center justify-center rounded-full px-3 text-xs font-medium md:flex",
                  "text-[var(--color-text-secondary)]",
                  "hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
                  "transition-colors duration-200",
                )}
              >
                收起
              </button>
            ) : null}
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
              课程
            </div>
            <h1 className="line-clamp-3 text-[0.98rem] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-text)]">
              {courseTitle}
            </h1>
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-[0.6875rem] text-[var(--color-text-tertiary)]">
              <span>
                {completedCount}/{totalSections || 0}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-[var(--color-panel-strong)] transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mobile-scroll flex-1 overflow-y-auto px-3 py-4">
          <ChapterList />
        </div>
      </div>
    </div>
  );
}
