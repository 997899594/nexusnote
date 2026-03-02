"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  label: string;
  action?: string;
}

interface InterviewOptionsProps {
  options: Option[];
  onSelect: (option: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut" as const,
    },
  },
};

export function InterviewOptions({ options, onSelect }: InterviewOptionsProps) {
  if (!options || options.length === 0) {
    return null;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap gap-2"
    >
      {options.map((option, index) => (
        <motion.button
          key={`${option.label}-${index}`}
          variants={itemVariants}
          type="button"
          onClick={() => onSelect(option.action || option.label)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5",
            "text-sm font-medium text-zinc-700 shadow-sm",
            "transition-colors duration-200",
            "hover:bg-zinc-900 hover:text-white hover:border-zinc-900",
            "focus:outline-none focus:ring-2 focus:ring-zinc-500/50 focus:ring-offset-2",
          )}
        >
          <span>{option.label}</span>
          <ChevronRight className="h-4 w-4 opacity-70" />
        </motion.button>
      ))}
    </motion.div>
  );
}

export type { Option, InterviewOptionsProps };
