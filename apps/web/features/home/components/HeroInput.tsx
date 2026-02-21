"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type TextUIPart, type UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronRight,
  Globe,
  GraduationCap,
  ListTodo,
  Loader2,
  Map,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";

// ============================================================================
// Types
// ============================================================================

interface Command {
  id: string;
  label: string;
  icon: React.ElementType;
  modeLabel: string;
  modeIcon: React.ElementType;
  targetPath: string;
  getQueryParams: (input: string) => Record<string, string>;
}

// ============================================================================
// Utils
// ============================================================================

/**
 * 从输入中提取命令后的内容
 * 例如: "/flashcards 帮我创建" -> "帮我创建"
 */
function extractCommandContent(input: string): string {
  const match = input.match(/^\/\S+\s*(.*)$/);
  return match ? match[1] : "";
}

// ============================================================================
// Constants
// ============================================================================

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
    icon: ListTodo,
    modeLabel: "创建闪卡",
    modeIcon: ListTodo,
    targetPath: "/flashcards",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "generate-quiz",
    label: "Generate Quiz",
    icon: BookOpen,
    modeLabel: "生成测验",
    modeIcon: BookOpen,
    targetPath: "/interview",
    getQueryParams: (input: string) => ({ msg: input.trim() }),
  },
  {
    id: "mind-map",
    label: "Mind Map",
    icon: Map,
    modeLabel: "思维导图",
    modeIcon: Map,
    targetPath: "/editor",
    getQueryParams: (input: string) => ({ msg: `Create mind map: ${input.trim()}` }),
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

// ============================================================================
// Components
// ============================================================================

/**
 * 命令模式标签 - 显示在输入框右侧，小巧简洁
 */
function CommandModeTag({ command, onCancel }: { command: Command; onCancel: () => void }) {
  const ModeIcon = command.modeIcon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-xs"
    >
      <ModeIcon className="w-3 h-3 text-amber-600 dark:text-amber-400" />
      <span className="text-amber-700 dark:text-amber-300 font-medium">{command.modeLabel}</span>
      <motion.button
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.8 }}
        onClick={onCancel}
        className="p-0.5 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
      >
        <X className="w-3 h-3" />
      </motion.button>
    </motion.div>
  );
}

/**
 * 命令列表 - 下拉菜单
 */
