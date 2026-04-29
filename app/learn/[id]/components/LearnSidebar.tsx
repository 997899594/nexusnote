"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChapterList } from "./ChapterList";

interface LearnSidebarProps {
  courseTitle: string;
  width: number;
}

export function LearnSidebar({ courseTitle, width }: LearnSidebarProps) {
  const router = useRouter();

  return (
    <div
      className="ui-page-shell flex h-full w-full flex-col safe-top safe-bottom"
      style={{ maxWidth: width }}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-black/5 px-5 pb-4 pt-5">
          <button
            type="button"
            onClick={() => router.push("/")}
            className={cn(
              "ui-control-surface flex h-9 w-9 items-center justify-center rounded-lg",
              "text-[var(--color-text-secondary)]",
              "hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
              "transition-all duration-200",
            )}
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="mb-1 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              目录
            </div>
            <h1 className="text-[0.9375rem] font-semibold text-[var(--color-text)] truncate leading-snug">
              {courseTitle}
            </h1>
          </div>
        </div>

        {/* Chapter list header */}
        <div className="px-5 pb-3 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[0.6875rem] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              章节
            </h2>
          </div>
        </div>

        {/* Chapter > Section list */}
        <div className="mobile-scroll flex-1 overflow-y-auto px-3 pb-5">
          <ChapterList />
        </div>
      </div>
    </div>
  );
}
