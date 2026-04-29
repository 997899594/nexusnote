"use client";

import { PromptChip } from "@/components/common";

interface Option {
  label: string;
  action?: string;
  intent?: "reply" | "revise" | "start_course";
}

// 支持字符串数组或对象数组
type OptionInput = string | Option;

interface InterviewOptionsProps {
  options: OptionInput[];
  onSelect: (option: Option) => void;
  isStreaming?: boolean;
}

// 标准化选项格式
function normalizeOption(option: OptionInput): Option {
  return typeof option === "string" ? { label: option } : option;
}

export function InterviewOptions({ options, onSelect, isStreaming }: InterviewOptionsProps) {
  if (!options || options.length === 0) {
    return null;
  }

  // 流式响应时不显示选项
  if (isStreaming) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option, index) => {
        const normalized = normalizeOption(option);
        return (
          <PromptChip
            key={`${normalized.label}-${index}`}
            label={normalized.label}
            onClick={() => onSelect(normalized)}
            className="bg-[var(--color-panel-soft)] text-xs"
          />
        );
      })}
    </div>
  );
}

export type { Option, InterviewOptionsProps };
