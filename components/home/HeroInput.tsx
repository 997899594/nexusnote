"use client";

import { motion } from "framer-motion";
import { GraduationCap, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PromptChip } from "@/components/common";
import { useInputProtection } from "@/components/common/useInputProtection";

const EXAMPLE_PROMPTS = [
  "我想系统学 React，并做一个作品集项目",
  "我想学做 PPT，两周后能独立完成工作汇报",
  "我想准备考研数学，想先有一套三个月计划",
];

export function HeroInput() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const { handlePaste } = useInputProtection();

  const handleSubmit = () => {
    const message = input.trim();
    if (!message) return;

    router.push(`/interview?msg=${encodeURIComponent(message)}`);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.2 }}
      className="ui-surface-card-lg relative overflow-hidden transition-shadow hover:[box-shadow:var(--shadow-soft-panel-hover)] md:rounded-3xl"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(248,249,251,0.92),transparent)] md:h-24" />

      <div className="relative p-4 md:p-6 lg:p-7">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="例如：我想系统学 SQL 和数据分析，三个月内能独立完成日常报表分析。"
          rows={3}
          className="h-28 w-full resize-none border-none bg-transparent py-4 text-base leading-7 text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] md:h-auto md:min-h-[104px] md:py-4 md:text-lg md:leading-8 lg:min-h-[118px] lg:text-[1.12rem]"
        />

        <div className="mt-2 hidden flex-wrap gap-2 md:mt-3 md:flex">
          {EXAMPLE_PROMPTS.map((prompt, index) => (
            <motion.div
              key={prompt}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * index }}
            >
              <PromptChip
                label={prompt}
                icon={index === 0 ? Sparkles : GraduationCap}
                onClick={() => {
                  setInput(prompt);
                }}
                className="max-w-full text-left"
              />
            </motion.div>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-3 md:mt-4 md:flex-row md:items-center md:justify-between">
          <div className="hidden text-sm text-[var(--color-text-tertiary)] md:block">
            输入越具体，访谈越快进入课程生成。
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="ui-primary-button inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 transition-opacity disabled:cursor-not-allowed disabled:opacity-50 md:h-auto md:w-auto"
            aria-label="开始课程访谈"
          >
            <Send className="h-4 w-4 md:h-5 md:w-5" />
            <span className="text-sm font-medium">开始访谈</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
