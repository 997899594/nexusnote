"use client";

/**
 * StreamdownMessage - 流式 Markdown 渲染组件
 *
 * 使用 Streamdown，专为 AI 流式优化
 * 支持代码高亮、数学公式、Mermaid 图表、中文优化
 */

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { type ControlsConfig, Streamdown } from "streamdown";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

interface StreamdownMessageProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
  controls?: ControlsConfig;
  variant?: "chat" | "reader";
}

/**
 * 安全的 Streamdown 包装器
 * 降级策略：如果渲染失败，显示纯文本
 */
function SafeStreamdown({
  content,
  isStreaming,
  className,
  controls,
}: {
  content: string;
  isStreaming?: boolean;
  className?: string;
  controls?: ControlsConfig;
}) {
  try {
    return (
      <Streamdown
        plugins={{ code, math, cjk }}
        isAnimating={isStreaming}
        controls={controls}
        className={className}
      >
        {content}
      </Streamdown>
    );
  } catch (error) {
    // 降级到纯文本
    console.error("[Streamdown] Render error:", error);
    return (
      <pre className="whitespace-pre-wrap break-words text-sm text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">
        {content}
      </pre>
    );
  }
}

export function StreamdownMessage({
  content,
  isStreaming = false,
  className = "",
  controls,
  variant = "chat",
}: StreamdownMessageProps) {
  if (!content) return null;

  return (
    <div
      className={cn(
        "max-w-none break-words [overflow-wrap:anywhere]",
        variant === "chat" &&
          "prose prose-sm dark:prose-invert prose-pre:max-w-full prose-pre:overflow-x-auto",
        className,
      )}
    >
      <SafeStreamdown content={content} isStreaming={isStreaming} controls={controls} />
    </div>
  );
}
