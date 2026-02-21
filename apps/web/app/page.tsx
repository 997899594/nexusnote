/**
 * Home Page - with brand header and learning outputs
 */

"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
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
import Link from "next/link";
import { HeroInput } from "@/features/home";

const recentOutputs = [
  {
    id: "1",
    type: "course",
    title: "TypeScript 进阶教程",
    desc: "深入理解类型系统",
    icon: GraduationCap,
    time: "2小时前",
  },
  {
    id: "2",
    type: "flashcard",
    title: "React 核心概念",
    desc: "32 张卡片 · 已复习 3 次",
    icon: StickyNote,
    time: "昨天",
  },
  {
    id: "3",
    type: "quiz",
    title: "Node.js 面试题",
    desc: "15 道题目 · 正确率 87%",
    icon: Brain,
    time: "2天前",
  },
  {
    id: "4",
    type: "mindmap",
    title: "微服务架构设计",
    desc: "12 个节点",
    icon: MapIcon,
    time: "3天前",
  },
  {
    id: "5",
    type: "note",
    title: "AI 学习笔记",
    desc: "GPT-4 原理与应用",
    icon: FileText,
    time: "1周前",
  },
  {
    id: "6",
    type: "insight",
    title: "本周学习洞察",
    desc: "学习时长 12.5 小时",
    icon: Lightbulb,
    time: "每周",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* 顶部品牌区 */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">NexusNote</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">AI 学习助手</p>
            </div>
          </div>
        </motion.header>

        {/* 输入区域 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <HeroInput />
        </motion.div>

        {/* 底部学习产出 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-foreground">最近产出</h2>
            <Link
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              查看全部 →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentOutputs.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + index * 0.03 }}
                className="group bg-card border border-border rounded-2xl p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
                <h3 className="font-medium text-sm text-card-foreground mb-0.5 group-hover:text-foreground transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </main>
  );
}
