"use client";

import { motion } from "framer-motion";
import {
  Brain,
  FileText,
  GraduationCap,
  Lightbulb,
  Map as MapIcon,
  Plus,
  Search,
  Send,
  Sparkles,
  StickyNote,
  Zap,
} from "lucide-react";
import { useState } from "react";

type StyleKey = "glass" | "shadow" | "minimal" | "modern";

const outputs = [
  {
    type: "course",
    title: "TypeScript 进阶教程",
    desc: "深入理解类型系统",
    icon: GraduationCap,
    time: "2小时前",
  },
  {
    type: "flashcard",
    title: "React 核心概念",
    desc: "32 张卡片 · 已复习 3 次",
    icon: StickyNote,
    time: "昨天",
  },
  {
    type: "quiz",
    title: "Node.js 面试题",
    desc: "15 道题目 · 正确率 87%",
    icon: Brain,
    time: "2天前",
  },
  { type: "mindmap", title: "微服务架构设计", desc: "12 个节点", icon: MapIcon, time: "3天前" },
  { type: "note", title: "AI 学习笔记", desc: "GPT-4 原理与应用", icon: FileText, time: "1周前" },
  {
    type: "insight",
    title: "本周学习洞察",
    desc: "学习时长 12.5 小时",
    icon: Lightbulb,
    time: "每周",
  },
];

const commands = [
  { icon: Search, label: "搜索笔记" },
  { icon: Plus, label: "创建笔记" },
  { icon: GraduationCap, label: "生成课程" },
  { icon: StickyNote, label: "创建闪卡" },
  { icon: Brain, label: "生成测验" },
  { icon: MapIcon, label: "思维导图" },
];

const styles: Record<
  StyleKey,
  { name: string; bg: string; card: string; cardHover: string; input: string; inputHover: string }
> = {
  glass: {
    name: "玻璃",
    bg: "bg-gradient-to-br from-slate-100 via-white to-slate-50",
    card: "bg-white/60 backdrop-blur-xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)]",
    cardHover: "hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.1)] hover:bg-white/70",
    input: "bg-white/50 backdrop-blur-xl shadow-[0_4px_32px_-8px_rgba(0,0,0,0.08)]",
    inputHover: "hover:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12)]",
  },
  shadow: {
    name: "阴影",
    bg: "bg-slate-50",
    card: "bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_4px_20px_-4px_rgba(0,0,0,0.08)]",
    cardHover:
      "hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1),0_12px_32px_-8px_rgba(0,0,0,0.12)] hover:-translate-y-0.5",
    input: "bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.1),0_8px_48px_-8px_rgba(0,0,0,0.06)]",
    inputHover: "hover:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12),0_16px_64px_-8px_rgba(0,0,0,0.08)]",
  },
  minimal: {
    name: "极简",
    bg: "bg-white",
    card: "bg-slate-50/80",
    cardHover: "hover:bg-slate-100/80",
    input: "bg-slate-50",
    inputHover: "",
  },
  modern: {
    name: "2026",
    bg: "bg-[#0a0a0a]",
    card: "bg-[#1a1a1a] border border-white/5",
    cardHover: "hover:border-white/10 hover:bg-[#1f1f1f]",
    input: "bg-[#1a1a1a] border border-white/10",
    inputHover: "border-white/20",
  },
};

function ModernInput() {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative max-w-2xl mx-auto">
      <motion.div
        animate={{
          borderColor: focused ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
          boxShadow: focused
            ? "0 0 0 1px rgba(255,255,255,0.1), 0 20px 50px -20px rgba(139,92,246,0.3)"
            : "0 0 0 1px rgba(255,255,255,0.05)",
        }}
        className="relative bg-[#1a1a1a] rounded-2xl border border-white/10 overflow-hidden"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="想学什么，告诉 AI..."
          rows={3}
          className="w-full bg-transparent px-6 py-5 text-lg text-white placeholder:text-zinc-500 resize-none outline-none min-h-[120px]"
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={!input.trim()}
          className={`absolute bottom-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            input.trim()
              ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25"
              : "bg-zinc-800 text-zinc-500"
          }`}
        >
          <Send className="w-4 h-4" />
        </motion.button>

        <div className="flex items-center justify-between px-6 pb-4">
          <div className="flex items-center gap-2">
            {[
              { icon: Search, label: "搜索" },
              { icon: Plus, label: "创建" },
              { icon: GraduationCap, label: "课程" },
            ].map((cmd) => (
              <button
                key={cmd.label}
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              >
                <cmd.icon className="w-3 h-3" />
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-center gap-3 mt-6"
      >
        {commands.slice(0, 4).map((cmd, i) => (
          <motion.button
            key={cmd.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.05 }}
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors border border-white/5 hover:border-white/10"
          >
            <cmd.icon className="w-4 h-4" />
            {cmd.label}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

export default function DemoPage() {
  const [style, setStyle] = useState<StyleKey>("modern");
  const s = styles[style];

  return (
    <div className={`min-h-screen transition-colors duration-500 ${s.bg}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="fixed top-6 right-6 z-50 flex gap-1 p-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/10"
      >
        {(Object.keys(styles) as StyleKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStyle(key)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${style === key ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
          >
            {styles[key].name}
          </button>
        ))}
      </motion.div>

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14 text-center"
        >
          {style === "modern" ? (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-zinc-400 mb-8"
              >
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                AI 驱动的新一代学习助手
              </motion.div>
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
                你的私人学习顾问
              </h1>
              <p className="text-xl text-zinc-400">让 AI 为你规划、记忆、测评</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-10 justify-center">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-lg text-zinc-900">NexusNote</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-3 tracking-tight">
                你的私人学习顾问
              </h1>
              <p className="text-lg text-zinc-500">让 AI 为你规划、记忆、测评</p>
            </>
          )}
        </motion.header>

        {style === "modern" ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-20"
          >
            <ModernInput />
          </motion.section>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-14"
          >
            <motion.div
              whileHover={{ scale: style === "minimal" ? 1 : 1.005 }}
              transition={{ duration: 0.2 }}
              className={`rounded-3xl p-6 transition-all duration-300 ${s.input} ${s.inputHover}`}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="例如：我想学习 React Hooks"
                  className="flex-1 bg-transparent text-lg text-zinc-900 placeholder:text-zinc-400 outline-none"
                />
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-xl font-medium text-sm bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                >
                  开始
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {commands.map((cmd, i) => (
                  <motion.button
                    key={cmd.label}
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.03 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-zinc-100/80 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/80 transition-colors"
                  >
                    <cmd.icon className="w-3.5 h-3.5" />
                    {cmd.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className={`font-medium ${style === "modern" ? "text-zinc-400" : "text-zinc-700"}`}>
              最近
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {outputs.map((item, i) => (
              <motion.div
                key={item.type}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.04 }}
                className={`p-5 rounded-2xl cursor-pointer transition-all duration-200 ${s.card} ${s.cardHover}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${style === "modern" ? "bg-white/5" : "bg-zinc-100"}`}
                  >
                    <item.icon
                      className={`w-4 h-4 ${style === "modern" ? "text-zinc-400" : "text-zinc-500"}`}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">{item.time}</span>
                </div>
                <h3
                  className={`font-medium text-sm mb-0.5 ${style === "modern" ? "text-zinc-200" : "text-zinc-900"}`}
                >
                  {item.title}
                </h3>
                <p className="text-xs text-zinc-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