function CommandList({
  commands,
  selectedIndex,
  onSelect,
}: {
  commands: Command[];
  selectedIndex: number;
  onSelect: (command: Command) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute bottom-full left-0 right-0 mb-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden"
    >
      <div className="p-2">
        <div className="px-3 py-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Commands
        </div>
        {commands.map((cmd, idx) => (
          <button
            key={cmd.id}
            onClick={() => onSelect(cmd)}
            className={cn(
              "w-full flex items-center px-3 py-3 rounded-lg text-left transition-colors",
              idx === selectedIndex
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
            )}
          >
            <cmd.icon className="w-4 h-4 mr-3 flex-shrink-0" />
            <span className="flex-1 text-sm font-medium">{cmd.label}</span>
            <ChevronRight className="w-4 h-4 opacity-40" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HeroInput() {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI Chat
  const chat = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { intent: "CHAT" },
    }),
  });

  const messages = chat.messages;
  const sendMessage = chat.sendMessage;
  const status = chat.status;
  const isLoading = status === "submitted" || status === "streaming";

  // 过滤系统消息
  const chatMessages = useMemo(
    () => messages.filter((m: UIMessage) => m.role !== "system"),
    [messages],
  );

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  // 过滤命令
  const filteredCommands = useMemo(() => {
    if (!input.startsWith("/")) return COMMANDS;
    const query = input.slice(1).trim().toLowerCase();
    if (!query) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(query));
  }, [input]);

  // 处理命令输入显示
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

  // 选择命令
  const handleSelectCommand = useCallback(
    (command: Command) => {
      setInput(extractCommandContent(input));
      setSelectedCommand(command);
      setShowCommands(false);
    },
    [input],
  );

  // 取消命令模式
  const handleCancelCommand = useCallback(() => {
    setSelectedCommand(null);
  }, []);

  // 发送消息
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    // 命令模式：跳转
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

    // 输入 / 但未选中命令：进入命令模式
    if (input.startsWith("/") && filteredCommands.length > 0) {
      setInput(extractCommandContent(input));
      setSelectedCommand(filteredCommands[selectedIndex]);
      setShowCommands(false);
      return;
    }

    // 普通聊天：立即展开界面，再发送消息
    setIsExpanded(true);
    await sendMessage({ text: input.trim() });
    setInput("");
  }, [input, isLoading, selectedCommand, filteredCommands, selectedIndex, sendMessage, router]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 命令模式
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

      // 命令选择模式
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

      // 普通模式
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [showCommands, filteredCommands, handleSubmit, selectedCommand, handleCancelCommand],
  );

  // 提取消息文本
  const getTextContent = useCallback((message: UIMessage): string => {
    return message.parts
      .filter((part): part is TextUIPart => part.type === "text")
      .map((part) => part.text)
      .join("");
  }, []);

  // 获取 placeholder
  const placeholder = selectedCommand
    ? `描述你想${selectedCommand.modeLabel}的内容...`
    : showCommands
      ? "搜索命令..."
      : "Describe what you want to learn or create...";

  // 获取底部提示
  const hintText = selectedCommand
    ? "按 Enter 跳转页面"
    : showCommands
      ? "↑↓ 选择, Enter 确认"
      : "输入开始对话 或 / 使用命令";

  return (
    <div className="w-full max-w-3xl mx-auto">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          // ========================================================================
          // 输入模式
          // ========================================================================
          <motion.div
            key="input"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            {/* 命令列表 */}
            <AnimatePresence>
              {showCommands && !selectedCommand && filteredCommands.length > 0 && (
                <CommandList
                  commands={filteredCommands}
                  selectedIndex={selectedIndex}
                  onSelect={handleSelectCommand}
                />
              )}
            </AnimatePresence>

            {/* 大输入框 */}
            <motion.div
              className={cn(
                "relative flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-[24px] shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden",
                "min-h-[200px]",
              )}
            >
              <div className="flex-1 flex items-start px-6 py-6">
                <Sparkles className="w-6 h-6 text-zinc-400 mr-4 mt-1 flex-shrink-0" />
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="w-full bg-transparent border-none outline-none text-2xl text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 resize-none min-h-[80px]"
                  rows={1}
                />
              </div>

              <div className="flex items-center justify-between px-6 pb-6 pt-2">
                {/* 命令模式标签 + 新建按钮 */}
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {selectedCommand && (
                      <CommandModeTag command={selectedCommand} onCancel={handleCancelCommand} />
                    )}
                  </AnimatePresence>
                  <button className="p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-zinc-400 hidden sm:inline-block">
                    {hintText}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSubmit}
                    disabled={!input.trim() || status === "submitted"}
                    className="w-10 h-10 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full flex items-center justify-center disabled:opacity-30 shadow-md"
                  >
                    {status === "submitted" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          // ========================================================================
          // 聊天模式
          // ========================================================================
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  AI Chat
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Messages */}
            <div className="h-[400px] overflow-y-auto p-4 space-y-4">
              {/* 计算是否需要显示 loading */}
              {(() => {
                const lastMsg = chatMessages[chatMessages.length - 1];
                const lastMsgText = lastMsg ? getTextContent(lastMsg) : "";
                const isWaitingForFirstChunk =
                  (status === "submitted" || status === "streaming") &&
                  (!lastMsg || lastMsg.role !== "assistant" || lastMsgText.length === 0);

                if (isWaitingForFirstChunk && chatMessages.length === 0) {
                  return (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-2xl">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              animate={{ y: [0, -3, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                              className="w-1.5 h-1.5 bg-zinc-400 rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                if (chatMessages.length === 0) {
                  return (
                    <div className="text-center py-8 text-zinc-400 text-sm">
                      Start a conversation...
                    </div>
                  );
                }

                return null;
              })()}

              {chatMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] px-4 py-3 rounded-2xl text-sm",
                      msg.role === "user"
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100",
                    )}
                  >
                    {msg.role === "user" ? (
                      getTextContent(msg)
                    ) : (
                      <MarkdownRenderer content={getTextContent(msg)} />
                    )}
                  </div>
                </motion.div>
              ))}

              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
              {/* 命令模式标签 */}
              <AnimatePresence>
                {selectedCommand && (
                  <CommandModeTag command={selectedCommand} onCancel={handleCancelCommand} />
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-4">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedCommand
                      ? `描述你想${selectedCommand.modeLabel}的内容...`
                      : "Continue chatting..."
                  }
                  className="flex-1 bg-transparent border-none outline-none py-3 text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSubmit}
                  disabled={!input.trim() || status === "submitted"}
                  className="p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg disabled:opacity-50"
                >
                  {status === "submitted" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
