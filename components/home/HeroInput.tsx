"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  useFloating,
  flip,
  shift,
  offset,
  size,
  autoUpdate,
} from "@floating-ui/react";
import { usePendingChatStore, useTransitionStore } from "@/stores";
import { extractCommandContent, HOME_COMMANDS } from "@/lib/chat/commands";
import { cn } from "@/lib/utils";
import type { Command } from "@/types/chat";

export function HeroInput() {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const startExpand = useTransitionStore((state) => state.startExpand);
  const setPendingChat = usePendingChatStore((state) => state.set);
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);

  const { refs, floatingStyles } = useFloating({
    placement: "top",
    middleware: [
      offset(4),
      flip({
        fallbackPlacements: ["bottom"],
      }),
      shift({
        padding: 8,
      }),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const filteredCommands = (() => {
    if (!input.startsWith("/")) return HOME_COMMANDS;
    const query = input.slice(1).trim().toLowerCase();
    if (!query) return HOME_COMMANDS;
    return HOME_COMMANDS.filter((c) => c.label.toLowerCase().includes(query));
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

  const handleSubmit = () => {
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

    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const message = input.trim();
    const id = crypto.randomUUID();

    setPendingChat(id, message);
    startExpand(rect, `/chat/${id}`);
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
      : "描述你想学习或创建的内容...";

  return (
    <div className="relative w-full">
      {/* 命令菜单 - Floating UI 定位 */}
      <AnimatePresence mode="sync">
        {showCommands && !selectedCommand && filteredCommands.length > 0 && (
          <motion.div
            ref={refs.setFloating}
            style={floatingStyles}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="bg-white rounded-2xl shadow-[var(--shadow-elevated)] overflow-hidden z-50"
          >
            <div className="p-2 space-y-0.5">
              {filteredCommands.map((cmd, idx) => (
                <motion.button
                  type="button"
                  key={cmd.id}
                  onClick={() => handleSelectCommand(cmd)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.1 }}
                  className={cn(
                    "w-full flex items-center px-3 py-2.5 rounded-xl text-left transition-colors",
                    idx === selectedIndex
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50",
                  )}
                >
                  <cmd.icon className="w-4 h-4 mr-3 flex-shrink-0 text-zinc-400" />
                  <span className="flex-1 text-sm font-medium">{cmd.label}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-300" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 输入框 */}
      <motion.div
        ref={(node) => {
          cardRef.current = node;
          refs.setReference(node);
        }}
        whileHover={{ scale: showCommands ? 1 : 1.005 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white shadow-[var(--shadow-elevated)] hover:shadow-[var(--shadow-elevated-hover)] transition-shadow rounded-3xl"
      >
        <div className="p-6">
          <div className="flex items-end gap-4">
            <AnimatePresence>
              {selectedCommand && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 rounded-lg text-xs flex-shrink-0"
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

            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={3}
                className="w-full bg-transparent border-none outline-none text-lg text-zinc-800 placeholder:text-zinc-400 resize-none min-h-[80px] max-h-[200px] py-2"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!input.trim()}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                input.trim()
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed",
              )}
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
