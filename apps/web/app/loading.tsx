"use client";

/**
 * 2026 架构师标准：全局加载状态
 *
 * 在页面 Suspense 解析期间显示
 */

import { usePathname } from "next/navigation";
import { CourseSkeleton, CreatePageSkeleton } from "@/components/loading/skeletons";

export default function Loading() {
  const pathname = usePathname();

  // 根据路径返回不同的骨架屏
  if (pathname.startsWith("/learn")) {
    return <CourseSkeleton />;
  }

  if (pathname.startsWith("/create")) {
    return <CreatePageSkeleton />;
  }

  // 默认骨架屏
  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-3 border-black/10 border-t-black rounded-full animate-spin" />
        <p className="text-sm text-black/40">加载中...</p>
      </div>
    </div>
  );
}
