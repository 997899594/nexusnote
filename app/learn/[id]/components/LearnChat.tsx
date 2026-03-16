"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion } from "framer-motion";
import { BookOpen, Loader2, MessageSquare, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage, LoadingDots } from "@/components/chat/ChatMessage";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";

interface LearnChatProps {
  courseId: string;
  courseTitle: string;
}

export function LearnChat({ courseId, courseTitle }: LearnChatProps) {
  const { addToast } = useToast();
  const { currentChapterIndex, chapters, isChatOpen, setChatOpen } = useLearnStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentChapter = chapters[currentChapterIndex];
  const sessionId = `learn-${courseId}-ch${currentChapterIndex}`;

  const transport = new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({
      sessionId,
      metadata: {
        courseId,
        courseTitle,
        chapterIndex: currentChapterIndex,
        chapterTitle: currentChapter?.title,
        context: "learn",
      },
    }),
  });

  const chat = useChat({
    id: sessionId,
    transport,
    onError: (error) => {
      console.error("[LearnChat] Error:", error);
      parseApiError(error).then(({ message }) => {
        addToast(message, "error");
      });
    },
  });

  const { messages, sendMessage, status } = chat;
  const isLoading = status === "submitted" || status === "streaming";
  const chatMessages = messages.filter((m: UIMessage) => m.role !== "system");

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const lastMsg = chatMessages[chatMessages.length - 1];
  const isAILoading =
    (status === "submitted" || status === "streaming") && (!lastMsg || lastMsg.role === "user");

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
          "bg-[var(--color-accent)] text-white",
          "flex items-center justify-center",
          "hover:bg-[var(--color-accent-hover)] transition-colors",
        )}
      >
        <MessageSquare className="w-5 h-5" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 400, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full bg-[var(--color-bg)] flex-shrink-0 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 truncate">AI 学习助手</h3>
            <p className="text-xs text-zinc-500 truncate">{currentChapter?.title ?? courseTitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setChatOpen(false)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
      <div className="px-4 py-3">
        <div className="flex items-end gap-2 bg-zinc-50 rounded-xl p-2">
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
                ? "bg-[var(--color-accent)] text-white"
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
