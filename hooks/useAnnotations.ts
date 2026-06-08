// hooks/useAnnotations.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  type Annotation,
  persistSectionAnnotations,
} from "@/lib/learning/learn-annotations-client";

export type { Annotation } from "@/lib/learning/learn-annotations-client";

interface UseAnnotationsOptions {
  sectionId: string | undefined;
  initialAnnotations: Annotation[];
}

interface UseAnnotationsReturn {
  annotations: Annotation[];
  addHighlight: (anchor: Annotation["anchor"], color?: string) => void;
  removeAnnotation: (id: string) => void;
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
          await persistSectionAnnotations({ sectionId, annotations: updated });
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

  return { annotations, addHighlight, removeAnnotation };
}
