/**
 * Markdown Renderer - 使用 Streamdown 渲染 Markdown
 *
 * 2026 现代化方案：AI 返回 Markdown，前端渲染为富文本
 * 专为流式优化，支持代码高亮、数学公式、Mermaid 图表
 */

"use client";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

export function MarkdownRenderer({
  content,
  className = "",
  isStreaming = false,
}: MarkdownRendererProps) {
  if (!content) return null;

  try {
    return (
      <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
        <Streamdown
          plugins={{ code, math, mermaid, cjk }}
          isAnimating={isStreaming}
        >
          {content}
        </Streamdown>
      </div>
    );
  } catch (error) {
    console.error("[MarkdownRenderer] Render error:", error);
    return <p className="whitespace-pre-wrap">{content}</p>;
  }
}
