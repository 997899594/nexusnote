"use client";

import type { UIMessage } from "ai";
import { Loader2, MessageSquareQuote, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer, type ChatComposerSubmitPayload } from "@/components/chat/ChatComposer";
import { useChatSession } from "@/components/chat/useChatSession";
import { AIDegradationBanner } from "@/components/common";
import { useToast } from "@/components/ui/Toast";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { isUnauthorizedError, parseApiError, redirectToLogin } from "@/lib/api/client";
import { toChatDisplayMessages } from "@/lib/chat/message-ui";
import { buildLearnQuickPrompts } from "@/lib/learning/alignment";
import { cn } from "@/lib/utils";
import { useChatSessionStateStore } from "@/stores/chat-session-state";
import { useLearnStore } from "@/stores/learn";
import { LearnChatMessage } from "./LearnChatMessage";

interface LearnChatProps {
  courseId: string;
  courseTitle: string;
  onCollapse?: () => void;
}

function ChatEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mt-3 flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--color-text-secondary)]">
        {description}
      </p>
    </div>
  );
}

export function LearnChat({ courseId, courseTitle, onCollapse }: LearnChatProps) {
  const { addToast } = useToast();
  const {
    currentChapterIndex,
    currentSectionIndex,
    chapters,
    chatSelectionContext,
    setChatOpen,
    setChatSelectionContext,
  } = useLearnStore();
  const [input, setInput] = useState("");
  const [isCapturingChat, setIsCapturingChat] = useState(false);
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(null);
  const [isResolvingSession, setIsResolvingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isCapturingChatRef = useRef(false);

  const currentChapter = chapters[currentChapterIndex];
  const currentSection = currentChapter?.sections[currentSectionIndex];
  const chatContextTitle = currentSection?.title ?? currentChapter?.title ?? courseTitle;
  const chatContextMeta = currentSection
    ? currentChapter?.title
    : currentChapter
      ? courseTitle
      : null;
  const quickPrompts = useMemo(
    () =>
      buildLearnQuickPrompts({
        chapterTitle: currentChapter?.title,
        sectionTitle: currentSection?.title,
      }),
    [currentChapter?.title, currentSection?.title],
  );

  const resetTrackedSession = useChatSessionStateStore((state) => state.resetSession);
  const chat = useChatSession({
    sessionId: resolvedSessionId,
    body: {
      metadata: {
        courseId,
        chapterIndex: currentChapterIndex,
        sectionIndex: currentSectionIndex,
        context: "learn",
      },
    },
  });

  const { messages, sendMessage, setMessages, status, aiDegradedKind } = chat;
  const isLoading = status === "submitted" || status === "streaming" || isResolvingSession;
  const chatMessages = messages.filter((m: UIMessage) => m.role !== "system");

  const getMessageText = useCallback((message: UIMessage) => extractUIMessageText(message), []);

  const resolveLearnSession = useCallback(async () => {
    setIsResolvingSession(true);
    setSessionError(null);
    setResolvedSessionId(null);
    setMessages([]);
    setInput("");

    try {
      const query = new URLSearchParams({
        courseId,
        chapterIndex: String(currentChapterIndex),
      });
      const response = await fetch(`/api/learn/chat-session?${query.toString()}`);

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw response;
      }

      const data = (await response.json()) as {
        session?: {
          id?: string;
        };
      };

      if (!data.session?.id) {
        throw new Error("学习对话会话初始化失败");
      }

      resetTrackedSession(data.session.id);
      setResolvedSessionId(data.session.id);
    } catch (error) {
      console.error("[LearnChat] Failed to resolve session:", error);
      const { message, status, code } = await parseApiError(error);
      if (isUnauthorizedError(status, code)) {
        redirectToLogin();
        return;
      }
      setSessionError(message);
    } finally {
      setIsResolvingSession(false);
    }
  }, [courseId, currentChapterIndex, resetTrackedSession, setMessages]);

  useEffect(() => {
    void resolveLearnSession();
  }, [resolveLearnSession]);

  const handleComposerSubmit = async ({ text }: ChatComposerSubmitPayload) => {
    const selectionContext = chatSelectionContext;
    await sendMessage(
      { text },
      selectionContext
        ? {
            body: {
              metadata: {
                context: "learn",
                courseId,
                chapterIndex: selectionContext.chapterIndex,
                sectionIndex: selectionContext.sectionIndex,
              },
              learnSelectionContext: {
                text: selectionContext.text,
                chapterIndex: selectionContext.chapterIndex,
                sectionIndex: selectionContext.sectionIndex,
                chapterTitle: selectionContext.chapterTitle,
                sectionTitle: selectionContext.sectionTitle,
              },
            },
          }
        : undefined,
    );
    if (selectionContext?.id === useLearnStore.getState().chatSelectionContext?.id) {
      setChatSelectionContext(null);
    }
  };

  const handleQuickPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) {
        return;
      }

      if (isLoading || !resolvedSessionId) {
        setInput(prompt);
        return;
      }

      await sendMessage({ text: prompt });
      setInput("");
    },
    [isLoading, resolvedSessionId, sendMessage],
  );

  const handleCaptureChat = useCallback(async () => {
    if (isCapturingChatRef.current) {
      return;
    }

    const latestMessage = chatMessages[chatMessages.length - 1];
    const captureMessages = chatMessages
      .filter((message) => {
        if (message.role !== "user" && message.role !== "assistant") {
          return false;
        }

        return !(isLoading && message.role === "assistant" && message.id === latestMessage?.id);
      })
      .map((message) => ({
        role: message.role,
        text: getMessageText(message).slice(0, 20_000),
      }))
      .filter((message) => message.text.length > 0);

    if (captureMessages.length === 0) {
      addToast("当前没有可保存的对话内容", "warning");
      return;
    }

    isCapturingChatRef.current = true;
    setIsCapturingChat(true);

    try {
      const response = await fetch("/api/notes/capture-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          chapterIndex: currentChapterIndex,
          sectionIndex: currentSectionIndex,
          messages: captureMessages,
        }),
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        const { message } = await parseApiError(response);
        throw new Error(message);
      }

      await response.json();
      addToast("学习对话已保存到笔记", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "保存失败，请稍后重试", "error");
    } finally {
      isCapturingChatRef.current = false;
      setIsCapturingChat(false);
    }
  }, [
    addToast,
    chatMessages,
    courseId,
    currentChapterIndex,
    currentSectionIndex,
    getMessageText,
    isLoading,
  ]);

  const lastMsg = chatMessages[chatMessages.length - 1];
  const shouldAppendAssistantActivity =
    !isResolvingSession &&
    (status === "submitted" || status === "streaming") &&
    (!lastMsg || lastMsg.role === "user");
  const displayMessages = toChatDisplayMessages(chatMessages, {
    activeAssistantMessageId:
      !isResolvingSession && isLoading && lastMsg?.role === "assistant" ? lastMsg.id : null,
    appendAssistantActivity: shouldAppendAssistantActivity,
    assistantActivityId: "learn-assistant-activity",
  });
  const captureDisabled =
    isLoading || isCapturingChat || chatMessages.length === 0 || !resolvedSessionId;

  // Auto-scroll follows projected UI messages, including transient assistant activity.
  useEffect(() => {
    if (displayMessages.length === 0 && !isLoading) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length, isLoading]);

  const quickPromptBlock =
    quickPrompts.length > 0 ? (
      <div className="space-y-2 text-left">
        <div className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          建议问题
        </div>
        <div className="space-y-1.5">
          {quickPrompts.slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void handleQuickPrompt(prompt)}
              className="w-full rounded-2xl bg-[var(--color-panel-soft)] px-3 py-2 text-left text-xs leading-5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-active)] hover:text-[var(--color-text)]"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  const pinnedContextArea = chatMessages.length === 0 ? <div>{quickPromptBlock}</div> : null;
  const selectionContextPreview = chatSelectionContext?.text.replace(/\s+/g, " ").trim();

  const renderEmptyState = () => {
    if (isResolvingSession) {
      return (
        <ChatEmptyState
          icon={<Loader2 className="h-4 w-4 animate-spin" />}
          title="正在打开对话"
          description="稍等片刻。"
        />
      );
    }

    if (sessionError) {
      return (
        <div className="mt-3 flex flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-black/10 bg-[var(--color-panel-soft)] px-5 py-10 text-center">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--color-text)]">对话暂时不可用</p>
            <p className="text-xs leading-5 text-[var(--color-text-secondary)]">{sessionError}</p>
          </div>
          <button
            type="button"
            onClick={() => void resolveLearnSession()}
            className="ui-primary-button rounded-xl px-3 py-2 text-xs font-medium transition-colors"
          >
            重试
          </button>
        </div>
      );
    }

    return (
      <div className="px-1 py-2 text-xs leading-5 text-[var(--color-text-tertiary)]">
        围绕当前小节提问，回答会保留在这里。
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white/72">
      {/* Header */}
      <div className="safe-top border-b border-black/[0.04] bg-white/82 px-4 pb-3 pt-3 backdrop-blur-xl md:px-5 md:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--color-text)]">
              {chatContextTitle}
            </p>
            {chatContextMeta ? (
              <p className="mt-0.5 truncate text-[0.6875rem] text-[var(--color-text-tertiary)]">
                {chatContextMeta}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCaptureChat}
              disabled={captureDisabled}
              className={cn(
                "inline-flex h-9 min-w-14 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors",
                captureDisabled
                  ? "cursor-not-allowed bg-[var(--color-active)] text-[var(--color-text-muted)]"
                  : "border border-black/8 bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
              )}
            >
              {isCapturingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>保存</span>
            </button>
            <button
              type="button"
              onClick={onCollapse}
              className="hidden h-9 min-w-14 shrink-0 whitespace-nowrap rounded-full border border-black/8 bg-white px-3 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] md:inline-flex md:items-center md:justify-center"
              aria-label="收起提问"
            >
              收起
            </button>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded-xl border border-black/8 bg-white p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {pinnedContextArea ? <div className="mt-4">{pinnedContextArea}</div> : null}
      </div>

      {/* Messages */}
      <div className="mobile-scroll flex-1 overflow-y-auto bg-transparent px-4 pb-8 pt-5 md:px-5 md:pb-10 md:pt-6">
        <div className="space-y-4">
          <AIDegradationBanner kind={aiDegradedKind} className="mb-4" />

          {displayMessages.length === 0 && !isLoading && renderEmptyState()}

          {displayMessages.map((msg) => (
            <LearnChatMessage key={msg.id} message={msg} />
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="safe-bottom border-t border-black/[0.04] bg-white/84 px-4 pb-4 pt-3 backdrop-blur-xl md:px-5 md:pb-5 md:pt-4">
        {chatSelectionContext && selectionContextPreview ? (
          <div className="mb-2 rounded-2xl border border-black/[0.06] bg-[var(--color-panel-soft)] px-3 py-2">
            <div className="flex items-start gap-2">
              <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                    引用划线
                  </p>
                  <button
                    type="button"
                    onClick={() => setChatSelectionContext(null)}
                    className="rounded-md p-0.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-white/70 hover:text-[var(--color-text)]"
                    aria-label="取消引用"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                  “{selectionContextPreview}”
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <ChatComposer
          value={input}
          onValueChange={setInput}
          onSubmit={handleComposerSubmit}
          onSubmitError={(error) => {
            console.error("[LearnChat] send failed", error);
          }}
          placeholder={
            sessionError
              ? "学习对话暂不可用"
              : chatSelectionContext
                ? "针对这段提问..."
                : "针对这一节提问..."
          }
          isLoading={isLoading}
          inputDisabled={!resolvedSessionId || isResolvingSession || !!sessionError}
          submitDisabled={!resolvedSessionId || !!sessionError}
          maxHeightPx={80}
          textareaClassName="max-h-[80px]"
          submitIconClassName="h-3.5 w-3.5"
        />
      </div>
    </div>
  );
}
