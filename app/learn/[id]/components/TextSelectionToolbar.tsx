// app/learn/[id]/components/TextSelectionToolbar.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Highlighter, StickyNote } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Annotation } from "@/hooks/useAnnotations";

interface TextSelectionToolbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onHighlight: (anchor: Annotation["anchor"], color?: string) => void;
  onNote: (anchor: Annotation["anchor"]) => void;
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
  onNote,
  disabled = false,
}: TextSelectionToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [showColors, setShowColors] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<Annotation["anchor"] | null>(null);

  const handleSelectionChange = useCallback(() => {
    if (disabled) {
      setPosition(null);
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

    setPosition({
      top: rect.top - containerRect.top - 48,
      left: rect.left - containerRect.left + rect.width / 2,
    });
  }, [containerRef, disabled]);

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
  };

  const handleNote = () => {
    if (!anchorRef.current) return;
    onNote(anchorRef.current);
    window.getSelection()?.removeAllRanges();
    setPosition(null);
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
          className="absolute z-50 flex items-center gap-1 bg-zinc-900 rounded-lg px-2 py-1.5 shadow-xl"
          style={{
            top: position.top,
            left: position.left,
            transform: "translateX(-50%)",
          }}
        >
          {showColors ? (
            <div className="flex items-center gap-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleHighlight(c.value)}
                  className="w-6 h-6 rounded-full border-2 border-white/20 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowColors(true)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-white",
                  "hover:bg-white/10 transition-colors",
                )}
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span>高亮</span>
              </button>
              <div className="w-px h-4 bg-white/20" />
              <button
                type="button"
                onClick={handleNote}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-white",
                  "hover:bg-white/10 transition-colors",
                )}
              >
                <StickyNote className="w-3.5 h-3.5" />
                <span>笔记</span>
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
