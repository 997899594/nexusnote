// app/learn/[id]/components/AnnotationLayer.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Annotation } from "@/hooks/useAnnotations";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTextAnchorHighlights } from "@/hooks/useTextAnchorHighlights";

interface AnnotationLayerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  annotations: Annotation[];
  onRemove: (id: string) => void;
}

export function AnnotationLayer({ containerRef, annotations, onRemove }: AnnotationLayerProps) {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const anchoredAnnotations = useMemo(
    () =>
      annotations.map((annotation) => ({
        id: annotation.id,
        anchor: annotation.anchor,
      })),
    [annotations],
  );
  const anchorHighlights = useTextAnchorHighlights({
    containerRef,
    items: anchoredAnnotations,
  });
  const annotationsById = useMemo(
    () => new Map(annotations.map((annotation) => [annotation.id, annotation])),
    [annotations],
  );

  const highlights = useMemo(
    () =>
      anchorHighlights.flatMap((highlight) => {
        const annotation = annotationsById.get(highlight.id);
        if (!annotation) {
          return [];
        }

        return [
          {
            id: annotation.id,
            rects: highlight.rects,
            color: annotation.color ?? "#fef08a",
            type: annotation.type,
            noteContent: annotation.noteContent,
          },
        ];
      }),
    [anchorHighlights, annotationsById],
  );

  if (highlights.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {highlights.map((h) => (
        <div key={h.id}>
          {/* Highlight rectangles */}
          {h.rects.map((rect, i) => (
            <button
              type="button"
              key={`${h.id}-${i}`}
              className="absolute pointer-events-auto cursor-pointer border-none p-0"
              style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                backgroundColor: h.color,
                opacity: 0.35,
                borderRadius: 2,
              }}
              onClick={() => {
                if (h.type === "note") {
                  setActiveNoteId(activeNoteId === h.id ? null : h.id);
                }
              }}
            />
          ))}

          {/* Note icon */}
          {h.type === "note" && h.rects.length > 0 && (
            <button
              type="button"
              className="ui-primary-button absolute pointer-events-auto flex h-5 w-5 items-center justify-center rounded-full text-white hover:scale-110 transition-transform"
              style={{
                top: h.rects[0].top - 4,
                left: h.rects[0].left + h.rects[0].width + 4,
              }}
              onClick={() => setActiveNoteId(activeNoteId === h.id ? null : h.id)}
            >
              <MessageSquare className="w-3 h-3" />
            </button>
          )}

          {/* Note popover */}
          <AnimatePresence>
            {activeNoteId === h.id && h.type === "note" && h.rects.length > 0 && (
              <>
                {isMobile && (
                  <button
                    type="button"
                    className="ui-scrim-soft pointer-events-auto fixed inset-0 z-40"
                    onClick={() => setActiveNoteId(null)}
                    aria-label="关闭笔记"
                  />
                )}
                <motion.div
                  initial={{ opacity: 0, y: isMobile ? 12 : -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: isMobile ? 12 : -5 }}
                  className={
                    isMobile
                      ? "ui-message-card fixed inset-x-3 bottom-3 z-50 pointer-events-auto rounded-[24px] p-4 backdrop-blur-xl safe-bottom"
                      : "ui-message-card absolute z-40 max-w-[280px] rounded-2xl p-3 pointer-events-auto"
                  }
                  style={
                    isMobile
                      ? undefined
                      : {
                          top: h.rects[0].top + h.rects[0].height + 8,
                          left: h.rects[0].left,
                        }
                  }
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                      笔记
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(h.id)}
                      className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {h.noteContent}
                  </p>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
