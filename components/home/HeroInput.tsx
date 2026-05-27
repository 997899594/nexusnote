"use client";

import { motion } from "framer-motion";
import { GraduationCap, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChatComposer, type ChatComposerSubmitPayload } from "@/components/chat/ChatComposer";
import { PromptChip } from "@/components/common";
import { useInputProtection } from "@/components/common/useInputProtection";

const EXAMPLE_PROMPTS = [
  "三个月内能独立做数据分析",
  "补齐 React 工程化并上线一个项目",
  "把考研数学拆成每周计划",
];

export function HeroInput() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const { handlePaste } = useInputProtection();

  const handleComposerSubmit = ({ text }: ChatComposerSubmitPayload) => {
    router.push(`/interview?msg=${encodeURIComponent(text)}`);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.2 }}
      className="ui-surface-card-lg relative overflow-hidden transition-shadow hover:[box-shadow:var(--shadow-soft-panel-hover)] md:rounded-3xl"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(248,249,251,0.92),transparent)] md:h-24" />

      <div className="relative p-4 md:p-6 lg:p-7">
        <ChatComposer
          value={input}
          onValueChange={setInput}
          onSubmit={handleComposerSubmit}
          onPaste={handlePaste}
          placeholder="写下你想学的内容、期限和目标，我会先问清楚再生成课程蓝图。"
          rows={3}
          autoResize={false}
          submitPlacement="footer"
          className="border-0 bg-transparent p-0 shadow-none focus-within:bg-transparent focus-within:shadow-none"
          textareaClassName="h-28 w-full py-4 text-base leading-7 md:h-auto md:min-h-[104px] md:py-4 md:text-lg md:leading-8 lg:min-h-[118px] lg:text-[1.12rem]"
          footerClassName="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:mt-3 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
          footer={EXAMPLE_PROMPTS.map((prompt, index) => (
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
                className="max-w-[82vw] shrink-0 text-left md:max-w-full"
              />
            </motion.div>
          ))}
          submitContainerClassName="mt-3 flex flex-col gap-3 md:mt-4 md:flex-row md:items-end"
          submitButtonClassName="ui-primary-button inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 transition-opacity disabled:cursor-not-allowed disabled:opacity-50 md:ml-auto md:h-auto md:w-auto"
          submitButtonActiveClassName=""
          submitButtonInactiveClassName="cursor-not-allowed opacity-50"
          submitIconClassName="h-4 w-4 md:h-5 md:w-5"
          submitLabel={<span className="text-sm font-medium">开始访谈</span>}
          submitAriaLabel="开始课程访谈"
        />
      </div>
    </motion.div>
  );
}
