/**
 * Markdown Renderer - Server Component 版本
 *
 * 2026 现代化方案：
 * - 使用 marked 在服务端渲染 Markdown
 * - 不需要 "use client"
 */

import { marked } from "marked";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * 服务端 Markdown 渲染器
 * 使用 marked 库在服务端生成 HTML，然后使用 dangerouslySetInnerHTML
 *
 * 注意：这比 React Markdown 更快，但需要信任内容来源
 */
export async function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null;

  const html = await marked(content);

  return (
    <div
      className={className}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
