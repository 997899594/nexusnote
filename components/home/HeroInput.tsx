"use client";

import { motion } from "framer-motion";
import { GraduationCap, Send } from "lucide-react";
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
      className="relative bg-[var(--color-surface)] shadow-[var(--shadow-elevated)] hover:shadow-[var(--shadow-elevated-hover)] transition-shadow rounded-2xl md:rounded-3xl min-h-[140px] md:min-h-[160px]"
    >
      <div className="p-5 md:p-8 relative h-full">
        <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-hover)] rounded-lg text-xs z-10">
          <GraduationCap className="w-3 h-3 text-[var(--color-text-tertiary)]" />
          <span className="text-[var(--color-text-secondary)] font-medium">课程访谈</span>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="描述你想学习的内容..."
          rows={1}
          className="w-full bg-transparent border-none outline-none text-base md:text-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-none min-h-[72px] md:min-h-[96px] max-h-[144px] md:max-h-[240px] py-3 pr-14 md:pr-16"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="absolute bottom-4 right-4 md:bottom-6 md:right-6 p-2.5 md:p-3 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="开始课程访谈"
        >
          <Send className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>
    </motion.div>
  );
}
