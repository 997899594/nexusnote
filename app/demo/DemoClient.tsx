"use client";

/**
 * Design System Showcase - Slate 主题
 *
 * 展示 Slate 色系设计语言：冷调灰蓝，克制高级
 */

import { motion } from "framer-motion";
import {
  Brain,
  FileText,
  GraduationCap,
  Lightbulb,
  Map as MapIcon,
  Palette,
  Plus,
  Search,
  Send,
  Sparkles,
  StickyNote,
  Zap,
} from "lucide-react";
import { useState } from "react";

// Slate 调色板展示
const slatePalette = [
  { name: "50", value: "oklch(98% 0.005 250)", hex: "#f8fafc" },
  { name: "100", value: "oklch(95% 0.01 250)", hex: "#f1f5f9" },
  { name: "200", value: "oklch(91% 0.015 250)", hex: "#e2e8f0" },
  { name: "300", value: "oklch(84% 0.02 250)", hex: "#cbd5e1" },
  { name: "400", value: "oklch(72% 0.025 250)", hex: "#94a3b8" },
  { name: "500", value: "oklch(58% 0.03 250)", hex: "#64748b" },
  { name: "600", value: "oklch(50% 0.03 250)", hex: "#475569" },
  { name: "700", value: "oklch(42% 0.028 250)", hex: "#334155" },
  { name: "800", value: "oklch(34% 0.025 250)", hex: "#1e293b" },
  { name: "900", value: "oklch(26% 0.02 250)", hex: "#0f172a" },
];

