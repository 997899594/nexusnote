"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, GraduationCap, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { LoadingDots } from "@/components/chat/ChatMessage";
import { PromptChip, WorkspaceEmptyState } from "@/components/common";
import { InterviewMessage } from "@/components/interview/InterviewMessage";
import { OutlinePanel } from "@/components/interview/OutlinePanel";
import { useInterview } from "@/hooks/useInterview";
import { cn } from "@/lib/utils";
import { useInterviewStore } from "@/stores/interview";

const panelVariants = {
  hidden: {
    width: 0,
    opacity: 0,
    x: -320,
  },
  visible: {
    width: 320,
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
      mass: 1,
      staggerChildren: 0.1,
    },
  },
};

const contentVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 35,
    },
  },
};

const mainContentVariants = {
  full: { marginLeft: 0 },
  withPanel: {
    marginLeft: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  },
};

function InterviewContent() {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get("msg");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);

  const interview = useInterview({
    initialMessage: initialMessage || undefined,
  });

  const outline = useInterviewStore((s) => s.outline);
  const courseId = useInterviewStore((s) => s.courseId);
  const isOutlineLoading = useInterviewStore((s) => s.isOutlineLoading);
  const interviewCompleted = useInterviewStore((s) => s.interviewCompleted);

  useEffect(() => {
    if (initialMessage && !started) {
      setStarted(true);
    }
  }, [initialMessage, started]);

  const messages = interview.messages;
  const sendMessage = interview.sendMessage;
  const status = interview.status;
  const isLoading = interview.isLoading;

  const chatMessages = messages;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    await sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const lastMsg = chatMessages[chatMessages.length - 1];
  const isAILoading =
    (status === "submitted" || status === "streaming") && (!lastMsg || lastMsg.role === "user");
  const shouldShowOutlinePanel = Boolean(outline) || isOutlineLoading || interviewCompleted;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7f9]">
      <AnimatePresence mode="wait">
        {shouldShowOutlinePanel && (
          <motion.div
            key="outline-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="flex-shrink-0 overflow-hidden"
          >
            <motion.div variants={contentVariants} className="h-full w-80">
              <OutlinePanel
                outline={outline}
                isLoading={isOutlineLoading}
                courseId={courseId ?? undefined}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={mainContentVariants}
        initial="full"
        animate={shouldShowOutlinePanel ? "withPanel" : "full"}
        className="flex min-w-0 flex-1 flex-col bg-white"
      >
        <header className="flex items-center gap-4 px-4 py-4 md:px-6">
          <Link
            href="/"
            className="rounded-xl p-2 transition-colors hover:bg-[#f3f5f8]"
            aria-label="返回首页"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111827]">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-[var(--color-text)]">课程访谈</h1>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {interviewCompleted
                  ? "大纲已生成"
                  : shouldShowOutlinePanel
                    ? "正在整理课程蓝图"
                    : "告诉我你想学什么"}
              </p>
              {!interviewCompleted &&
                chatMessages.length > 0 &&
                (() => {
                  const userMessageCount = chatMessages.filter((m) => m.role === "user").length;

                  return (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex gap-1">
                        {Array.from(
                          { length: Math.min(userMessageCount, 6) },
                          (_, i) => `dot-${i}`,
                        ).map((dotId) => (
                          <motion.div
                            key={dotId}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="h-1.5 w-1.5 rounded-full bg-[#111827]"
                          />
                        ))}
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        第 {userMessageCount} 轮
                      </span>
                    </div>
                  );
                })()}
            </div>
          </div>
        </header>

        <div className="mobile-scroll flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <div className="max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)] mx-auto space-y-4">
            {chatMessages.length === 0 && !isLoading && !started && (
              <div className="text-center py-12">
                <WorkspaceEmptyState
                  icon={GraduationCap}
                  eyebrow="Course Interview"
                  title="你想学什么？"
                  description="告诉我你的学习目标，我会先访谈澄清方向，再生成可直接预览的课程大纲。"
                  footer={
                    <div className="flex flex-wrap justify-center gap-2">
                      {["我想学 Python", "我想学做 PPT", "考研数学怎么准备", "教我做川菜"].map(
                        (example, index) => (
                          <motion.div
                            key={example}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + index * 0.05 }}
                          >
                            <PromptChip
                              label={example}
                              onClick={() => {
                                setStarted(true);
                                void sendMessage({ text: example });
                              }}
                            />
                          </motion.div>
                        ),
                      )}
                    </div>
                  }
                  className="mx-auto max-w-2xl"
                />
              </div>
            )}

            {chatMessages.map((msg, index) => (
              <InterviewMessage
                key={msg.id}
                message={msg}
                onSendReply={(text) => sendMessage({ text })}
                isStreaming={isLoading && index === chatMessages.length - 1}
              />
            ))}

            {isAILoading && <LoadingDots />}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="bg-white px-4 py-3 md:px-6 md:py-4">
          <div className="max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)] mx-auto">
            <div className="flex items-end gap-2 rounded-2xl bg-[#f7f8fa] p-2 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.14)] md:gap-3 md:p-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#111827]">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={interviewCompleted ? "继续调整大纲..." : "继续对话..."}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-none min-h-[24px] max-h-[120px]"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                  input.trim() && !isLoading
                    ? "bg-[#111827] text-white"
                    : "bg-zinc-200 text-[var(--color-text-muted)] cursor-not-allowed",
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function InterviewPageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[var(--color-bg)]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-muted)]" />
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  );
}
