"use client";

import { motion } from "framer-motion";
import { useState } from "react";
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
  const [selected, setSelected] = useState(false);

  if (!options || options.length === 0) {
    return null;
  }

  // 流式响应时不显示选项
  if (isStreaming) {
    return null;
  }

  const handleSelect = (option: string) => {
    if (selected) return;
    setSelected(true);
    onSelect(option);
  };

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
            onClick={() => handleSelect(normalized.action || normalized.label)}
            disabled={selected}
            className={cn(
              "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
              "transition-colors duration-150",
              "focus:outline-none focus:ring-1 focus:ring-zinc-400",
              selected
                ? "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed"
                : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-900 hover:text-white hover:border-zinc-900",
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
