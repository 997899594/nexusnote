"use client";

import { motion } from "framer-motion";
import { PromptChip } from "@/components/common";

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
      className="mt-3 flex flex-wrap gap-2"
    >
      {options.map((option, index) => {
        const normalized = normalizeOption(option);
        return (
          <motion.div key={`${normalized.label}-${index}`} variants={itemVariants}>
            <PromptChip
              label={normalized.label}
              onClick={() => onSelect(normalized.action || normalized.label)}
              className="bg-[#f8fafc] text-xs"
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export type { Option, InterviewOptionsProps };
