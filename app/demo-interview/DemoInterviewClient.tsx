"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Command,
  Edit3,
  Play,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

// --- Types & Data ---
type Phase = "home" | "interviewing" | "outline";
type DemoMessage = {
  id: string;
  role: "ai" | "user";
  text: string;
};

function createDemoMessage(role: DemoMessage["role"], text: string): DemoMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text,
  };
}

const MOCK_OUTLINE = [
  {
    id: "01",
    title: "核心心智模型",
    desc: "理解 React Hooks 的函数式编程本质与闭包陷阱",
    nodes: ["闭包与 State 的秘密", "Hooks 渲染模型：从 Fiber 到渲染树"],
  },
  {
    id: "02",
    title: "副作用管理实战",
    desc: "深度掌握 useEffect 的生命周期与依赖项检查",
    nodes: ["依赖项深度比较：useMemoizedValue 的妙用", "清理函数：优雅处理竞态条件"],
  },
  {
    id: "03",
    title: "性能与架构优化",
    desc: "从 useMemo 到 React 19 并发模式",
    nodes: ["跳过重渲染：memo、useCallback 的正确姿势", "Transition API：让长任务不再阻塞 UI"],
  },
];

// --- Components ---

const Nav = ({ onHome }: { onHome: () => void }) => (
  <nav className="fixed top-0 left-0 right-0 h-14 bg-[var(--color-bg)]/50 backdrop-blur-xl z-50 flex items-center justify-between px-8 border-b border-[var(--color-border-subtle)]">
    <div className="flex items-center gap-6">
      <button
        type="button"
        className="flex items-center gap-2 cursor-pointer group"
        onClick={onHome}
      >
        <div className="w-6 h-6 rounded bg-[var(--color-text)] flex items-center justify-center transition-transform group-hover:rotate-12">
          <div className="w-2 h-2 bg-[var(--color-bg)] rounded-full" />
        </div>
        <span className="font-semibold text-sm tracking-tight uppercase">NexusNote</span>
      </button>
      <div className="h-4 w-px bg-[var(--color-border)]" />
      <div className="text-[12px] font-medium text-[var(--color-text-tertiary)] flex items-center gap-4">
        <span className="cursor-pointer hover:text-[var(--color-text)] transition-colors">
          浏览库
        </span>
        <span className="cursor-pointer hover:text-[var(--color-text)] transition-colors">
          实验室
        </span>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-hover)] border border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-tertiary)] font-mono">
        <Command size={10} />
        <span>K</span>
      </div>
    </div>
  </nav>
);

