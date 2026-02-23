/**
 * Demo Page - 2026 RSC Architecture
 *
 * Server Component: 静态内容
 * Client Component: 交互（样式切换、动画）
 */

import { Suspense } from "react";
import { DemoClient } from "./DemoClient";

export const dynamic = "force-static";

export default function DemoPage() {
  return (
    <Suspense fallback={<DemoSkeleton />}>
      <DemoClient />
    </Suspense>
  );
}

function DemoSkeleton() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
