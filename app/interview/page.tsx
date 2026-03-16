"use client";

import type { UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, GraduationCap, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage, LoadingDots } from "@/components/chat/ChatMessage";
import { OutlinePanel } from "@/components/interview/OutlinePanel";
import { useInterview } from "@/hooks/useInterview";
import { cn } from "@/lib/utils";
import { useInterviewStore } from "@/stores/interview";

// 左侧面板入场动画变体
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

// 面板内容淡入动画
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

// 主内容区域调整动画
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

  // 从 store 获取状态
  const outline = useInterviewStore((s) => s.outline);
  const courseId = useInterviewStore((s) => s.courseId);
  const isOutlineLoading = useInterviewStore((s) => s.isOutlineLoading);
  const interviewCompleted = useInterviewStore((s) => s.interviewCompleted);

  // 标记是否已开始
  useEffect(() => {
    if (initialMessage && !started) {
      setStarted(true);
    }
  }, [initialMessage, started]);

  const messages = interview.messages;
  const sendMessage = interview.sendMessage;
  const status = interview.status;
  const isLoading = interview.isLoading;

  const chatMessages = messages.filter((m: UIMessage) => m.role !== "system");

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

  return (
    <div className="flex h-screen bg-[var(--color-bg)] overflow-hidden">
      {/* 左侧大纲面板 - 只在访谈完成后显示 */}
      <AnimatePresence mode="wait">
        {interviewCompleted && (
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

      {/* 右侧聊天面板 */}
      <motion.div
        variants={mainContentVariants}
        initial="full"
        animate={interviewCompleted ? "withPanel" : "full"}
        className="flex flex-col flex-1 min-w-0 bg-[var(--color-surface)]"
      >
        {/* Header */}
        <header className="flex items-center gap-4 px-4 md:px-6 py-4">
          <Link
            href="/chat"
            className="p-2 hover:bg-[var(--color-hover)] rounded-xl transition-colors"
            aria-label="返回聊天"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[var(--color-accent-fg)]" />
            </div>
            <div>
              <h1 className="font-semibold text-[var(--color-text)]">课程访谈</h1>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {interviewCompleted ? "大纲已生成" : "告诉我你想学什么"}
              </p>
              {/* Progress indicator */}
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
                            className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto mobile-scroll px-4 md:px-6 py-4">
          <div className="max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)] mx-auto space-y-4">
            {/* 空状态 */}
            {chatMessages.length === 0 && !isLoading && !started && (
              <div className="text-center py-12">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center"
                >
                  <GraduationCap className="w-8 h-8 text-[var(--color-accent-fg)]" />
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-lg font-medium text-[var(--color-text)] mb-2"
                >
                  你想学什么？
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-sm text-[var(--color-text-tertiary)] mb-6"
                >
                  告诉我你的学习目标，我会为你定制课程
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-wrap justify-center gap-2"
                >
                  {["我想学 Python", "我想学做 PPT", "考研数学怎么准备", "教我做川菜"].map(
                    (example, index) => (
                      <motion.button
                        key={example}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.25 + index * 0.05 }}
                        type="button"
                        onClick={() => {
                          setStarted(true);
                          sendMessage({ text: example });
                        }}
                        className="px-4 py-2 bg-[var(--color-hover)] hover:bg-[var(--color-active)] rounded-full text-sm text-[var(--color-text-secondary)] transition-colors"
                      >
                        {example}
                      </motion.button>
                    ),
                  )}
                </motion.div>
              </div>
            )}

            {/* 消息列表 */}
            {chatMessages.map((msg, index) => (
              <ChatMessage
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

        {/* Input */}
        <div className="bg-[var(--color-surface)] px-4 md:px-6 py-3 md:py-4">
          <div className="max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)] mx-auto">
            <div className="flex items-end gap-2 md:gap-3 bg-[var(--color-hover)] rounded-2xl p-2 md:p-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 text-[var(--color-accent-fg)]" />
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
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                    : "bg-[var(--color-muted)] text-[var(--color-text-muted)] cursor-not-allowed",
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

export default function InterviewPage() {
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
