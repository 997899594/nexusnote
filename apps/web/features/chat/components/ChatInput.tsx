/**
 * ChatInput - Modern Chat Input with Command Menu
 *
 * 简化自 Legacy HeroInput，保留核心交互
 */

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Command, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface CommandOption {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

interface ChatInputProps {
  onSubmit: (message: string) => void;
  onGenerate?: (goal: string) => void;
  loading?: boolean;
}

export function ChatInput({ onSubmit, onGenerate, loading }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const commands: CommandOption[] = useMemo(
    () => [
      {
        id: "new_note",
        label: "New Note",
        icon: Sparkles,
        shortcut: "N",
        action: () => console.log("New Note"),
      },
      {
        id: "generate_course",
        label: "Generate Course",
        icon: Sparkles,
        action: () => console.log("Generate Course"),
      },
      {
        id: "create_flashcard",
        label: "Create Flashcard",
        icon: Sparkles,
        action: () => console.log("Create Flashcard"),
      },
      {
        id: "start_interview",
        label: "Start Interview",
        icon: Sparkles,
        action: () => console.log("Start Interview"),
      },
    ],
    [],
  );

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (value.startsWith("/")) {
      setShowCommands(true);
      setQuery(value.slice(1));
      setSelectedIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [value]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter" && showCommands && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].action();
        setShowCommands(false);
        setValue("");
      } else if (e.key === "Escape") {
        setShowCommands(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCommands, filteredCommands, selectedIndex]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onSubmit(value);
    setValue("");
  };

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Command Menu */}
      <AnimatePresence>
        {showCommands && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
          >
            <div className="p-2 border-b border-slate-100">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
                className="w-full px-3 py-2 bg-slate-50 rounded-lg outline-none text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filteredCommands.map((cmd, index) => (
                <motion.button
                  key={cmd.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    cmd.action();
                    setShowCommands(false);
                    setValue("");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    index === selectedIndex ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"
                  }`}
                >
                  <cmd.icon className="w-4 h-4" />
                  <span className="flex-1 text-sm">{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-500">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <form onSubmit={handleSubmit}>
        <motion.div
          animate={{
            boxShadow: isFocused
              ? "0 10px 40px -10px rgba(99, 102, 241, 0.3)"
              : "0 0 0 0 rgba(99, 102, 241, 0)",
          }}
          className={`relative flex items-end gap-2 p-2 bg-white border rounded-2xl transition-all ${
            isFocused ? "border-indigo-500" : "border-slate-200"
          }`}
        >
          <motion.button
            type="button"
            onClick={() => setShowCommands(!showCommands)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Command className="w-5 h-5" />
          </motion.button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="输入消息或 / 打开命令..."
            rows={1}
            className="flex-1 py-3 pr-2 resize-none outline-none text-sm max-h-[200px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !showCommands) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          <motion.button
            type="submit"
            disabled={!value.trim() || loading}
            whileHover={value.trim() && !loading ? { scale: 1.05 } : {}}
            whileTap={value.trim() && !loading ? { scale: 0.95 } : {}}
            className={`p-3 rounded-xl transition-all ${
              value.trim() && !loading
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </form>
    </div>
  );
}

export default ChatInput;
