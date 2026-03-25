"use client";

import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useInputProtection } from "@/components/common/useInputProtection";

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

      <div className="relative p-4 md:p-8">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="例如：我想系统学 SQL 和数据分析，三个月内能独立完成日常报表分析。"
          rows={3}
          className="w-full resize-none border-none bg-transparent py-4 text-base leading-7 text-black/85 outline-none placeholder:text-black/28 md:min-h-[132px] md:py-5 md:text-lg md:leading-8"
        />

        <div className="mt-2 flex justify-end border-t border-black/6 pt-3 md:mt-4 md:pt-4">
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
