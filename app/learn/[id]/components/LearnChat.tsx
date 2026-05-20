"use client";

import type { UIMessage } from "ai";
import { Loader2, NotebookPen, Send, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage, LoadingDots } from "@/components/chat/ChatMessage";
import { useChatSession } from "@/components/chat/useChatSession";
import { AIDegradationBanner } from "@/components/common";
import { useToast } from "@/components/ui/Toast";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { isUnauthorizedError, parseApiError, redirectToLogin } from "@/lib/api/client";
import { buildLearnQuickPrompts } from "@/lib/learning/alignment";
import { cn } from "@/lib/utils";
import { useChatSessionStateStore } from "@/stores/chat-session-state";
import { useLearnStore } from "@/stores/learn";

interface LearnChatProps {
  courseId: string;
  courseTitle: string;
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

export function LearnChat({ courseId, courseTitle }: LearnChatProps) {
  const { addToast } = useToast();
  const { currentChapterIndex, currentSectionIndex, chapters, setChatOpen } = useLearnStore();
  const [input, setInput] = useState("");
  const [isCapturingChat, setIsCapturingChat] = useState(false);
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(null);
  const [isResolvingSession, setIsResolvingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentChapter = chapters[currentChapterIndex];
  const currentSection = currentChapter?.sections[currentSectionIndex];
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

  // Auto-scroll
  useEffect(() => {
    if (chatMessages.length === 0 && !isLoading) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, isLoading]);

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

  const handleSubmit = async () => {
    if (!input.trim() || isLoading || !resolvedSessionId) return;
    await sendMessage({ text: input.trim() });
    setInput("");
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
    if (isCapturingChat) {
      return;
    }

    const captureMessages = chatMessages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        text: getMessageText(message),
      }))
      .filter((message) => message.text.length > 0);

    if (captureMessages.length === 0) {
      addToast("当前没有可保存的对话内容", "warning");
      return;
    }

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
        throw new Error("保存失败");
      }

      await response.json();
      addToast("学习对话已保存到笔记", "success");
    } catch {
      addToast("保存失败，请稍后重试", "error");
    } finally {
      setIsCapturingChat(false);
    }
  }, [
    addToast,
    chatMessages,
    courseId,
    currentChapterIndex,
    currentSectionIndex,
    getMessageText,
    isCapturingChat,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const lastMsg = chatMessages[chatMessages.length - 1];
  const isAILoading =
    !isResolvingSession &&
    (status === "submitted" || status === "streaming") &&
    (!lastMsg || lastMsg.role === "user");
  const captureDisabled =
    isLoading || isCapturingChat || chatMessages.length === 0 || !resolvedSessionId;

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
          <div className="min-w-0">
            <div className="text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
              教练
            </div>
            <p className="truncate text-xs text-[var(--color-text-secondary)]">
              {currentSection?.title ?? currentChapter?.title ?? courseTitle}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCaptureChat}
              disabled={captureDisabled}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-colors md:px-3 md:py-2",
                captureDisabled
                  ? "cursor-not-allowed bg-[var(--color-active)] text-[var(--color-text-muted)]"
                  : "border border-black/8 bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
              )}
            >
              {isCapturingChat ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <NotebookPen className="h-3.5 w-3.5" />
              )}
              <span>保存</span>
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

          {chatMessages.length === 0 && !isAILoading && renderEmptyState()}

          {chatMessages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onSendReply={(text) => sendMessage({ text })}
              variant="learning"
            />
          ))}

          {isAILoading && <LoadingDots variant="learning" />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="safe-bottom border-t border-black/[0.04] bg-white/84 px-4 pb-4 pt-3 backdrop-blur-xl md:px-5 md:pb-5 md:pt-4">
        <div className="ui-input-shell flex items-end gap-2 rounded-[20px] p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sessionError ? "学习对话暂不可用" : "针对这一节提问..."}
            rows={1}
            className="flex-1 min-h-[24px] max-h-[80px] resize-none border-none bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
            disabled={!resolvedSessionId || isResolvingSession || !!sessionError}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading || !resolvedSessionId || !!sessionError}
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
              input.trim() && !isLoading && resolvedSessionId && !sessionError
                ? "ui-primary-button"
                : "cursor-not-allowed bg-[var(--color-active)] text-[var(--color-text-muted)]",
            )}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
