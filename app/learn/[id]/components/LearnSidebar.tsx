"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { ChapterList } from "./ChapterList";

interface LearnSidebarProps {
  courseTitle: string;
}

export function LearnSidebar({ courseTitle }: LearnSidebarProps) {
  const router = useRouter();
  const { chapters, completedChapters } = useLearnStore();

  const completedCount = completedChapters.size;
  const totalCount = chapters.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleBack = () => {
    router.push("/");
  };

  return (
    <div className="flex flex-col h-full border-r border-zinc-100 bg-white">
      {/* Header with back button and title */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-100">
        <button
          type="button"
          onClick={handleBack}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100",
            "transition-colors",
          )}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-zinc-900 truncate">{courseTitle}</h1>
          <p className="text-xs text-zinc-500">
            {completedCount} / {totalCount} 章节
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-4 border-b border-zinc-100">
        <div className="flex justify-between text-xs text-zinc-500 mb-2">
          <span>学习进度</span>
          <span className="font-medium text-zinc-700">{progress}%</span>
        </div>
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-zinc-900 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto">
        <ChapterList />
      </div>
    </div>
  );
}
