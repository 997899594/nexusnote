/**
 * Interview Page - 2026 RSC Architecture
 *
 * 分层架构：
 * - Server Component: 获取初始数据、布局
 * - Client Component: 交互逻辑（useChat、动画）
 */

import { Suspense } from "react";
import { InterviewClient } from "./interview-client";

export default function InterviewPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Suspense fallback={<InterviewSkeleton />}>
        <InterviewClient />
      </Suspense>
    </main>
  );
}

function InterviewSkeleton() {
  return (
    <div className="max-w-4xl w-full p-20 text-center">
      <div className="inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-slate-500">加载中...</p>
    </div>
  );
}
