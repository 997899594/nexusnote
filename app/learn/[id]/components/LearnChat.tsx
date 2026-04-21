"use client";

import type { UIMessage } from "ai";
import { motion } from "framer-motion";
import { BookOpen, Loader2, MessageSquare, NotebookPen, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage, LoadingDots } from "@/components/chat/ChatMessage";
import { useChatSession } from "@/components/chat/useChatSession";
import { AIDegradationBanner, WorkspaceEmptyState } from "@/components/common";
import { useToast } from "@/components/ui/Toast";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { isUnauthorizedError, parseApiError, redirectToLogin } from "@/lib/api/client";
import type { GrowthFocusSummary, GrowthInsightSummary } from "@/lib/growth/projection-types";
import { buildLearnQuickPrompts } from "@/lib/learning/alignment";
import { cn } from "@/lib/utils";
import { useChatSessionStateStore } from "@/stores/chat-session-state";
import { useLearnStore } from "@/stores/learn";

interface LearnChatProps {
  courseId: string;
  courseTitle: string;
  growthFocus: GrowthFocusSummary | null;
  insights: GrowthInsightSummary[];
  variant?: "inline" | "overlay";
}

export function LearnChat({
  courseId,
  courseTitle,
  growthFocus,
  insights,
  variant = "inline",
}: LearnChatProps) {
  const { addToast } = useToast();
  const { currentChapterIndex, chapters, isChatOpen, setChatOpen } = useLearnStore();
  const [input, setInput] = useState("");
  const [isCapturingChat, setIsCapturingChat] = useState(false);
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(null);
  const [isResolvingSession, setIsResolvingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentChapter = chapters[currentChapterIndex];
  const quickPrompts = useMemo(
    () =>
      buildLearnQuickPrompts({
        chapterTitle: currentChapter?.title,
        growthFocus,
        insights,
      }),
    [currentChapter?.title, growthFocus, insights],
  );

  const resetTrackedSession = useChatSessionStateStore((state) => state.resetSession);
  const chat = useChatSession({
    sessionId: resolvedSessionId,
    body: {
      metadata: {
        courseId,
        chapterIndex: currentChapterIndex,
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
      addToast("当前没有可沉淀的对话内容", "warning");
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
          messages: captureMessages,
        }),
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error("沉淀失败");
      }

      await response.json();
      addToast("学习对话已沉淀到笔记", "success");
    } catch {
      addToast("沉淀失败，请稍后重试", "error");
    } finally {
      setIsCapturingChat(false);
    }
  }, [addToast, chatMessages, courseId, currentChapterIndex, getMessageText, isCapturingChat]);

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
          可直接提问
        </div>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void handleQuickPrompt(prompt)}
              className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  const shouldShowPinnedContext = variant === "overlay" || chatMessages.length === 0;
  const pinnedContextArea =
    shouldShowPinnedContext && chatMessages.length === 0 ? <div>{quickPromptBlock}</div> : null;

  const renderEmptyState = () => {
    if (isResolvingSession) {
      return (
        <WorkspaceEmptyState
          icon={Loader2}
          eyebrow="Chapter Thread"
          title="正在恢复本章对话"
          description="正在定位本章节的历史线程并恢复消息。"
          className="mt-3 py-10"
        />
      );
    }

    if (sessionError) {
      return (
        <div className="mt-3 flex flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-black/10 bg-[#fafafa] px-5 py-10 text-center">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900">学习对话暂时不可用</p>
            <p className="text-xs leading-5 text-zinc-500">{sessionError}</p>
          </div>
          <button
            type="button"
            onClick={() => void resolveLearnSession()}
            className="rounded-xl bg-[#111827] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
          >
            重试
          </button>
        </div>
      );
    }

    return (
      <WorkspaceEmptyState
        icon={MessageSquare}
        eyebrow="Chapter Chat"
        title="围绕当前章节继续追问"
        description="可以让我解释概念、举例、对比知识点，或者把当前理解沉淀成笔记。"
        className="mt-3 py-10"
      />
    );
  };

  if (!isChatOpen) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        type="button"
        onClick={() => setChatOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 safe-bottom",
          "w-12 h-12 rounded-full shadow-lg",
          "border border-black/8 bg-[#111827] text-white shadow-[0_18px_36px_-20px_rgba(15,23,42,0.38)]",
          "flex items-center justify-center",
          "transition-transform hover:scale-[1.02]",
        )}
      >
        <MessageSquare className="w-5 h-5" />
      </motion.button>
    );
  }

  if (variant === "overlay") {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-[#f6f7f9]">
        {/* Header */}
        <div className="safe-top flex items-center justify-between bg-white/92 px-4 pb-3 pt-3 backdrop-blur-xl shadow-[0_16px_38px_-34px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/8 bg-[#f6f8fb]">
              <BookOpen className="w-4 h-4 text-[var(--color-text-secondary)]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-zinc-900 truncate">AI 学习助手</h3>
              <p className="text-xs text-zinc-500 truncate">
                {currentChapter?.title ?? courseTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCaptureChat}
              disabled={captureDisabled}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                captureDisabled
                  ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
                  : "border border-black/8 bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
              )}
            >
              {isCapturingChat ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <NotebookPen className="h-3.5 w-3.5" />
              )}
              <span>沉淀对话</span>
            </button>

            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded-lg border border-black/8 bg-white p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="bg-white/92 px-4 pb-3">{pinnedContextArea}</div>

        {/* Messages */}
        <div className="mobile-scroll flex-1 overflow-y-auto bg-white px-4 pb-8 pt-5">
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
        <div className="safe-bottom border-t border-black/5 bg-white px-4 pb-4 pt-3">
          <div className="flex items-end gap-2 rounded-[20px] border border-black/8 bg-[#f7f8fa] p-2 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.12)] focus-within:border-black/15 focus-within:bg-white focus-within:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.16)]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionError ? "当前章节对话暂不可用" : "针对本章节提问..."}
              rows={1}
              className="flex-1 min-h-[24px] max-h-[80px] resize-none border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              disabled={!resolvedSessionId || isResolvingSession || !!sessionError}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading || !resolvedSessionId || !!sessionError}
              className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
                input.trim() && !isLoading && resolvedSessionId && !sessionError
                  ? "bg-[#111827] text-white shadow-[0_14px_26px_-18px_rgba(15,23,42,0.3)]"
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed",
              )}
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 432, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-shrink-0 flex-col overflow-hidden rounded-[32px] border border-black/5 bg-[#f6f7f9] shadow-[0_24px_56px_-42px_rgba(15,23,42,0.18)]"
    >
      {/* Header */}
      <div className="border-b border-black/5 bg-white/92 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/8 bg-[#f6f8fb]">
              <BookOpen className="h-4 w-4 text-[var(--color-text-secondary)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                Chapter Assistant
              </div>
              <h3 className="truncate text-sm font-semibold text-zinc-900">AI 学习助手</h3>
              <p className="truncate text-xs text-zinc-500">
                {currentChapter?.title ?? courseTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCaptureChat}
              disabled={captureDisabled}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-colors",
                captureDisabled
                  ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
                  : "border border-black/8 bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
              )}
            >
              {isCapturingChat ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <NotebookPen className="h-3.5 w-3.5" />
              )}
              <span>沉淀对话</span>
            </button>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="rounded-xl border border-black/8 bg-white p-2 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="bg-white/92 px-5 pb-4">{pinnedContextArea}</div>
      </div>

      {/* Messages */}
      <div className="mobile-scroll flex-1 overflow-y-auto bg-white px-5 pb-10 pt-6">
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
      <div className="border-t border-black/5 bg-white px-5 pb-5 pt-4">
        <div className="flex items-end gap-2 rounded-[20px] border border-black/8 bg-[#f7f8fa] p-2 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.12)] focus-within:border-black/15 focus-within:bg-white focus-within:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.16)]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sessionError ? "当前章节对话暂不可用" : "针对本章节提问..."}
            rows={1}
            className="flex-1 min-h-[24px] max-h-[80px] resize-none border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            disabled={!resolvedSessionId || isResolvingSession || !!sessionError}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading || !resolvedSessionId || !!sessionError}
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
              input.trim() && !isLoading && resolvedSessionId && !sessionError
                ? "bg-[#111827] text-white shadow-[0_14px_26px_-18px_rgba(15,23,42,0.3)]"
                : "bg-zinc-200 text-zinc-400 cursor-not-allowed",
            )}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