const recentItems = [
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

// 圆角展示
const radiusOptions = [
  { name: "sm", value: "0.5rem (8px)", class: "rounded-sm" },
  { name: "md", value: "0.75rem (12px)", class: "rounded-md" },
  { name: "lg", value: "1rem (16px)", class: "rounded-lg" },
  { name: "xl", value: "1.25rem (20px)", class: "rounded-xl" },
  { name: "2xl", value: "1.5rem (24px)", class: "rounded-2xl" },
  { name: "full", value: "9999px", class: "rounded-full" },
];

export function DemoClient() {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 bg-[var(--color-bg)]/80 backdrop-blur-lg border-b border-[var(--color-border-subtle)]"
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-[var(--color-text)]">NexusNote</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <Palette className="w-4 h-4" />
            <span>Slate Design System</span>
          </div>
        </div>
      </motion.header>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-text)] mb-4 tracking-tight">
            Slate 设计系统
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto">
            冷调灰蓝，克制高级。类似 Notion、Linear 的专业感。
          </p>
        </motion.section>

        {/* 调色板展示 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">调色板</h2>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
            {slatePalette.map((color, i) => (
              <motion.div
                key={color.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + i * 0.02 }}
                className="space-y-2"
              >
                <div
                  className="aspect-square rounded-xl shadow-sm border border-[var(--color-border-subtle)]"
                  style={{ backgroundColor: color.value }}
                />
                <div className="text-center">
                  <div className="text-xs font-medium text-[var(--color-text)]">{color.name}</div>
                  <div className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                    {color.hex}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* 主输入框 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">输入框</h2>
          <motion.div
            animate={{
              borderColor: focused
                ? "var(--color-accent)"
                : "var(--color-border)",
              boxShadow: focused
                ? "0 0 0 3px var(--color-accent-ring)"
                : "var(--shadow-card)",
            }}
            className="relative bg-[var(--color-surface)] rounded-2xl border overflow-hidden transition-shadow"
          >
            <div className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-subtle)] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="例如：我想学习 React Hooks"
                className="flex-1 bg-transparent text-lg text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none"
              />
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl font-medium text-sm bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                开始
              </button>
            </div>
            <div className="flex flex-wrap gap-2 px-5 pb-5">
              {commands.map((cmd) => (
                <button
                  key={cmd.label}
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[var(--color-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-active)] transition-colors"
                >
                  <cmd.icon className="w-3.5 h-3.5" />
                  {cmd.label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.section>

        {/* 按钮展示 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">按钮</h2>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl font-medium text-sm bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm"
            >
              主按钮
            </button>
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl font-medium text-sm bg-[var(--color-accent-light)] text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-colors"
            >
              次按钮
            </button>
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl font-medium text-sm border-2 border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors"
            >
              边框按钮
            </button>
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl font-medium text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
            >
              幽灵按钮
            </button>
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl font-medium text-sm text-[var(--color-accent)] hover:underline transition-all"
            >
              链接按钮
            </button>
          </div>
        </motion.section>

        {/* 标签展示 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">标签</h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-accent)] text-[var(--color-accent-fg)]">
              默认标签
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-accent-light)] text-[var(--color-accent)]">
              浅色标签
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium border border-[var(--color-accent)] text-[var(--color-accent)]">
              边框标签
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-muted)] text-[var(--color-text-secondary)]">
              次要标签
            </span>
          </div>
        </motion.section>

        {/* 圆角展示 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">圆角</h2>
          <div className="flex flex-wrap items-end gap-4">
            {radiusOptions.map((r) => (
              <div key={r.name} className="text-center">
                <div
                  className={`w-16 h-16 bg-[var(--color-accent-light)] border border-[var(--color-border)] ${r.class}`}
                />
                <div className="mt-2 text-xs font-medium text-[var(--color-text)]">{r.name}</div>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">{r.value}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 卡片展示 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">卡片</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentItems.map((item, i) => (
              <motion.div
                key={item.type}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.04 }}
                className="p-5 rounded-2xl bg-[var(--color-surface)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] border border-[var(--color-border-subtle)] cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--color-hover)]">
                    <item.icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </div>
                  <span className="text-xs text-[var(--color-text-tertiary)]">{item.time}</span>
                </div>
                <h3 className="font-medium text-sm mb-0.5 text-[var(--color-text)]">{item.title}</h3>
                <p className="text-xs text-[var(--color-text-tertiary)]">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* 浮动输入框 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">浮动输入</h2>
          <div className="relative max-w-2xl mx-auto">
            <motion.div
              animate={{
                borderColor: focused
                  ? "var(--color-accent)"
                  : "var(--color-border)",
                boxShadow: focused
                  ? "0 20px 50px -20px oklch(50% 0.03 250 / 20%)"
                  : "var(--shadow-elevated)",
              }}
              className="relative bg-[var(--color-surface)] rounded-2xl border overflow-hidden"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="想学什么，告诉 AI..."
                rows={3}
                className="w-full bg-transparent px-6 py-5 text-lg text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] resize-none outline-none min-h-[120px]"
              />

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={!input.trim()}
                className={`absolute bottom-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  input.trim()
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-lg"
                    : "bg-[var(--color-muted)] text-[var(--color-text-tertiary)]"
                }`}
              >
                <Send className="w-4 h-4" />
              </motion.button>

              <div className="flex items-center gap-2 px-6 pb-4">
                {[
                  { icon: Search, label: "搜索" },
                  { icon: Plus, label: "创建" },
                  { icon: GraduationCap, label: "课程" },
                ].map((cmd) => (
                  <button
                    key={cmd.label}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
                  >
                    <cmd.icon className="w-3 h-3" />
                    {cmd.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* 设计规范说明 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-subtle)]"
        >
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-6">设计规范</h2>
          <div className="grid md:grid-cols-2 gap-8 text-sm">
            <div>
              <h3 className="font-medium text-[var(--color-text)] mb-3">色相特点</h3>
              <ul className="space-y-2 text-[var(--color-text-secondary)]">
                <li>• 色相: 250 (冷蓝灰)</li>
                <li>• 饱和度极低: 0.01-0.03</li>
                <li>• 高级克制，不俗气</li>
                <li>• 类似 Notion、Linear 的专业感</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-[var(--color-text)] mb-3">动画配置</h3>
              <ul className="space-y-2 text-[var(--color-text-secondary)]">
                <li>• 快速交互: 150ms</li>
                <li>• 标准过渡: 200ms</li>
                <li>• 入场动画: 300ms</li>
                <li>• Spring: stiffness 300, damping 30</li>
              </ul>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
