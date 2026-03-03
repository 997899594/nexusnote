"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

/**
 * ZenModeToggle - Floating button to toggle zen mode
 *
 * Features:
 * - Elegant floating button with tooltip
 * - Keyboard shortcuts:
 *   - `f` key toggles zen mode (not in input fields)
 *   - `Escape` key exits zen mode
 * - Shows shortcut hint on hover
 */
export function ZenModeToggle() {
  const isZenMode = useLearnStore((state) => state.isZenMode);
  const toggleZenMode = useLearnStore((state) => state.toggleZenMode);
  const setZenMode = useLearnStore((state) => state.setZenMode);
  const [showTooltip, setShowTooltip] = useState(false);

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
    <div
      className="fixed bottom-6 right-6 z-50"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5, x: "50%" }}
            animate={{ opacity: 1, y: 0, x: "50%" }}
            exit={{ opacity: 0, y: 5, x: "50%" }}
            className="absolute bottom-full right-1/2 translate-x-1/2 mb-2"
          >
            <div className="flex items-center gap-2 bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
              <Keyboard className="w-3.5 h-3.5" />
              <span>按 F 键切换</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        type="button"
        onClick={toggleZenMode}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          "bg-[var(--color-accent)] text-white",
          "shadow-lg shadow-[var(--color-accent)]/25",
          "hover:shadow-xl hover:shadow-[var(--color-accent)]/30",
          "transition-shadow duration-300",
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isZenMode ? "expand" : "minimize"}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
          >
            {isZenMode ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
