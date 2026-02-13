/**
 * 2026 架构师标准：全局错误边界
 *
 * 参考：React 19 错误处理最佳实践
 * https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// biome-ignore lint/suspicious/noShadowRestrictedNames: Next.js error boundary convention
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 记录错误到错误监控服务（如 Sentry）
    console.error("[Error Boundary] Caught error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-black">出错了</h1>
          <p className="text-black/60 text-sm">{error.message || "应用遇到了一些问题"}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} className="bg-black text-white hover:bg-black/80">
            <RefreshCw className="w-4 h-4 mr-2" />
            重试
          </Button>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
            className="border-black/10 hover:bg-black/5"
          >
            返回首页
          </Button>
        </div>

        {/* Error Details (Development only) */}
        {process.env.NODE_ENV === "development" && error.digest ? (
          <details className="text-left mt-6">
            <summary className="text-xs text-black/40 cursor-pointer hover:text-black/60">
              错误详情
            </summary>
            <pre className="mt-2 text-xs bg-black/5 p-3 rounded-lg overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
