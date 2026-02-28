/**
 * InterviewOptions - 访谈选项卡片
 *
 * 展示可点击的选项按钮，支持自定义输入和跳过
 */

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, MessageSquare, SkipForward } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface InterviewOptionsProps {
  question: string;
  options: string[];
  allowCustom?: boolean;
  allowSkip?: boolean;
  multiSelect?: boolean;
  onSelect: (selection: string | string[]) => void;
}

export function InterviewOptions({
  question,
  options,
  allowCustom = true,
  allowSkip = false,
  multiSelect = false,
  onSelect,
}: InterviewOptionsProps) {
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleOptionClick = (option: string) => {
    if (submitted) return;

    if (multiSelect) {
      const newSelected = new Set(selectedOptions);
      if (newSelected.has(option)) {
        newSelected.delete(option);
      } else {
        newSelected.add(option);
      }
      setSelectedOptions(newSelected);
    } else {
      // Single select - immediately submit
      setSelectedOptions(new Set([option]));
      setSubmitted(true);
      onSelect(option);
    }
  };

  const handleCustomSubmit = () => {
    if (!customInput.trim() || submitted) return;

    setSubmitted(true);
    if (multiSelect) {
      const newSelected = new Set(selectedOptions);
      newSelected.add(customInput.trim());
      onSelect(Array.from(newSelected));
    } else {
      onSelect(customInput.trim());
    }
  };

  const handleMultiSelectSubmit = () => {
    if (selectedOptions.size === 0 || submitted) return;

    setSubmitted(true);
    onSelect(Array.from(selectedOptions));
  };

  const handleSkip = () => {
    if (submitted) return;
    setSubmitted(true);
    onSelect("__skip__");
  };

  const isSelected = (option: string) => selectedOptions.has(option);

  if (submitted) {
    return (
      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {multiSelect && selectedOptions.size > 0
              ? `已选择 ${selectedOptions.size} 个选项`
              : "已回答"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 p-3 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
      {/* Question */}
      <div className="flex items-start gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm font-medium text-purple-900 dark:text-purple-100">{question}</p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {options.map((option, index) => (
          <motion.button
            key={`${option}-${index}`}
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => handleOptionClick(option)}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200",
              "flex items-center justify-between group",
              isSelected(option)
                ? "bg-purple-600 text-white shadow-md"
                : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-purple-100 dark:hover:bg-zinc-700 border border-purple-100 dark:border-zinc-700",
            )}
          >
            <span className="line-clamp-2">{option}</span>
            <ChevronRight
              className={cn(
                "w-4 h-4 flex-shrink-0 ml-2 transition-transform",
                isSelected(option) ? "text-white" : "text-zinc-400 group-hover:translate-x-1",
              )}
            />
          </motion.button>
        ))}
      </div>

      {/* Custom Input Toggle */}
      {allowCustom && (
        <AnimatePresence mode="wait">
          {!showCustomInput ? (
            <motion.button
              key="add-custom"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomInput(true)}
              className="w-full mt-2 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              + 自定义回答
            </motion.button>
          ) : (
            <motion.div
              key="custom-input"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleCustomSubmit();
                    }
                  }}
                  placeholder="输入你的回答..."
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-purple-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCustomSubmit}
                  disabled={!customInput.trim()}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    customInput.trim()
                      ? "bg-purple-600 text-white hover:bg-purple-700"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed",
                  )}
                >
                  发送
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Multi-select Submit Button */}
      {multiSelect && selectedOptions.size > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleMultiSelectSubmit}
          className="w-full mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          确认选择 ({selectedOptions.size})
        </motion.button>
      )}

      {/* Skip Button */}
      {allowSkip && (
        <button
          type="button"
          onClick={handleSkip}
          className="w-full mt-2 px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex items-center justify-center gap-1"
        >
          <SkipForward className="w-3 h-3" />
          跳过此问题
        </button>
      )}
    </div>
  );
}
