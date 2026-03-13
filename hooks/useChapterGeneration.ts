// hooks/useChapterGeneration.ts

import { marked } from "marked";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface UseChapterGenerationOptions {
  courseId: string;
  chapterIndex: number;
  chapterTitle: string;
  /** Only trigger generation when true (chapter has no existing content) */
  enabled: boolean;
}

interface UseChapterGenerationReturn {
  /** Accumulated markdown text during streaming */
  streamingContent: string;
  /** HTML content after generation completes (for Editor) */
  htmlContent: string;
  /** Whether content is currently being generated */
  isGenerating: boolean;
  /** Whether generation completed successfully */
  isComplete: boolean;
  /** Error message if generation failed */
  error: string | null;
}

export function useChapterGeneration({
  courseId,
  chapterIndex,
  chapterTitle,
  enabled,
}: UseChapterGenerationOptions): UseChapterGenerationReturn {
  const { addToast } = useToast();
  const [streamingContent, setStreamingContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const generatedRef = useRef<Set<string>>(new Set());

  const generate = useCallback(async () => {
    const key = `${courseId}-${chapterIndex}`;
    if (generatedRef.current.has(key)) return;
    generatedRef.current.add(key);

    setStreamingContent("");
    setHtmlContent("");
    setIsGenerating(true);
    setIsComplete(false);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/learn/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, chapterIndex }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `生成失败 (${response.status})`);
      }

      // Check if content already exists (non-streaming response)
      const contentType = response.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data.exists && data.content) {
          setHtmlContent(data.content);
          setIsComplete(true);
          setIsGenerating(false);
          return;
        }
      }

      // Consume text stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamingContent(fullText);
      }

      // Convert markdown to HTML for Editor
      const html = await marked.parse(fullText, { gfm: true, breaks: true });
      setHtmlContent(html);
      setIsComplete(true);
    } catch (err) {
      // Allow retry on abort or error
      generatedRef.current.delete(key);
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "内容生成失败";
      setError(message);
      addToast(message, "error");
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [courseId, chapterIndex, addToast]);

  // Trigger generation when enabled
  useEffect(() => {
    if (enabled) {
      generate();
    }

    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, generate]);

  // Reset state when chapter changes
  useEffect(() => {
    setStreamingContent("");
    setHtmlContent("");
    setIsGenerating(false);
    setIsComplete(false);
    setError(null);
  }, [chapterIndex]);

  return {
    streamingContent,
    htmlContent,
    isGenerating,
    isComplete,
    error,
  };
}
