"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Option {
  label: string;
  action?: string;
}

// 支持字符串数组或对象数组
type OptionInput = string | Option;

interface InterviewOptionsProps {
  options: OptionInput[];
  onSelect: (option: string) => void;
  isStreaming?: boolean;
}

// 标准化选项格式
function normalizeOption(option: OptionInput): Option {
  return typeof option === "string" ? { label: option } : option;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 5 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: "easeOut" as const,
    },
  },
};

export function InterviewOptions({ options, onSelect, isStreaming }: InterviewOptionsProps) {
  if (!options || options.length === 0) {
    return null;
  }

  // 流式响应时不显示选项
  if (isStreaming) {
    return null;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap gap-1.5 mt-2"
    >
      {options.map((option, index) => {
        const normalized = normalizeOption(option);
        return (
          <motion.button
            key={`${normalized.label}-${index}`}
            variants={itemVariants}
            type="button"
            onClick={() => onSelect(normalized.action || normalized.label)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={cn(
              "inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50",
              "px-2.5 py-1 text-xs font-medium text-zinc-600",
              "transition-colors duration-150",
              "hover:bg-zinc-900 hover:text-white hover:border-zinc-900",
              "focus:outline-none focus:ring-1 focus:ring-zinc-400",
            )}
          >
            {normalized.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

export type { Option, InterviewOptionsProps };
