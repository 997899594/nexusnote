// hooks/useChapterSections.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

export interface SectionState {
  content: string; // raw Markdown
  status: "idle" | "generating" | "complete" | "error";
  documentId?: string;
  error?: string;
}

interface UseChapterSectionsOptions {
  courseId: string;
  chapterIndex: number;
  sectionCount: number;
  /** Pre-loaded content from server (nodeId → { content, documentId }) */
  initialContent: Map<string, { content: string; documentId: string }>;
}

interface UseChapterSectionsReturn {
  sections: Map<number, SectionState>;
  currentGenerating: number | null;
  generateSection: (sectionIndex: number) => void;
}

export function useChapterSections({
  courseId,
  chapterIndex,
  sectionCount,
  initialContent,
}: UseChapterSectionsOptions): UseChapterSectionsReturn {
  const { addToast } = useToast();
  const [sections, setSections] = useState<Map<number, SectionState>>(new Map());
  const [currentGenerating, setCurrentGenerating] = useState<number | null>(null);

  // Track in-flight request to prevent concurrency
  const inflightRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<number | null>(null);
  const chapterRef = useRef(chapterIndex);

  // Initialize sections from server data on chapter change
  useEffect(() => {
    chapterRef.current = chapterIndex;
    inflightRef.current?.abort();
    inflightRef.current = null;
    pendingRef.current = null;
    setCurrentGenerating(null);

    const initial = new Map<number, SectionState>();
    for (let i = 0; i < sectionCount; i++) {
      const nodeId = `section-${chapterIndex + 1}-${i + 1}`;
      const existing = initialContent.get(nodeId);
      if (existing?.content) {
        initial.set(i, {
          content: existing.content,
          status: "complete",
          documentId: existing.documentId,
        });
      } else {
        initial.set(i, { content: "", status: "idle" });
      }
    }
    setSections(initial);
  }, [chapterIndex, sectionCount, initialContent]);

  // Core generate function
  const doGenerate = useCallback(
    async (sectionIndex: number) => {
      // Skip if already complete or generating
      const current = sections.get(sectionIndex);
      if (current?.status === "complete" || current?.status === "generating") return;

      const controller = new AbortController();
      inflightRef.current = controller;
      setCurrentGenerating(sectionIndex);

      setSections((prev) => {
        const next = new Map(prev);
        next.set(sectionIndex, { content: "", status: "generating" });
        return next;
      });

      try {
        const response = await fetch("/api/learn/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, chapterIndex, sectionIndex }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error?.message || `生成失败 (${response.status})`);
        }

        // Check if content already exists (non-streaming JSON response)
        const contentType = response.headers.get("Content-Type") ?? "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          if (data.exists && data.content) {
            setSections((prev) => {
              const next = new Map(prev);
              next.set(sectionIndex, {
                content: data.content,
                status: "complete",
                documentId: data.documentId,
              });
              return next;
            });
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

          // Update streaming content
          const captured = fullText;
          setSections((prev) => {
            const next = new Map(prev);
            next.set(sectionIndex, { content: captured, status: "generating" });
            return next;
          });
        }

        // Mark complete
        setSections((prev) => {
          const next = new Map(prev);
          next.set(sectionIndex, { content: fullText, status: "complete" });
          return next;
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const message = err instanceof Error ? err.message : "内容生成失败";
        setSections((prev) => {
          const next = new Map(prev);
          next.set(sectionIndex, { content: "", status: "error", error: message });
          return next;
        });
        addToast(message, "error");
      } finally {
        inflightRef.current = null;
        setCurrentGenerating(null);

        // Prefetch: auto-trigger next section if still same chapter
        if (chapterRef.current === chapterIndex) {
          const pending = pendingRef.current;
          pendingRef.current = null;

          if (pending !== null) {
            // A specific section was requested while generating — prioritize it
            doGenerate(pending);
          } else {
            // Auto-prefetch next incomplete section
            for (let i = sectionIndex + 1; i < sectionCount; i++) {
              const s = sections.get(i);
              if (!s || s.status === "idle") {
                doGenerate(i);
                break;
              }
            }
          }
        }
      }
    },
    [courseId, chapterIndex, sectionCount, sections, addToast],
  );

  // Public generate — handles concurrency (serial, one at a time)
  const generateSection = useCallback(
    (sectionIndex: number) => {
      const s = sections.get(sectionIndex);
      if (s?.status === "complete") return;

      if (inflightRef.current) {
        // Already generating — queue this section for after current finishes
        pendingRef.current = sectionIndex;
        return;
      }

      doGenerate(sectionIndex);
    },
    [sections, doGenerate],
  );

  // Auto-start first ungenerated section on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-trigger on chapter change to avoid infinite generation loops
  useEffect(() => {
    // Small delay to let initial state settle
    const timer = setTimeout(() => {
      for (let i = 0; i < sectionCount; i++) {
        const s = sections.get(i);
        if (!s || s.status === "idle") {
          generateSection(i);
          break;
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [chapterIndex]); // Only re-trigger on chapter change

  return { sections, currentGenerating, generateSection };
}
