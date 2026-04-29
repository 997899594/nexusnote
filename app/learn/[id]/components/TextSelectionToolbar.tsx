// app/learn/[id]/components/TextSelectionToolbar.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookPlus, Highlighter } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Annotation } from "@/hooks/useAnnotations";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

interface TextSelectionToolbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onHighlight: (anchor: Annotation["anchor"], color?: string) => void;
  onCapture: (anchor: Annotation["anchor"], selectedText: string) => void;
  disabled?: boolean;
}

const HIGHLIGHT_COLORS = [
  { name: "黄色", value: "#fef08a" },
  { name: "绿色", value: "#bbf7d0" },
  { name: "蓝色", value: "#bfdbfe" },
  { name: "粉色", value: "#fecdd3" },
];

function getSelectionAnchor(
  selection: Selection,
  containerEl: HTMLElement,
): Annotation["anchor"] | null {
  if (selection.rangeCount === 0) return null;
  const selectedText = selection.toString().trim();
  if (!selectedText) return null;

  // Get surrounding context (~50 chars)
  const containerText = containerEl.textContent ?? "";
  const selectedStart = containerText.indexOf(selectedText);
  if (selectedStart === -1) return null;

  const contextStart = Math.max(0, selectedStart - 25);
  const contextEnd = Math.min(containerText.length, selectedStart + selectedText.length + 25);
  const textContent = containerText.slice(contextStart, contextEnd);

  return {
    textContent,
    startOffset: selectedStart - contextStart,
    endOffset: selectedStart - contextStart + selectedText.length,
  };
}

export function TextSelectionToolbar({
  containerRef,
  onHighlight,
  onCapture,
  disabled = false,
}: TextSelectionToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [showColors, setShowColors] = useState(false);
  const [selectionPreview, setSelectionPreview] = useState("");
  const selectedTextRef = useRef("");
  const toolbarRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<Annotation["anchor"] | null>(null);
  const isMobile = useIsMobile();

  const handleSelectionChange = useCallback(() => {
    if (disabled) {
      setPosition(null);
      setSelectionPreview("");
      return;
    }

    const selection = window.getSelection();
    if (
      !selection ||
      selection.isCollapsed ||
      !selection.toString().trim() ||
      !containerRef.current
    ) {
      setPosition(null);
      setShowColors(false);
      setSelectionPreview("");
      return;
    }

    // Check selection is within our container
    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setPosition(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    anchorRef.current = getSelectionAnchor(selection, containerRef.current);
    selectedTextRef.current = selection.toString().trim();
    setSelectionPreview(selection.toString().trim().replace(/\s+/g, " ").slice(0, 42));

    if (!isMobile) {
      setPosition({
        top: Math.max(rect.top - containerRect.top - 56, 8),
        left: rect.left - containerRect.left + rect.width / 2,
      });
    } else {
      setPosition({ top: 0, left: 0 });
    }
  }, [containerRef, disabled, isMobile]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  const handleHighlight = (color: string) => {
    if (!anchorRef.current) return;
    onHighlight(anchorRef.current, color);
    window.getSelection()?.removeAllRanges();
    setPosition(null);
    setShowColors(false);
    setSelectionPreview("");
  };

  const handleCapture = () => {
    if (!anchorRef.current || !selectedTextRef.current) return;
    onCapture(anchorRef.current, selectedTextRef.current);
    window.getSelection()?.removeAllRanges();
    setPosition(null);
    setSelectionPreview("");
  };

  return (
    <AnimatePresence>
      {position && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: 5, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn(
            isMobile
              ? "ui-message-card fixed inset-x-3 bottom-3 z-50 rounded-[24px] p-3 backdrop-blur-xl safe-bottom"
              : "ui-message-card absolute z-50 flex items-center gap-1 rounded-xl px-2 py-1.5",
          )}
          style={
            isMobile
              ? undefined
              : {
                  top: position.top,
                  left: position.left,
                  transform: "translateX(-50%)",
                }
          }
        >
          {showColors ? (
            <div className={cn("flex items-center gap-1", isMobile && "flex-wrap gap-2")}>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleHighlight(c.value)}
                  className={cn(
                    "rounded-full border-2 border-white/70 transition-transform hover:scale-110",
                    isMobile ? "h-8 w-8" : "h-6 w-6",
                  )}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setShowColors(false)}
                  className="ml-auto rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
                >
                  返回
                </button>
              )}
            </div>
          ) : (
            <div className={cn(isMobile ? "space-y-3" : "flex items-center gap-1")}>
              {isMobile && (
                <div>
                  <div className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                    已选内容
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    “{selectionPreview}”
                  </p>
                </div>
              )}
              <div className={cn("flex items-center", isMobile ? "gap-2" : "gap-1")}>
                <button
                  type="button"
                  onClick={() => setShowColors(true)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md transition-colors",
                    isMobile
                      ? "flex-1 rounded-2xl bg-[var(--color-panel-soft)] px-3 py-2.5 text-sm text-[var(--color-text)]"
                      : "px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)]",
                  )}
                >
                  <Highlighter className="h-3.5 w-3.5" />
                  <span>高亮</span>
                </button>
                {!isMobile && <div className="h-4 w-px bg-[var(--color-border)]" />}
                <button
                  type="button"
                  onClick={handleCapture}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md transition-colors",
                    isMobile
                      ? "ui-primary-button flex-1 rounded-2xl px-3 py-2.5 text-sm"
                      : "px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)]",
                  )}
                >
                  <BookPlus className="h-3.5 w-3.5" />
                  <span>记一笔</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
