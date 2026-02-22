"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronRight,
  Globe,
  GraduationCap,
  ListTodo,
  Map as MapIcon,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePendingChatStore } from "@/ui/chat/stores/usePendingChatStore";
import { useTransitionStore } from "@/ui/chat/stores/useTransitionStore";
import type { Command } from "@/ui/chat/types";
import { cn } from "@/lib/utils";

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
    icon: MapIcon,
    modeLabel: "思维导图",
    modeIcon: MapIcon,
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

const QUICK_ACTIONS = [
  { icon: Search, label: "搜索笔记" },
  { icon: Plus, label: "创建笔记" },
  { icon: GraduationCap, label: "生成课程" },
  { icon: ListTodo, label: "创建闪卡" },
  { icon: BookOpen, label: "生成测验" },
  { icon: MapIcon, label: "思维导图" },
];

function extractCommandContent(input: string): string {
  const match = input.match(/^\/\S+\s*(.*)$/);
  return match ? match[1] : "";
}

export function HeroInput() {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const startExpand = useTransitionStore((state) => state.startExpand);
  const setPendingChat = usePendingChatStore((state) => state.set);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);

  const filteredCommands = useMemo(() => {
    if (!input.startsWith("/")) return COMMANDS;
    const query = input.slice(1).trim().toLowerCase();
    if (!query) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(query));
  }, [input]);

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

  const handleSelectCommand = useCallback(
    (command: Command) => {
      setInput(extractCommandContent(input));
      setSelectedCommand(command);
      setShowCommands(false);
    },
    [input],
  );

  const handleCancelCommand = useCallback(() => {
    setSelectedCommand(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;

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

    // 2026 乐观跳转：客户端生成 UUID，立刻跳转，零等待
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const message = input.trim();
    const id = crypto.randomUUID(); // 浏览器原生，同步，< 1ms

    setPendingChat(id, message);
    startExpand(rect, `/chat/${id}`);
    setInput("");
  }, [
    input,
    selectedCommand,
    filteredCommands,
    selectedIndex,
    router,
    startExpand,
    setPendingChat,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    },
    [showCommands, filteredCommands, handleSubmit, selectedCommand, handleCancelCommand],
  );

  const placeholder = selectedCommand
    ? `描述你想${selectedCommand.modeLabel}的内容...`
    : showCommands
      ? "搜索命令..."
      : "描述你想学习或创建的内容...";

  const hintText = selectedCommand
    ? "Enter 跳转页面"
    : showCommands
      ? "↑↓ 选择, Enter 确认"
      : "开始对话 或 / 使用命令";

  return (
    <div className="relative w-full">
      {/* Command Menu */}
      <AnimatePresence>
        {showCommands && !selectedCommand && filteredCommands.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-3 bg-white rounded-2xl shadow-[var(--shadow-elevated)] overflow-hidden z-50"
          >
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                命令
              </div>
              {filteredCommands.map((cmd, idx) => (
                <button
                  type="button"
                  key={cmd.id}
                  onClick={() => handleSelectCommand(cmd)}
                  className={cn(
                    "w-full flex items-center px-3 py-3 rounded-xl text-left transition-colors",
                    idx === selectedIndex
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50",
                  )}
                >
                  <cmd.icon className="w-4 h-4 mr-3 flex-shrink-0 text-zinc-400" />
                  <span className="flex-1 text-sm font-medium">{cmd.label}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-300" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input */}
      <motion.div
        ref={cardRef}
        whileHover={{ scale: 1.005 }}
        transition={{ duration: 0.2 }}
        className="relative flex flex-col bg-white rounded-3xl p-6 shadow-[var(--shadow-elevated)] hover:shadow-[var(--shadow-elevated-hover)] transition-shadow"
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-zinc-400" />
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-2xl text-zinc-800 placeholder:text-zinc-400 resize-none min-h-[48px]"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {selectedCommand && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 rounded-lg text-xs"
                >
                  <selectedCommand.modeIcon className="w-3 h-3 text-zinc-500" />
                  <span className="text-zinc-600 font-medium">{selectedCommand.modeLabel}</span>
                  <button
                    type="button"
                    onClick={handleCancelCommand}
                    className="p-0.5 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="button"
              className="p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
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
              disabled={!input.trim()}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                input.trim()
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed",
              )}
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-zinc-100">
          {QUICK_ACTIONS.map((action) => (
            <button
              type="button"
              key={action.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-zinc-100/80 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/80 transition-colors"
            >
              <action.icon className="w-3.5 h-3.5" />
              {action.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
