"use client";

/**
 * StreamdownMessage - 流式 Markdown 渲染组件
 *
 * 使用 Streamdown，专为 AI 流式优化
 * 支持代码高亮、数学公式、Mermaid 图表、中文优化
 */

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";
import "katex/dist/katex.min.css";

interface StreamdownMessageProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

/**
 * 安全的 Streamdown 包装器
 * 降级策略：如果渲染失败，显示纯文本
 */
function SafeStreamdown({
  content,
  isStreaming,
  className,
}: {
  content: string;
  isStreaming?: boolean;
  className?: string;
}) {
  try {
    return (
      <Streamdown
        plugins={{ code, math, mermaid, cjk }}
        isAnimating={isStreaming}
        className={className}
      >
        {content}
      </Streamdown>
    );
  } catch (error) {
    // 降级到纯文本
    console.error("[Streamdown] Render error:", error);
    return (
      <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
        {content}
      </pre>
    );
  }
}

export function StreamdownMessage({
  content,
  isStreaming = false,
  className = "",
}: StreamdownMessageProps) {
  if (!content) return null;

  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
      <SafeStreamdown content={content} isStreaming={isStreaming} />
    </div>
  );
}
