"use client";

import { motion } from "framer-motion";
import {
  Brain,
  FileText,
  GraduationCap,
  Lightbulb,
  Map as MindMapIcon,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Zap,
} from "lucide-react";

const outputs = [
  {
    type: "course",
    title: "TypeScript 进阶教程",
    desc: "深入理解类型系统",
    icon: GraduationCap,
    bg: "bg-gradient-to-br from-violet-500 to-purple-600",
    time: "2小时前",
  },
  {
    type: "flashcard",
    title: "React 核心概念",
    desc: "32 张卡片 · 已复习 3 次",
    icon: StickyNote,
    bg: "bg-gradient-to-br from-amber-500 to-orange-500",
    time: "昨天",
  },
  {
    type: "quiz",
    title: "Node.js 面试题",
    desc: "15 道题目 · 正确率 87%",
    icon: Brain,
    bg: "bg-gradient-to-br from-emerald-500 to-teal-500",
    time: "2天前",
  },
  {
    type: "mindmap",
    title: "微服务架构设计",
    desc: "12 个节点",
    icon: MindMapIcon,
    bg: "bg-gradient-to-br from-cyan-500 to-blue-500",
    time: "3天前",
  },
  {
    type: "note",
    title: "AI 学习笔记",
    desc: "GPT-4 原理与应用",
    icon: FileText,
    bg: "bg-gradient-to-br from-rose-500 to-pink-500",
    time: "1周前",
  },
  {
    type: "insight",
    title: "本周学习洞察",
    desc: "学习时长 12.5 小时",
    icon: Lightbulb,
    bg: "bg-gradient-to-br from-indigo-500 to-blue-500",
    time: "每周",
  },
];

const shortcuts = [
  { key: "/", action: "唤起命令" },
  { key: "↑↓", action: "选择命令" },
  { key: "Enter", action: "执行" },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen relative">
      {/* 背景 */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0a0a0a]" />
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#1a1a2e] rounded-full blur-[150px] opacity-60" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#16213e] rounded-full blur-[180px] opacity-50" />
        <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-[#1f1f3d] rounded-full blur-[120px] opacity-40" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-12 pb-16">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-16"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg tracking-tight">NexusNote</h1>
              <p className="text-zinc-500 text-xs">AI 学习助手</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-zinc-500 text-sm">
                <kbd className="px-2 py-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 font-mono">
                  {s.key}
                </kbd>
                <span className="hidden sm:inline">{s.action}</span>
              </div>
            ))}
          </div>
        </motion.header>

        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            你想学什么？
          </h2>
          <p className="text-zinc-400 text-lg mb-10 max-w-xl">
            告诉 AI你的学习目标，自动生成课程、闪卡、测验，让学习更高效。
          </p>

          {/* 输入框 */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-500" />
            <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <input
                  type="text"
                  placeholder="例如：我想学习 React Hooks"
                  className="flex-1 bg-transparent text-white text-lg placeholder:text-zinc-500 outline-none"
                />
                <button className="px-5 py-2.5 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 transition-colors">
                  开始
                </button>
              </div>

              {/* 命令标签 */}
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { icon: Search, label: "搜索笔记" },
                  { icon: Plus, label: "创建笔记" },
                  { icon: GraduationCap, label: "生成课程" },
                  { icon: StickyNote, label: "创建闪卡" },
                  { icon: Brain, label: "生成测验" },
                  { icon: MindMapIcon, label: "思维导图" },
                ].map((cmd, i) => (
                  <motion.button
                    key={cmd.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 hover:text-white transition-all"
                  >
                    <cmd.icon className="w-3.5 h-3.5" />
                    {cmd.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Recent Outputs */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold text-xl">最近产出</h3>
            <button className="text-zinc-500 hover:text-white text-sm transition-colors">
              查看全部 →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {outputs.map((item, i) => (
              <motion.div
                key={item.type + i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                className="group bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 hover:border-zinc-700 rounded-2xl p-5 cursor-pointer transition-all hover:bg-zinc-800/30"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-11 h-11 ${item.bg} rounded-xl flex items-center justify-center shadow-lg`}
                  >
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-zinc-600 text-xs">{item.time}</span>
                </div>
                <h4 className="text-white font-medium mb-1 group-hover:text-violet-300 transition-colors">
                  {item.title}
                </h4>
                <p className="text-zinc-500 text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-20 text-center"
        >
          <p className="text-zinc-600 text-sm">使用 AI 快速生成学习内容 · 间隔重复高效记忆</p>
        </motion.footer>
      </div>
    </div>
  );
}
