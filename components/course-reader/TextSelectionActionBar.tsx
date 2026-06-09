"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  createSelectionAnchor,
  type TextAnchor,
  type TextSelectionAnchor,
} from "@/lib/learning/text-anchors";
import { cn } from "@/lib/utils";

export interface SelectionAction {
  label: string;
  icon: LucideIcon;
  variant?: "default" | "primary";
  onSelect: (selection: TextSelectionAnchor) => void;
}

interface TextSelectionActionBarProps {
  containerRef: React.RefObject<HTMLElement | null>;
  actions: SelectionAction[];
  disabled?: boolean;
  contextRadius?: number;
  swatchAction?: {
    label: string;
    icon: LucideIcon;
  };
  swatches?: {
    label: string;
    value: string;
  }[];
  onSwatchSelect?: (anchor: TextAnchor, color: string) => void;
}

export function TextSelectionActionBar({
  containerRef,
  actions,
  disabled = false,
  contextRadius = 50,
  swatchAction,
  swatches,
  onSwatchSelect,
}: TextSelectionActionBarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [showSwatches, setShowSwatches] = useState(false);
  const [selectionPreview, setSelectionPreview] = useState("");
  const selectionRef = useRef<TextSelectionAnchor | null>(null);
  const isMobile = useIsMobile();

  const hideActionBar = useCallback(() => {
    setPosition(null);
    setShowSwatches(false);
    setSelectionPreview("");
    selectionRef.current = null;
  }, []);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    hideActionBar();
  }, [hideActionBar]);

  const handleSelectionChange = useCallback(() => {
    if (disabled) {
      hideActionBar();
      return;
    }

    const selection = window.getSelection();
    if (
      !selection ||
      selection.isCollapsed ||
      !selection.toString().trim() ||
      !containerRef.current
    ) {
      hideActionBar();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      hideActionBar();
      return;
    }

    const selectionAnchor = createSelectionAnchor({
      selection,
      container: containerRef.current,
      contextRadius,
    });
    if (!selectionAnchor) {
      hideActionBar();
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    selectionRef.current = selectionAnchor;
    setSelectionPreview(selectionAnchor.selectedText.replace(/\s+/g, " ").slice(0, 42));
    setShowSwatches(false);
    setPosition(
      isMobile
        ? { top: 0, left: 0 }
        : {
            top: Math.max(rect.top - containerRect.top - 56, 8),
            left: rect.left - containerRect.left + rect.width / 2,
          },
    );
  }, [containerRef, contextRadius, disabled, hideActionBar, isMobile]);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  const runAction = (action: SelectionAction) => {
    if (!selectionRef.current) {
      return;
    }

    action.onSelect(selectionRef.current);
    clearSelection();
  };

  const runSwatchAction = (color: string) => {
    if (!selectionRef.current || !onSwatchSelect) {
      return;
    }

    onSwatchSelect(selectionRef.current.anchor, color);
    clearSelection();
  };

  return (
    <AnimatePresence>
      {position ? (
        <motion.div
          initial={{ opacity: 0, y: 5, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.96 }}
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
          {showSwatches && swatches?.length ? (
            <div className={cn("flex items-center gap-1", isMobile && "flex-wrap gap-2")}>
              {swatches.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  onClick={() => runSwatchAction(swatch.value)}
                  className={cn(
                    "rounded-full border-2 border-white/70 transition-transform hover:scale-110",
                    isMobile ? "h-8 w-8" : "h-6 w-6",
                  )}
                  style={{ backgroundColor: swatch.value }}
                  title={swatch.label}
                  aria-label={swatch.label}
                />
              ))}
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setShowSwatches(false)}
                  className="ml-auto rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
                >
                  返回
                </button>
              ) : null}
            </div>
          ) : (
            <div className={cn(isMobile ? "space-y-3" : "flex items-center gap-1")}>
              {isMobile ? (
                <div>
                  <div className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                    已选内容
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    “{selectionPreview}”
                  </p>
                </div>
              ) : null}
              <div className={cn("flex items-center", isMobile ? "gap-2" : "gap-1")}>
                {swatchAction && swatches?.length ? (
                  <button
                    type="button"
                    onClick={() => setShowSwatches(true)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md transition-colors",
                      isMobile
                        ? "flex-1 rounded-2xl bg-[var(--color-panel-soft)] px-3 py-2.5 text-sm text-[var(--color-text)]"
                        : "px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)]",
                    )}
                  >
                    <swatchAction.icon className="h-3.5 w-3.5" />
                    <span>{swatchAction.label}</span>
                  </button>
                ) : null}
                {actions.map((action, index) => (
                  <div key={action.label} className="contents">
                    {index > 0 || (swatchAction && swatches?.length) ? (
                      !isMobile ? (
                        <div className="h-4 w-px bg-[var(--color-border)]" />
                      ) : null
                    ) : null}
                    <button
                      type="button"
                      onClick={() => runAction(action)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md transition-colors",
                        action.variant === "primary" && "ui-primary-button",
                        isMobile
                          ? "flex-1 rounded-2xl px-3 py-2.5 text-sm"
                          : action.variant === "primary"
                            ? "px-2.5 py-1 text-xs"
                            : "px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-soft)]",
                      )}
                    >
                      <action.icon className="h-3.5 w-3.5" />
                      <span>{action.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
