"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Command,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/features/shared/utils";

interface CommandOption {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

export function HeroInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async (goal: string) => {
    if (!goal.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      router.push(`/create?goal=${encodeURIComponent(goal)}`);
    } catch (error) {
      console.error("Generation failed:", error);
      setIsGenerating(false);
    }
  };

  // Command Options
  const commands: CommandOption[] = useMemo(
    () => [
      {
        id: "new_note",
        label: "New Note",
        icon: FileText,
        shortcut: "N",
        action: () => {
          console.log("New Note");
        },
      },
      {
        id: "gen_course",
        label: "Generate Course",
        icon: Command,
        shortcut: "G",
        action: () => {
          if (value) handleGenerate(value);
        },
      },
      {
        id: "ask_ai",
        label: "Ask AI Assistant",
        icon: Sparkles,
        shortcut: "A",
        action: () => {
          console.log("Ask AI");
        },
      },
    ],
    [value, handleGenerate],
  );

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!commandQuery) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(commandQuery.toLowerCase()));
  }, [commands, commandQuery]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  // Slash Command Logic
  useEffect(() => {
    const match = value.match(/\/(\w*)$/);
    if (match) {
      setShowCommandMenu(true);
      setCommandQuery(match[1]);
      setSelectedIndex(0);
    } else {
      setShowCommandMenu(false);
      setCommandQuery("");
    }
  }, [value]);

  const handleSubmit = () => {
    if (showCommandMenu && filteredCommands.length > 0) {
      executeCommand(filteredCommands[selectedIndex]);
    } else {
      handleGenerate(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd + Enter or Enter to Submit
    if (e.key === "Enter" && !e.shiftKey) {
      if (showCommandMenu) {
        e.preventDefault();
        executeCommand(filteredCommands[selectedIndex]);
      } else if (e.metaKey || e.ctrlKey || !textareaRef.current || value.split("\n").length <= 1) {
        e.preventDefault();
        handleSubmit();
      }
    }

    // Command Menu Navigation
    if (showCommandMenu && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandMenu(false);
      }
    }
  };

  const executeCommand = (command: CommandOption) => {
    const newValue = value.replace(/\/(\w*)$/, "");
    setValue(newValue);
    setShowCommandMenu(false);
    command.action();
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full max-w-3xl mx-auto relative z-30 font-sans group">
      <AnimatePresence>
        {showCommandMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-6 mb-2 w-72 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-black/[0.06] overflow-hidden p-1.5 z-50"
          >
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-black/[0.04] mb-1">
              <span className="text-[10px] font-bold text-black/40 uppercase tracking-wider">
                Commands
              </span>
              <span className="text-[10px] text-black/30">{filteredCommands.length} matches</span>
            </div>

            {filteredCommands.length > 0 ? (
              filteredCommands.map((cmd, index) => (
                <CommandItem
                  key={cmd.id}
                  icon={cmd.icon}
                  label={cmd.label}
                  shortcut={cmd.shortcut}
                  isSelected={index === selectedIndex}
                  onClick={() => executeCommand(cmd)}
                />
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-black/40">No commands found</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={containerRef}
        className={cn(
          "relative bg-white rounded-[24px] shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-black/[0.04] overflow-hidden transition-all duration-300",
          isFocused ? "shadow-[0_12px_60px_rgba(0,0,0,0.16)] scale-[1.01]" : "",
        )}
      >
        <div className="flex flex-col min-h-[160px] p-6">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Describe your learning goal..."
            className="w-full bg-transparent outline-none text-2xl text-[#1a1a1a] placeholder:text-[#999] resize-none overflow-hidden leading-relaxed min-h-[80px]"
            rows={1}
          />

          <div className="flex items-end justify-between mt-auto pt-6">
            <div className="flex items-center gap-2">
              <IconButton icon={Paperclip} />
              <IconButton icon={ImageIcon} />
              <div className="h-4 w-[1px] bg-black/10 mx-1" />
              <IconButton icon={Mic} />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-black/30 hidden sm:inline-block">
                {showCommandMenu ? (
                  <span className="text-indigo-500 font-bold">Select command...</span>
                ) : (
                  <>
                    Use{" "}
                    <kbd className="font-mono bg-black/5 px-1.5 py-0.5 rounded text-black/50">
                      /
                    </kbd>{" "}
                    for commands
                  </>
                )}
              </span>
              <button
                disabled={!value || isGenerating}
                onClick={handleSubmit}
                className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-30 disabled:hover:bg-black transition-all shadow-md active:scale-95"
              >
                {isGenerating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <button className="p-2.5 rounded-xl hover:bg-black/[0.04] text-black/40 hover:text-black/80 transition-colors relative group active:scale-95">
      <Icon className="w-5 h-5" />
    </button>
  );
}

function CommandItem({
  icon: Icon,
  label,
  shortcut,
  isSelected,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200",
        isSelected
          ? "bg-black/5 text-black scale-[1.02] shadow-sm"
          : "text-black/60 hover:bg-black/[0.02]",
      )}
    >
      <div
        className={cn(
          "w-6 h-6 flex items-center justify-center rounded-md transition-colors",
          isSelected ? "bg-white text-black shadow-sm" : "text-black/40 bg-black/5",
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className="text-sm font-medium flex-1">{label}</span>
      {shortcut && (
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-white border border-black/10 rounded text-[10px] font-mono text-black/40 shadow-sm">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}
