"use client";

import type { UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AIDegradationBanner, WorkspaceEmptyState } from "@/components/common";
import { useInputProtection } from "@/components/common/useInputProtection";
import { CHAT_COMMANDS, extractCommandContent } from "@/lib/chat/commands";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores";
import type { Command } from "@/types/chat";
import { ChatMessage, LoadingDots } from "./ChatMessage";
import { CommandMenu } from "./CommandMenu";
import { useChatSession } from "./useChatSession";

interface ChatPanelProps {
  sessionId: string | null;
  pendingMessage?: string | null;
}

export function ChatPanel({ sessionId, pendingMessage }: ChatPanelProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);

  const chat = useChatSession({
    sessionId,
    pendingMessage: pendingMessage || undefined,
  });

  const messages = chat.messages;
  const sendMessage = chat.sendMessage;
  const status = chat.status;
  const aiDegradedKind = chat.aiDegradedKind;
  // AI SDK v6: isLoading is derived from status
  const isLoading = status === "submitted" || status === "streaming";
  const { handlePaste } = useInputProtection();

  const chatMessages = messages.filter((m: UIMessage) => m.role !== "system");

  useEffect(() => {
    if (chatMessages.length === 0 && !isLoading) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, isLoading]);

  // 同步消息到 store，供索引使用
  const setCurrentSessionMessages = useChatStore((s) => s.setCurrentSessionMessages);
  useEffect(() => {
    setCurrentSessionMessages(chatMessages);
    return () => setCurrentSessionMessages(null);
  }, [chatMessages, setCurrentSessionMessages]);

  const filteredCommands = (() => {
    if (!input.startsWith("/")) return CHAT_COMMANDS;
    const query = input.slice(1).trim().toLowerCase();
    if (!query) return CHAT_COMMANDS;
    return CHAT_COMMANDS.filter((c) => c.label.toLowerCase().includes(query));
  })();

  useEffect(() => {
    if (selectedCommand) {
      setShowCommands(false);
    } else if (input.startsWith("/")) {
      setShowCommands(true);
      setSelectedIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [input, selectedCommand]);

  const handleSelectCommand = (command: Command) => {
    setInput(extractCommandContent(input));
    setSelectedCommand(command);
    setShowCommands(false);
  };

  const handleCancelCommand = () => {
    setSelectedCommand(null);
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    if (selectedCommand) {
      const params = selectedCommand.getQueryParams(input);
      const queryString = new URLSearchParams(params).toString();
      const path = queryString
        ? `${selectedCommand.targetPath}?${queryString}`
        : selectedCommand.targetPath;
      router.push(path);
      setInput("");
      setSelectedCommand(null);
      setShowCommands(false);
      return;
    }

    if (input.startsWith("/") && filteredCommands.length > 0) {
      setInput(extractCommandContent(input));
      setSelectedCommand(filteredCommands[selectedIndex]);
      setShowCommands(false);
      return;
    }

    await sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selectedCommand) {
      if (e.key === "Escape") {
        handleCancelCommand();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
    }

    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === "Escape") {
        setShowCommands(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const placeholder = selectedCommand
    ? `描述你想${selectedCommand.modeLabel}的内容...`
    : showCommands
      ? "搜索命令..."
      : "继续对话...";

  const lastMsg = chatMessages[chatMessages.length - 1];
  const isAILoading =
    (status === "submitted" || status === "streaming") && (!lastMsg || lastMsg.role === "user");

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
        选择或创建一个会话开始聊天
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mobile-scroll flex-1 overflow-y-auto bg-white px-4 pb-8 pt-5 safe-bottom md:px-6 md:pb-10 md:pt-6">
        <div className="mx-auto max-w-[calc(100vw-32px)] space-y-4 md:max-w-[var(--message-max-width)]">
          <AIDegradationBanner kind={aiDegradedKind} />

          {chatMessages.length === 0 && !isLoading && (
            <WorkspaceEmptyState
              icon={Sparkles}
              eyebrow="New Session"
              title="开始一段新对话"
              description="继续提问、沉淀想法，或用命令进入课程、访谈与笔记工作流。"
              className="py-10"
            />
          )}

          {chatMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onSendReply={(text) => sendMessage({ text })} />
          ))}

          {isAILoading && <LoadingDots />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-[#f6f7f9] px-4 pb-5 pt-4 safe-bottom md:px-6 md:pb-6 md:pt-4">
        <div className="relative mx-auto max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)]">
          <AnimatePresence>
            {showCommands && !selectedCommand && filteredCommands.length > 0 && (
              <CommandMenu
                commands={filteredCommands}
                selectedIndex={selectedIndex}
                onSelect={handleSelectCommand}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedCommand && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mb-3 flex items-center gap-2"
              >
                <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs shadow-[0_16px_34px_-28px_rgba(15,23,42,0.18)]">
                  <selectedCommand.modeIcon className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                  <span className="text-[var(--color-text-secondary)] font-medium">
                    {selectedCommand.modeLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelCommand}
                    className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-2 rounded-[28px] bg-white p-2 shadow-[0_24px_56px_-36px_rgba(15,23,42,0.16)] md:gap-3 md:p-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#f3f5f8]">
              <Sparkles className="h-4 w-4 text-[#111827]" />
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              rows={1}
              className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-none min-h-[24px] max-h-[120px]"
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
                  : "cursor-not-allowed bg-[#eceff3] text-[var(--color-text-muted)]",
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
