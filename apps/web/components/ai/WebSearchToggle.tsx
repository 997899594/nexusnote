/**
 * AI 联网搜索开关组件
 *
 * 用户可以通过此开关控制 AI 是否使用联网搜索能力
 */

"use client";

import { Globe } from "lucide-react";
import { useWebSearchToggle } from "@/lib/store";

export function WebSearchToggle({
  className = "",
  variant = "icon", // "icon" | "full" | "compact"
}: {
  className?: string;
  variant?: "icon" | "full" | "compact";
}) {
  const { webSearchEnabled: enabled, toggleWebSearch: setEnabled } = useWebSearchToggle();

  const variants = {
    icon: (
      <button
        type="button"
        onClick={setEnabled}
        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
          enabled
            ? "bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300"
            : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-500"
        } ${className}`}
        title={enabled ? "已启用联网搜索" : "已禁用联网搜索"}
      >
        <Globe className="w-4 h-4" strokeWidth={2.5} />
      </button>
    ),
    compact: (
      <button
        type="button"
        onClick={setEnabled}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          enabled
            ? "bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300"
            : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-500"
        } ${className}`}
        title={enabled ? "点击禁用联网搜索" : "点击启用联网搜索"}
      >
        <Globe className="w-4 h-4" strokeWidth={2.5} />
        <span className="hidden sm:inline">{enabled ? "联网搜索" : "仅本地模型"}</span>
      </button>
    ),
    full: (
      <div
        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
          enabled
            ? "border-violet-200 bg-violet-50 dark:border-violet-800/50 dark:bg-violet-950/30"
            : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        } ${className}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all ${
              enabled
                ? "bg-violet-500 text-white"
                : "bg-neutral-200 text-neutral-400 dark:bg-neutral-700 dark:text-neutral-500"
            }`}
          >
            <Globe className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
              {enabled ? "联网搜索已启用" : "联网搜索已禁用"}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {enabled ? "AI 可以搜索互联网获取最新信息" : "AI 仅使用内置知识回答问题"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={setEnabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-violet-500" : "bg-neutral-300 dark:bg-neutral-600"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
              enabled ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    ),
  };

  return variants[variant];
}
