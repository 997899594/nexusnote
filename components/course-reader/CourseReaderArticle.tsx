"use client";

import type { ReactNode, RefObject } from "react";
import { StreamdownMessage } from "@/components/chat/StreamdownMessage";
import { cn } from "@/lib/utils";

interface CourseReaderArticleProps {
  containerRef: RefObject<HTMLDivElement | null>;
  content: string;
  isStreaming?: boolean;
  emptyLabel?: string;
  className?: string;
  children?: ReactNode;
}

export function CourseReaderArticle({
  containerRef,
  content,
  isStreaming = false,
  emptyLabel = "这一节还没有内容。",
  className,
  children,
}: CourseReaderArticleProps) {
  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <article className="px-1 py-1 md:px-2">
        <div className="learn-prose pb-10 md:pb-12">
          {content ? (
            <StreamdownMessage
              content={content}
              isStreaming={isStreaming}
              variant="reader"
              controls={{ code: false, mermaid: false, table: false }}
            />
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">{emptyLabel}</p>
          )}
        </div>
      </article>
      {children}
    </div>
  );
}
