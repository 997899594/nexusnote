"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion } from "framer-motion";
import { BookOpen, Loader2, MessageSquare, NotebookPen, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage, LoadingDots } from "@/components/chat/ChatMessage";
import { WorkspaceEmptyState } from "@/components/common";
import { useToast } from "@/components/ui/Toast";
import { isUnauthorizedError, parseApiError, redirectToLogin } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

interface LearnChatProps {
  courseId: string;
  courseTitle: string;
  variant?: "inline" | "overlay";
}

export function LearnChat({ courseId, courseTitle, variant = "inline" }: LearnChatProps) {
  const { addToast } = useToast();
  const { currentChapterIndex, chapters, isChatOpen, setChatOpen } = useLearnStore();
  const [input, setInput] = useState("");
  const [isCapturingChat, setIsCapturingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentChapter = chapters[currentChapterIndex];
  const sessionId = `learn-${courseId}-ch${currentChapterIndex}`;

  const transport = new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({
      sessionId,
      metadata: {
        courseId,
        chapterIndex: currentChapterIndex,
        context: "learn",
      },
    }),
  });

  const chat = useChat({
    id: sessionId,
    transport,
    onError: (error) => {
      console.error("[LearnChat] Error:", error);
      parseApiError(error).then(({ message, status, code }) => {
        if (isUnauthorizedError(status, code)) {
          redirectToLogin();
          return;
        }
        addToast(message, "error");
      });
    },
  });

  const { messages, sendMessage, status } = chat;
  const isLoading = status === "submitted" || status === "streaming";
  const chatMessages = messages.filter((m: UIMessage) => m.role !== "system");

  const getMessageText = useCallback((message: UIMessage) => {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
  }, []);

  // Auto-scroll
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
    (status === "submitted" || status === "streaming") && (!lastMsg || lastMsg.role === "user");
  const captureDisabled = isLoading || isCapturingChat || chatMessages.length === 0;

  if (!isChatOpen) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        type="button"
        onClick={() => setChatOpen(true)}
        className={cn(
          "fixed right-6 bottom-6 z-50",
          "w-12 h-12 rounded-full shadow-lg",
          "bg-[#111827] text-white",
          "flex items-center justify-center",
          "transition-colors hover:bg-zinc-800",
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef1f5]">
              <BookOpen className="w-4 h-4 text-[#111827]" />
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
                  : "bg-[#eef1f5] text-[#111827] hover:bg-[#e4e8ee]",
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
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto bg-white px-4 py-4">
          {chatMessages.length === 0 && !isLoading && (
            <WorkspaceEmptyState
              icon={MessageSquare}
              eyebrow="Chapter Chat"
              title="围绕当前章节继续追问"
              description="可以让我解释概念、举例、对比知识点，或者把当前理解沉淀成笔记。"
              className="py-8"
            />
          )}
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

        {/* Input */}
        <div className="safe-bottom bg-white px-4 pb-3 pt-2">
          <div className="flex items-end gap-2 rounded-[20px] border border-black/5 bg-[#f7f8fa] p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="针对本章节提问..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 placeholder:text-zinc-400 resize-none min-h-[24px] max-h-[80px]"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
                input.trim() && !isLoading
                  ? "bg-[#111827] text-white"
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
      animate={{ width: 420, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-shrink-0 flex-col overflow-hidden rounded-[32px] border border-black/5 bg-[#f6f7f9] shadow-[0_24px_56px_-42px_rgba(15,23,42,0.18)]"
    >
      {/* Header */}
      <div className="border-b border-black/5 bg-white/92 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef1f5]">
              <BookOpen className="h-4 w-4 text-[#111827]" />
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
                  : "bg-[#eef1f5] text-[#111827] hover:bg-[#e4e8ee]",
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
              className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5">
        {chatMessages.length === 0 && !isLoading && (
          <WorkspaceEmptyState
            icon={MessageSquare}
            eyebrow="Chapter Chat"
            title="围绕当前章节继续追问"
            description="可以让我解释概念、举例、对比知识点，或者把当前理解沉淀成笔记。"
            className="py-8"
          />
        )}

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

      {/* Input */}
      <div className="border-t border-black/5 bg-white px-5 py-4">
        <div className="flex items-end gap-2 rounded-[20px] border border-black/5 bg-[#f7f8fa] p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="针对本章节提问..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 placeholder:text-zinc-400 resize-none min-h-[24px] max-h-[80px]"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
              input.trim() && !isLoading
                ? "bg-[#111827] text-white"
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
