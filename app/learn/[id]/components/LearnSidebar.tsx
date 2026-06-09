"use client";

import { AppBackLink } from "@/components/shared/layout";
import { PAGE_BACK_TARGETS } from "@/lib/navigation/app-navigation";
import { cn } from "@/lib/utils";
import { ChapterList } from "./ChapterList";

interface LearnSidebarProps {
  width: number;
  onCollapse?: () => void;
}

export function LearnSidebar({ width, onCollapse }: LearnSidebarProps) {
  return (
    <div
      className="flex h-full w-full flex-col bg-white/72 safe-top safe-bottom"
      style={{ maxWidth: width }}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-black/[0.04] px-4 pb-4 pt-5 lg:px-5">
          <div className="flex items-center justify-between gap-2">
            <AppBackLink target={PAGE_BACK_TARGETS.learn} variant="pill" />
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

          <div className="mt-4 text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
            目录
          </div>
        </div>

        <div className="mobile-scroll flex-1 overflow-y-auto px-3 py-4">
          <ChapterList />
        </div>
      </div>
    </div>
  );
}
