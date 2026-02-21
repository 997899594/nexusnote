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
  Sparkles,
  StickyNote,
  Zap,
} from "lucide-react";
import { useState } from "react";

type StyleKey = "glass" | "shadow" | "minimal";

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
};

export default function DemoPage() {
  const [style, setStyle] = useState<StyleKey>("shadow");
  const s = styles[style];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${s.bg}`}>
      {/* Style Switcher */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="fixed top-6 right-6 z-50 flex gap-1 p-1 bg-white/80 backdrop-blur-sm rounded-full shadow-sm"
      >
        {(Object.keys(styles) as StyleKey[]).map((key) => (
          <button
            type="button"
            key={key}
            onClick={() => setStyle(key)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
              style === key ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {styles[key].name}
          </button>
        ))}
      </motion.div>

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14"
        >
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-zinc-900">NexusNote</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-3 tracking-tight">
            你想学什么？
          </h1>
          <p className="text-lg text-zinc-500">告诉 AI 你的学习目标，自动生成课程、闪卡、测验</p>
        </motion.header>

        {/* Input */}
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

            {/* Commands */}
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

        {/* Recent */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-medium text-zinc-700">最近</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {outputs.map((item, i) => (
              <motion.div
                key={item.type}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.04 }}
                className={`p-5 rounded-2xl cursor-pointer transition-all duration-200 ${s.card} ${s.cardHover}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-zinc-500" />
                  </div>
                  <span className="text-xs text-zinc-400">{item.time}</span>
                </div>
                <h3 className="font-medium text-sm text-zinc-900 mb-0.5">{item.title}</h3>
                <p className="text-xs text-zinc-400">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
