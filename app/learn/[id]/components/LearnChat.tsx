"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion } from "framer-motion";
import { BookOpen, Loader2, MessageSquare, NotebookPen, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage, LoadingDots } from "@/components/chat/ChatMessage";
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
  const chapterTitle = currentChapter?.title ?? `第 ${currentChapterIndex + 1} 章`;

  const transport = new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({
      sessionId,
      metadata: {
        courseId,
        courseTitle,
        chapterIndex: currentChapterIndex,
        chapterTitle,
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
          courseTitle,
          chapterIndex: currentChapterIndex,
          chapterTitle,
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
  }, [
    addToast,
    chatMessages,
    courseId,
    courseTitle,
    chapterTitle,
    currentChapterIndex,
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
          "fixed right-6 bottom-20 z-50",
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
        <div className="flex items-center justify-between bg-white px-4 py-3 shadow-[0_16px_38px_-34px_rgba(15,23,42,0.12)]">
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
            <div className="text-center py-8 text-zinc-400 text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>有什么不明白的？随时问我</p>
            </div>
          )}
          {chatMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onSendReply={(text) => sendMessage({ text })} />
          ))}
          {isAILoading && <LoadingDots />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white px-4 py-3">
          <div className="flex items-end gap-2 rounded-xl bg-[#f7f8fa] p-2">
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
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0",
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
      animate={{ width: 400, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-shrink-0 flex-col overflow-hidden bg-[#f6f7f9]"
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow-[0_16px_38px_-34px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef1f5]">
            <BookOpen className="w-4 h-4 text-[#111827]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 truncate">AI 学习助手</h3>
            <p className="text-xs text-zinc-500 truncate">{currentChapter?.title ?? courseTitle}</p>
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
          <div className="text-center py-8 text-zinc-400 text-sm">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>有什么不明白的？随时问我</p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} onSendReply={(text) => sendMessage({ text })} />
        ))}

        {isAILoading && <LoadingDots />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white px-4 py-3">
        <div className="flex items-end gap-2 rounded-xl bg-[#f7f8fa] p-2">
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
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0",
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
