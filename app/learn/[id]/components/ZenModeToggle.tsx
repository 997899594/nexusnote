"use client";

import { motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

/**
 * ZenModeToggle - Floating button to toggle zen mode
 *
 * Features:
 * - Floating button at bottom-right corner
 * - Keyboard shortcuts:
 *   - `f` key toggles zen mode (not in input fields)
 *   - `Escape` key exits zen mode
 */
export function ZenModeToggle() {
  const isZenMode = useLearnStore((state) => state.isZenMode);
  const toggleZenMode = useLearnStore((state) => state.toggleZenMode);
  const setZenMode = useLearnStore((state) => state.setZenMode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape exits zen mode
      if (e.key === "Escape" && isZenMode) {
        setZenMode(false);
      }

      // F toggles zen mode (not in input fields)
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        toggleZenMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZenMode, setZenMode, toggleZenMode]);

  return (
    <motion.button
      type="button"
      onClick={toggleZenMode}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "w-10 h-10 rounded-full flex items-center justify-center",
        "bg-zinc-800 text-white shadow-lg",
        "hover:bg-zinc-700 transition-colors",
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {isZenMode ? <Maximize2 /> : <Minimize2 />}
    </motion.button>
  );
}
