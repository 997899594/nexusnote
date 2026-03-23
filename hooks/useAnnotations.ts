// hooks/useAnnotations.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

export interface Annotation {
  id: string;
  type: "highlight" | "note";
  anchor: {
    textContent: string; // ~50 chars surrounding the selection
    startOffset: number;
    endOffset: number;
  };
  color?: string;
  noteContent?: string;
  createdAt: string;
}

interface UseAnnotationsOptions {
  sectionId: string | undefined;
  initialAnnotations: Annotation[];
}

interface UseAnnotationsReturn {
  annotations: Annotation[];
  addHighlight: (anchor: Annotation["anchor"], color?: string) => void;
  addNote: (anchor: Annotation["anchor"], noteContent: string, color?: string) => void;
  removeAnnotation: (id: string) => void;
  updateNote: (id: string, noteContent: string) => void;
}

export function useAnnotations({
  sectionId,
  initialAnnotations,
}: UseAnnotationsOptions): UseAnnotationsReturn {
  const { addToast } = useToast();
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when sectionId changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run on sectionId change to reset annotations
  useEffect(() => {
    setAnnotations(initialAnnotations);
  }, [sectionId, initialAnnotations]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Debounced save to API
  const scheduleSave = useCallback(
    (updated: Annotation[]) => {
      if (!sectionId) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(async () => {
        try {
          const response = await fetch("/api/learn/annotations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sectionId, annotations: updated }),
          });
          if (!response.ok) {
            throw new Error("保存失败");
          }
        } catch {
          addToast("笔记保存失败，请稍后重试", "error");
        }
      }, 500);
    },
    [sectionId, addToast],
  );

  const addHighlight = useCallback(
    (anchor: Annotation["anchor"], color = "#fef08a") => {
      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        type: "highlight",
        anchor,
        color,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => {
        const updated = [...prev, newAnnotation];
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  const addNote = useCallback(
    (anchor: Annotation["anchor"], noteContent: string, color = "#bbf7d0") => {
      const newAnnotation: Annotation = {
        id: crypto.randomUUID(),
        type: "note",
        anchor,
        noteContent,
        color,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => {
        const updated = [...prev, newAnnotation];
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  const removeAnnotation = useCallback(
    (id: string) => {
      setAnnotations((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  const updateNote = useCallback(
    (id: string, noteContent: string) => {
      setAnnotations((prev) => {
        const updated = prev.map((a) => (a.id === id ? { ...a, noteContent } : a));
        scheduleSave(updated);
        return updated;
      });
    },
    [scheduleSave],
  );

  return { annotations, addHighlight, addNote, removeAnnotation, updateNote };
}
