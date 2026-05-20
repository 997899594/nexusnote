"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookOpen, GraduationCap, Loader2, Send, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { LoadingDots } from "@/components/chat/ChatMessage";
import { AIDegradationBanner, PromptChip, WorkspaceEmptyState } from "@/components/common";
import { InterviewMessage } from "@/components/interview/InterviewMessage";
import { OutlinePanel } from "@/components/interview/OutlinePanel";
import { useInterview } from "@/hooks/useInterview";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

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
  const isMobile = useIsMobile();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [isMobileOutlineOpen, setIsMobileOutlineOpen] = useState(false);

  const interview = useInterview({
    initialMessage: initialMessage || undefined,
  });

  useEffect(() => {
    if (initialMessage && !started) {
      setStarted(true);
    }
  }, [initialMessage, started]);

  const messages = interview.messages;
  const sendMessage = interview.sendMessage;
  const status = interview.status;
  const isLoading = interview.isLoading;
  const aiDegradedKind = interview.aiDegradedKind;
  const displayOutline = interview.outline.display;
  const stableOutline = interview.outline.stable;
  const outlineActions = interview.outline.actions;
  const isOutlineLoading = interview.outline.isLoading;
  const interviewCompleted = interview.outline.isReady;
  const courseId = interview.course.id;
  const setCourseId = interview.course.setId;

  const chatMessages = messages;

  useEffect(() => {
    if (chatMessages.length === 0 && !isLoading) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, isLoading]);

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
  const shouldShowOutlinePanel =
    Boolean(displayOutline) || Boolean(stableOutline) || isOutlineLoading || interviewCompleted;
  const activeOutline = displayOutline ?? stableOutline;
  const outlineStatusLabel = interviewCompleted
    ? "可开始学习"
    : isOutlineLoading
      ? "整理中"
      : stableOutline
        ? "已生成"
        : "可查看";

  useEffect(() => {
    if (!isMobile || !shouldShowOutlinePanel) {
      setIsMobileOutlineOpen(false);
    }
  }, [isMobile, shouldShowOutlinePanel]);

  const mobileOutlineDock =
    isMobile && shouldShowOutlinePanel ? (
      <div className="shrink-0 border-black/5 border-t bg-white/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => setIsMobileOutlineOpen(true)}
          className="ui-message-card flex w-full items-center gap-3 rounded-[22px] p-3 text-left transition-transform active:scale-[0.99]"
          aria-expanded={isMobileOutlineOpen}
        >
          <div className="ui-primary-button flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">课程蓝图</span>
              <span className="rounded-full bg-[var(--color-active)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
                {outlineStatusLabel}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">
              {activeOutline?.title ??
                (isOutlineLoading
                  ? "正在整理课程结构，不会打断当前对话"
                  : "查看结构、调整建议和开始学习入口")}
            </p>
          </div>
          <span className="flex-shrink-0 rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            查看
          </span>
        </button>
      </div>
    ) : null;

  const mobileOutlineSheet =
    isMobile && shouldShowOutlinePanel && isMobileOutlineOpen ? (
      <motion.div
        key="mobile-outline-sheet"
        className="fixed inset-0 z-50 md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="课程蓝图"
      >
        <motion.button
          type="button"
          aria-label="关闭课程蓝图"
          className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsMobileOutlineOpen(false)}
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="safe-bottom absolute inset-x-0 bottom-0 h-[min(82dvh,720px)] overflow-hidden rounded-t-[30px] bg-white shadow-[var(--shadow-floating-panel)]"
        >
          <button
            type="button"
            onClick={() => setIsMobileOutlineOpen(false)}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
            aria-label="关闭课程蓝图"
          >
            <X className="h-4 w-4" />
          </button>
          <OutlinePanel
            outline={displayOutline ?? stableOutline}
            stableOutline={stableOutline ?? null}
            actionOptions={outlineActions}
            isLoading={isOutlineLoading}
            courseId={courseId ?? undefined}
            onCourseCreated={setCourseId}
            onSelectAction={(option) => {
              setIsMobileOutlineOpen(false);
              sendMessage({ text: option.action || option.label });
            }}
          />
        </motion.div>
      </motion.div>
    ) : null;

  const chatViewport = (
    <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto max-w-[calc(100vw-32px)] space-y-4 md:max-w-[var(--message-max-width)]">
        <AIDegradationBanner kind={aiDegradedKind} />

        {chatMessages.length === 0 && !isLoading && !started && (
          <div className="py-14 text-center md:py-16">
            <WorkspaceEmptyState
              icon={GraduationCap}
              title="你想学什么？"
              description="告诉我你想学什么，我会先聊清楚目标、基础和约束，再生成可确认的课程蓝图。"
              footer={
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "补齐 React 工程化",
                    "三个月做数据分析",
                    "考研数学周计划",
                    "梳理面试准备路线",
                  ].map((example) => (
                    <PromptChip
                      key={example}
                      label={example}
                      onClick={() => {
                        setStarted(true);
                        void sendMessage({ text: example });
                      }}
                    />
                  ))}
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
  );

  const composer = (
    <div className="safe-bottom shrink-0 bg-white px-4 pb-5 pt-4 md:px-6 md:pb-6 md:pt-4">
      <div className="mx-auto max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)]">
        <div className="ui-input-shell flex items-end gap-2 rounded-2xl p-2 md:gap-3 md:p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={shouldShowOutlinePanel ? "继续调整蓝图..." : "继续对话..."}
            rows={1}
            className="flex-1 min-h-[24px] max-h-[120px] resize-none border-none bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors",
              input.trim() && !isLoading
                ? "ui-primary-button"
                : "cursor-not-allowed bg-[var(--color-active)] text-[var(--color-text-muted)]",
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
  );

  return (
    <div className="ui-page-shell flex h-dvh min-h-0 overflow-hidden">
      {!isMobile ? (
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
                  outline={displayOutline ?? stableOutline}
                  stableOutline={stableOutline ?? null}
                  actionOptions={outlineActions}
                  isLoading={isOutlineLoading}
                  courseId={courseId ?? undefined}
                  onCourseCreated={setCourseId}
                  onSelectAction={(option) => sendMessage({ text: option.action || option.label })}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : null}

      <motion.div
        variants={mainContentVariants}
        initial="full"
        animate={!isMobile && shouldShowOutlinePanel ? "withPanel" : "full"}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white"
      >
        <header className="ui-page-frame safe-top flex shrink-0 items-center gap-4 pb-4 pt-5 md:pb-5 md:pt-6">
          <Link
            href="/"
            className="ui-control-surface rounded-xl p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="ui-primary-button flex h-10 w-10 items-center justify-center rounded-xl">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-[var(--color-text)]">课程访谈</h1>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {interviewCompleted
                  ? "蓝图已生成"
                  : shouldShowOutlinePanel
                    ? "正在整理课程蓝图"
                    : "边聊边收束课程方向"}
              </p>
            </div>
          </div>
        </header>

        {chatViewport}
        {mobileOutlineDock}
        <AnimatePresence>{mobileOutlineSheet}</AnimatePresence>

        {composer}
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
