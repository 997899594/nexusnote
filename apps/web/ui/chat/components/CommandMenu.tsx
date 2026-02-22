"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Command } from "../types";

interface CommandMenuProps {
  commands: Command[];
  selectedIndex: number;
  onSelect: (command: Command) => void;
  onClose: () => void;
}

export function CommandMenu({ commands, selectedIndex, onSelect, onClose }: CommandMenuProps) {
  if (commands.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 right-0 mb-3 bg-white rounded-2xl shadow-[var(--shadow-elevated)] overflow-hidden z-50"
    >
      <div className="p-2">
        <div className="px-3 py-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
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
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-50",
            )}
          >
            <cmd.icon className="w-4 h-4 mr-3 flex-shrink-0 text-zinc-400" />
            <span className="flex-1 text-sm font-medium">{cmd.label}</span>
            <ChevronRight className="w-4 h-4 text-zinc-300" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
