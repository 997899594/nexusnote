"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Command } from "@/types/chat";

interface CommandMenuProps {
  commands: Command[];
  selectedIndex: number;
  onSelect: (command: Command) => void;
}

export function CommandMenu({ commands, selectedIndex, onSelect }: CommandMenuProps) {
  if (commands.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 right-0 z-50 mb-3 overflow-hidden rounded-2xl bg-white shadow-[0_24px_56px_-36px_rgba(15,23,42,0.18)]"
    >
      <div className="p-2">
        <div className="px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          命令
        </div>
        {commands.map((cmd, idx) => (
          <button
            type="button"
            key={cmd.id}
            onClick={() => onSelect(cmd)}
            className={cn(
              "w-full flex items-center px-3 py-3 rounded-xl text-left transition-colors",
              idx === selectedIndex
                ? "bg-[#f3f5f8] text-[var(--color-text)]"
                : "text-[var(--color-text-secondary)] hover:bg-[#f6f7f9]",
            )}
          >
            <cmd.icon className="w-4 h-4 mr-3 flex-shrink-0 text-[var(--color-text-muted)]" />
            <span className="flex-1 text-sm font-medium">{cmd.label}</span>
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
