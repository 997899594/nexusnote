"use client";

import { motion } from "framer-motion";
import {
  Brain,
  FileText,
  GraduationCap,
  Lightbulb,
  Map as MapIcon,
  StickyNote,
} from "lucide-react";
import { RecentCard } from "./RecentCard";

const recentOutputs = [
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

export function RecentSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-medium text-zinc-700">最近</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recentOutputs.map((item, i) => (
          <motion.div
            key={item.type}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.04 }}
          >
            <RecentCard title={item.title} desc={item.desc} icon={item.icon} time={item.time} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
