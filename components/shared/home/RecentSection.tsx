"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Map as MapIcon,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/components/auth";
import { RecentCard } from "./RecentCard";

const ICONS = {
  course: GraduationCap,
  flashcard: StickyNote,
  quiz: BookOpen,
  note: FileText,
  chat: MessageSquare,
  mindmap: MapIcon,
} as const;

export function RecentSection() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [items, setItems] = useState<
    Array<{
      id: string;
      type: string;
      title: string;
      desc: string;
      time: string;
      icon: keyof typeof ICONS;
      url: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchRecent = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/recent?limit=6");
        const data = await res.json();
        setItems(data.items || []);
      } catch (error) {
        console.error("[RecentSection] Failed to fetch:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecent();
  }, [isAuthenticated]);

  // 未登录时不显示
  if (!isAuthenticated) {
    return null;
  }

  // 加载中或无数据
  if (isLoading) {
    return (
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-zinc-700">最近</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-zinc-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-zinc-700">最近</h2>
        </div>
        <div className="text-center py-8 text-zinc-400 text-sm">
          还没有学习记录，开始第一次学习吧！
        </div>
      </section>
    );
  }

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
        {items.map((item, i) => {
          const Icon = ICONS[item.icon] || FileText;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.04 }}
            >
              <RecentCard
                title={item.title}
                desc={item.desc}
                icon={Icon}
                time={item.time}
                url={item.url}
              />
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
