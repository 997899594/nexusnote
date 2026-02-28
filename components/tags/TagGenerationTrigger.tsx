/**
 * TagGenerationTrigger - 标签自动生成触发器
 *
 * 当文档内容变化超过阈值时，延迟触发标签生成 API
 */

"use client";

import { useEffect, useRef } from "react";

interface TagGenerationTriggerProps {
  documentId: string;
  content: string;
}

export function TagGenerationTrigger({ documentId, content }: TagGenerationTriggerProps) {
  const prevContentRef = useRef(content);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 计算内容变化量
    const diff = Math.abs(content.length - prevContentRef.current.length);

    // 变化量太小，不触发
    if (diff < 50) return;

    // 清除之前的定时器
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // 延迟 5 秒触发，避免频繁请求
    timeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/documents/${documentId}/tags`, { method: "POST" });
        console.log("[Tags] 触发标签生成");
      } catch (error) {
        console.error("[Tags] 生成失败:", error);
      }
      prevContentRef.current = content;
    }, 5000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [documentId, content]);

  return null;
}
