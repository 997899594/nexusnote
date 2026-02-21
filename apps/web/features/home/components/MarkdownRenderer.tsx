/**
 * Markdown Renderer - 使用 react-markdown 渲染 AI 返回的 Markdown
 *
 * 2026 现代化方案：AI 返回 Markdown，前端渲染为富文本
 */

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mb-3 mt-4 text-zinc-800 dark:text-zinc-100">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mb-2 mt-3 text-zinc-800 dark:text-zinc-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium mb-2 mt-2 text-zinc-800 dark:text-zinc-100">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-2 leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</p>
          ),
          ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-zinc-700 dark:text-zinc-300">{children}</li>,
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-zinc-800 dark:text-zinc-200">
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`${className} block bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg text-sm font-mono overflow-x-auto`}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="mb-3 overflow-x-auto">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 italic my-3 text-zinc-600 dark:text-zinc-400">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-4 border-zinc-200 dark:border-zinc-700" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-800 dark:text-zinc-100">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-zinc-700 dark:text-zinc-300">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