export function DemoInterviewClient() {
  const [phase, setPhase] = useState<Phase>("home");
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<DemoMessage[]>([
    createDemoMessage("ai", "你好。我是你的规划师。告诉我，你想在哪个领域进行深度突破？"),
  ]);

  const handleStart = () => {
    if (!inputText.trim()) return;
    setPhase("interviewing");
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        createDemoMessage("user", inputText),
        createDemoMessage(
          "ai",
          "明白了。针对这个话题，我需要确认几个关键维度：你目前的实战年限，以及你是否更关注底层原理而非 API 使用？",
        ),
      ]);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-sans selection:bg-[var(--color-accent)]/10 selection:text-[var(--color-accent)]">
      <Nav onHome={() => setPhase("home")} />

      <LayoutGroup>
        <AnimatePresence mode="wait">
          {/* --- Home Phase --- */}
          {phase === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-4xl mx-auto pt-48 px-8"
            >
              <header className="mb-24">
                <motion.h1
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="text-6xl font-display font-medium leading-[1.1] tracking-tight mb-8"
                >
                  构建你的专属
                  <br />
                  <span className="text-[var(--color-text-tertiary)]">智能学习蓝图</span>
                </motion.h1>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.8 }}
                  className="text-lg text-[var(--color-text-secondary)] max-w-xl leading-relaxed"
                >
                  拒绝泛化的内容。通过深度对谈，由 AI 为你精密裁剪出最适合当下的进阶路径。
                </motion.p>
              </header>

              {/* Omnibar Input */}
              <motion.div
                layoutId="omnibar"
                className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-card)] p-4 flex flex-col gap-4 group transition-all hover:border-[var(--color-text-tertiary)]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-hover)] flex items-center justify-center">
                    <Search size={18} className="text-[var(--color-text-tertiary)]" />
                  </div>
                  <input
                    type="text"
                    placeholder="输入你的进阶目标... (如: Web3 安全架构)"
                    className="flex-1 bg-transparent outline-none text-xl placeholder:text-[var(--color-text-muted)]"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleStart()}
                  />
                  <button
                    type="button"
                    onClick={handleStart}
                    className="h-10 px-6 rounded-xl bg-[var(--color-text)] text-[var(--color-bg)] font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                  >
                    开启访谈 <ArrowRight size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border-subtle)] overflow-x-auto scrollbar-none">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-tertiary)] mr-2">
                    推荐路径
                  </span>
                  {["React 并发模式", "分布式系统共识", "编译原理实战"].map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setInputText(t)}
                      className="px-3 py-1 rounded-full bg-[var(--color-hover)] border border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-active)] transition-colors whitespace-nowrap"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Simple Footer Stats */}
              <footer className="mt-32 pt-8 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--color-text-tertiary)] uppercase tracking-widest">
                <div className="flex gap-12">
                  <div className="flex flex-col gap-1">
                    <span className="text-[var(--color-text-muted)]">Active Plans</span>
                    <span className="text-[var(--color-text-secondary)]">2,482</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[var(--color-text-muted)]">AI Accuracy</span>
                    <span className="text-[var(--color-text-secondary)]">99.2%</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  System Operational
                </div>
              </footer>
            </motion.div>
          )}

          {/* --- Interview Phase --- */}
          {phase === "interviewing" && (
            <motion.div
              key="interview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto pt-32 px-8 pb-40"
            >
              <div className="space-y-12">
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-2">
                      {m.role === "ai" ? "Nexus Intelligence" : "Your Intent"}
                    </div>
                    <div
                      className={`text-lg leading-relaxed ${m.role === "ai" ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)] font-medium"}`}
                    >
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Action Trigger */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-20 flex justify-center"
              >
                <button
                  type="button"
                  onClick={() => setPhase("outline")}
                  className="group flex flex-col items-center gap-4 transition-all hover:-translate-y-1"
                >
                  <div className="w-14 h-14 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-[var(--color-accent-fg)] shadow-xl shadow-[var(--color-accent)]/20">
                    <Sparkles size={24} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-accent)] group-hover:tracking-[0.3em] transition-all">
                    生成最终蓝图
                  </span>
                </button>
              </motion.div>

              {/* Bottom Omnibar (Persisted Layout) */}
              <div className="fixed bottom-10 left-0 right-0 px-8">
                <motion.div
                  layoutId="omnibar"
                  className="max-w-2xl mx-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-elevated)] p-2 pl-5 flex items-center gap-4"
                >
                  <input
                    type="text"
                    placeholder="回答..."
                    className="flex-1 bg-transparent outline-none text-sm h-10"
                  />
                  <button
                    type="button"
                    className="h-10 w-10 rounded-xl bg-[var(--color-hover)] flex items-center justify-center text-[var(--color-text-secondary)]"
                  >
                    <ArrowUpRight size={18} />
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* --- Outline Phase --- */}
          {phase === "outline" && (
            <motion.div
              key="outline"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto pt-32 px-8 pb-48"
            >
              <div className="mb-20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-[1px] w-8 bg-[var(--color-accent)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-accent)]">
                    Mastery Blueprint
                  </span>
                </div>
                <h1 className="text-4xl font-display font-medium mb-4">
                  {inputText || "React Hooks 深度进阶"}
                </h1>
                <p className="text-[var(--color-text-secondary)] text-sm max-w-lg leading-relaxed">
                  这是为你生成的唯一路径。我们将从底层的 Fiber
                  渲染逻辑开始，直至掌握高级并发模式下的状态一致性。
                </p>
              </div>

              {/* Curriculum List */}
              <div className="space-y-0 border-t border-[var(--color-border-subtle)]">
                {MOCK_OUTLINE.map((chapter, i) => (
                  <motion.div
                    key={chapter.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 + 0.3 }}
                    className="py-10 border-b border-[var(--color-border-subtle)] group cursor-pointer"
                  >
                    <div className="flex items-start gap-12">
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)] pt-1.5">
                        {chapter.id}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xl font-medium tracking-tight group-hover:text-[var(--color-accent)] transition-colors">
                            {chapter.title}
                          </h3>
                          <Plus size={16} className="text-[var(--color-text-muted)]" />
                        </div>
                        <p className="text-sm text-[var(--color-text-tertiary)] leading-relaxed mb-6">
                          {chapter.desc}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {chapter.nodes.map((n) => (
                            <div
                              key={n}
                              className="px-2.5 py-1 rounded-md bg-[var(--color-hover)] text-[11px] text-[var(--color-text-secondary)] font-medium"
                            >
                              {n}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Floating Bottom UI */}
              <div className="fixed bottom-0 left-0 right-0 p-8 flex justify-center items-end pointer-events-none">
                <div className="max-w-md w-full flex flex-col items-center gap-4 pointer-events-auto">
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-full bg-[var(--color-text)] text-[var(--color-bg)] font-bold shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Play size={18} fill="currentColor" />
                    立即进入学习工作区
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors"
                  >
                    <Edit3 size={12} />
                    微调大纲建议
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
