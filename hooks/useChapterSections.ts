// hooks/useChapterSections.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

export interface SectionState {
  content: string; // raw Markdown
  status: "idle" | "queued" | "generating" | "complete" | "error";
  documentId?: string;
  jobId?: string;
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

  // Only one foreground stream is allowed. Section changes never enqueue a backlog.
  const inflightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inflightRef.current?.abort();
    inflightRef.current = null;
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
      // Skip if already complete or already in progress.
      const current = sections.get(sectionIndex);
      if (
        current?.status === "complete" ||
        current?.status === "queued" ||
        current?.status === "generating"
      ) {
        return;
      }

      const controller = new AbortController();
      inflightRef.current = controller;
      setCurrentGenerating(sectionIndex);

      setSections((prev) => {
        const next = new Map(prev);
        next.set(sectionIndex, { content: "", status: "queued" });
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

        const jobId = response.headers.get("X-Course-Production-Job-Id") || undefined;
        if (jobId) {
          setSections((prev) => {
            const next = new Map(prev);
            next.set(sectionIndex, { content: "", status: "queued", jobId });
            return next;
          });
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
            next.set(sectionIndex, { content: captured, status: "generating", jobId });
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

        // No backlog: the visible section decides whether another generation should start.
      }
    },
    [courseId, chapterIndex, sections, addToast],
  );

  const generateSection = useCallback(
    (sectionIndex: number) => {
      const s = sections.get(sectionIndex);
      if (s?.status === "complete" || s?.status === "queued" || s?.status === "generating") {
        return;
      }

      if (inflightRef.current) {
        return;
      }

      doGenerate(sectionIndex);
    },
    [sections, doGenerate],
  );

  return { sections, currentGenerating, generateSection };
}
