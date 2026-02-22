"use client";

import type { UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Globe,
  GraduationCap,
  Loader2,
  Map as MapIcon,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useChatSession } from "../hooks/useChatSession";
import type { Command } from "../types";
import { ChatMessage, LoadingDots } from "./ChatMessage";
import { CommandMenu } from "./CommandMenu";

const COMMANDS: Command[] = [
  {
    id: "search",
    label: "Search Notes",
    icon: Search,
    modeLabel: "搜索笔记",
    modeIcon: Search,
    targetPath: "/search",
    getQueryParams: (input: string) => ({ q: input.trim() }),
  },
  {
    id: "create-note",
    label: "Create Note",
    icon: Plus,
    modeLabel: "创建笔记",
    modeIcon: Plus,
    targetPath: "/notes/new",
    getQueryParams: () => ({}),
  },
  {
    id: "generate-course",
    label: "Generate Course",
    icon: GraduationCap,
    modeLabel: "生成课程",
    modeIcon: GraduationCap,
    targetPath: "/courses/new",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "create-flashcards",
    label: "Create Flashcards",
    icon: BookOpen,
    modeLabel: "创建闪卡",
    modeIcon: BookOpen,
    targetPath: "/flashcards",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "generate-quiz",
    label: "Generate Quiz",
    icon: MapIcon,
    modeLabel: "生成测验",
    modeIcon: MapIcon,
    targetPath: "/interview",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "web-search",
    label: "Web Search",
    icon: Globe,
    modeLabel: "联网搜索",
    modeIcon: Globe,
    targetPath: "/search",
    getQueryParams: (input: string) => ({ web: input.trim() }),
  },
];

function extractCommandContent(input: string): string {
  const match = input.match(/^\/\S+\s*(.*)$/);
  return match ? match[1] : "";
}

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
  const isLoading = chat.isLoading;

  const chatMessages = messages.filter((m: UIMessage) => m.role !== "system");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const filteredCommands = (() => {
    if (!input.startsWith("/")) return COMMANDS;
    const query = input.slice(1).trim().toLowerCase();
    if (!query) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(query));
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
      <div className="flex items-center justify-center h-full text-zinc-400">
        选择或创建一个会话开始聊天
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-[var(--message-max-width)] mx-auto space-y-4">
          {chatMessages.length === 0 && !isLoading && (
            <div className="text-center py-12 text-zinc-400 text-sm">开始对话...</div>
          )}

          {chatMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {isAILoading && <LoadingDots />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-zinc-100 bg-white px-6 py-4">
        <div className="max-w-[var(--message-max-width)] mx-auto relative">
          <AnimatePresence>
            {showCommands && !selectedCommand && filteredCommands.length > 0 && (
              <CommandMenu
                commands={filteredCommands}
                selectedIndex={selectedIndex}
                onSelect={handleSelectCommand}
                onClose={() => setShowCommands(false)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedCommand && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 mb-3"
              >
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 rounded-lg text-xs">
                  <selectedCommand.modeIcon className="w-3 h-3 text-zinc-500" />
                  <span className="text-zinc-600 font-medium">{selectedCommand.modeLabel}</span>
                  <button
                    type="button"
                    onClick={handleCancelCommand}
                    className="p-0.5 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-3 bg-zinc-50 rounded-2xl p-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-zinc-400" />
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
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
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
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
