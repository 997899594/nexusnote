"use client";

import type { UIMessage } from "ai";
import { motion } from "framer-motion";
import { ArrowLeft, GraduationCap, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage, LoadingDots } from "@/components/chat/ChatMessage";
import { useInterview } from "@/hooks/useInterview";
import { cn } from "@/lib/utils";

export default function InterviewPage() {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get("msg");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);

  const interview = useInterview({
    initialMessage: initialMessage || undefined,
  });

  // 标记是否已开始（有初始消息或用户发送了消息）
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
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b border-zinc-100">
        <Link
          href="/chat"
          className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          aria-label="返回聊天"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-500" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-zinc-800">课程访谈</h1>
            <p className="text-xs text-zinc-400">告诉我你想学什么</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mobile-scroll px-4 md:px-6 py-4">
        <div className="max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)] mx-auto space-y-4">
          {/* 空状态：没有消息、不在加载、没有初始消息 */}
          {chatMessages.length === 0 && !isLoading && !started && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-lg font-medium text-zinc-700 mb-2">你想学什么？</h2>
              <p className="text-sm text-zinc-400 mb-6">告诉我你的学习目标，我会为你定制课程</p>
              <div className="flex flex-wrap justify-center gap-2">
                {["我想学 Python", "我想学做 PPT", "考研数学怎么准备", "教我做川菜"].map(
                  (example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setStarted(true);
                        sendMessage({ text: example });
                      }}
                      className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-full text-sm text-zinc-600 transition-colors"
                    >
                      {example}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {chatMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onSendReply={(text) => sendMessage({ text })} />
          ))}

          {isAILoading && <LoadingDots />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-100 bg-white px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)] mx-auto">
          <div className="flex items-end gap-2 md:gap-3 bg-zinc-50 rounded-2xl p-2 md:p-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="继续对话..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-800 placeholder:text-zinc-400 resize-none min-h-[24px] max-h-[120px]"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0",
                input.trim() && !isLoading
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed",
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
    </div>
  );
}
