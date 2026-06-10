"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, Loader2, Play } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ChatComposer, type ChatComposerSubmitPayload } from "@/components/chat/ChatComposer";
import { LoadingDots } from "@/components/chat/ChatMessage";
import { AIDegradationBanner, PromptChip, WorkspaceEmptyState } from "@/components/common";
import { InterviewMessage } from "@/components/interview/InterviewMessage";
import { OutlinePanel } from "@/components/interview/OutlinePanel";
import { AppBackLink } from "@/components/shared/layout";
import { useInterview } from "@/hooks/useInterview";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useStartCourseFromOutline } from "@/hooks/useStartCourseFromOutline";
import type { OutlineDisplay } from "@/lib/ai/interview/models";
import { PAGE_BACK_TARGETS } from "@/lib/navigation/app-navigation";

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

type MobileInterviewView = "chat" | "outline";

function OutlineInlineCard({
  outline,
  canStart,
  isLoading,
  isStarting,
  startStatus,
  onOpen,
  onStart,
}: {
  outline: OutlineDisplay;
  canStart: boolean;
  isLoading: boolean;
  isStarting: boolean;
  startStatus: string | null;
  onOpen: () => void;
  onStart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="w-full max-w-[var(--message-max-width)] rounded-[28px] border border-black/[0.06] bg-white px-4 py-4 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.4)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
              蓝图
            </div>
            <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-tight tracking-[-0.04em] text-[var(--color-text)]">
              {outline.title}
            </h2>
          </div>
          {isLoading ? (
            <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-[var(--color-text-tertiary)]" />
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          {outline.chapters.slice(0, 3).map((chapter, index) => (
            <div key={`${chapter.title}-${index}`} className="flex items-center gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-panel-soft)] text-xs font-semibold text-[var(--color-text-secondary)]">
                {index + 1}
              </span>
              <span className="min-w-0 truncate font-medium text-[var(--color-text-secondary)]">
                {chapter.title}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart || isStarting || isLoading}
            className="ui-primary-button inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isStarting ? startStatus || "生成中" : "开始学习"}
          </button>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-[var(--color-panel-soft)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
          >
            查看结构
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function InterviewContent() {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get("msg");
  const isMobile = useIsMobile();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [mobileView, setMobileView] = useState<MobileInterviewView>("chat");

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
  const researchEvidence = interview.outline.researchEvidence;
  const outlineActions = interview.outline.actions;
  const isOutlineLoading = interview.outline.isLoading;
  const interviewCompleted = interview.outline.isReady;
  const courseId = interview.course.id;

  const chatMessages = messages;

  useEffect(() => {
    if (chatMessages.length === 0 && !isLoading) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, isLoading]);

  const handleComposerSubmit = async ({ text }: ChatComposerSubmitPayload) => {
    await sendMessage({ text });
  };

  const lastMsg = chatMessages[chatMessages.length - 1];
  const isAILoading =
    (status === "submitted" || status === "streaming") && (!lastMsg || lastMsg.role === "user");
  const activeOutline = displayOutline ?? stableOutline;
  const shouldShowOutlinePanel = Boolean(activeOutline) || interviewCompleted;
  const { canStartLearning, isStarting, startStatus, startCourse } = useStartCourseFromOutline({
    outline: stableOutline,
    courseId,
  });

  useEffect(() => {
    if (!isMobile || !shouldShowOutlinePanel) {
      setMobileView("chat");
    }
  }, [isMobile, shouldShowOutlinePanel]);

  const handleSelectOutlineAction = (option: (typeof outlineActions)[number]) => {
    if (isMobile) {
      setMobileView("chat");
    }
    void sendMessage({ text: option.action || option.label });
  };

  const mobileOutlineView =
    isMobile && shouldShowOutlinePanel ? (
      <div className="min-h-0 flex-1">
        <OutlinePanel
          outline={displayOutline ?? stableOutline}
          stableOutline={stableOutline ?? null}
          researchEvidence={researchEvidence}
          actionOptions={outlineActions}
          isLoading={isOutlineLoading}
          courseId={courseId ?? undefined}
          onSelectAction={handleSelectOutlineAction}
          headerAction={
            <button
              type="button"
              onClick={() => setMobileView("chat")}
              className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]"
            >
              回到对话
            </button>
          }
        />
      </div>
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

        {isMobile && activeOutline && mobileView === "chat" ? (
          <OutlineInlineCard
            outline={activeOutline}
            canStart={canStartLearning}
            isLoading={isOutlineLoading}
            isStarting={isStarting}
            startStatus={startStatus}
            onOpen={() => setMobileView("outline")}
            onStart={() => void startCourse()}
          />
        ) : null}

        {isAILoading && <LoadingDots />}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );

  const composer = (
    <div className="safe-bottom shrink-0 bg-white px-4 pb-5 pt-4 md:px-6 md:pb-6 md:pt-4">
      <div className="mx-auto max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)]">
        <ChatComposer
          value={input}
          onValueChange={setInput}
          onSubmit={handleComposerSubmit}
          onSubmitError={(error) => {
            console.error("[Interview] send failed", error);
          }}
          placeholder={shouldShowOutlinePanel ? "继续调整蓝图..." : "继续对话..."}
          isLoading={isLoading}
          className="rounded-2xl md:p-3"
          inputRowClassName="md:gap-3"
          textareaClassName="max-h-[120px]"
          submitButtonClassName="rounded-full"
        />
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
                  researchEvidence={researchEvidence}
                  actionOptions={outlineActions}
                  isLoading={isOutlineLoading}
                  courseId={courseId ?? undefined}
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
          <AppBackLink
            target={PAGE_BACK_TARGETS.interview}
            className="ui-control-surface rounded-xl"
          />
          <div className="flex items-center gap-3">
            <div className="ui-primary-button flex h-10 w-10 items-center justify-center rounded-xl">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-[var(--color-text)]">课程访谈</h1>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {isMobile && mobileView === "outline"
                  ? "查看结构并开始学习"
                  : interviewCompleted
                    ? "蓝图已生成"
                    : shouldShowOutlinePanel
                      ? "正在整理课程蓝图"
                      : "边聊边收束课程方向"}
              </p>
            </div>
          </div>
        </header>

        {isMobile && shouldShowOutlinePanel && mobileView === "outline"
          ? mobileOutlineView
          : chatViewport}

        {!isMobile || mobileView === "chat" ? composer : null}
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
