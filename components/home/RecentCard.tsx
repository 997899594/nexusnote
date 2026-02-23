"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  FileText,
  GraduationCap,
  type LucideIcon,
  Map as MapIcon,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import { useRouter } from "next/navigation";

const ICONS: Record<string, LucideIcon> = {
  course: GraduationCap,
  flashcard: StickyNote,
  quiz: BookOpen,
  note: FileText,
  chat: MessageSquare,
  mindmap: MapIcon,
};

export interface RecentCardProps {
  title: string;
  desc: string;
  iconName: keyof typeof ICONS;
  time: string;
  url?: string;
}

export function RecentCard({ title, desc, iconName, time, url }: RecentCardProps) {
  const router = useRouter();
  const Icon = ICONS[iconName] || FileText;

  const handleClick = () => {
    if (url) router.push(url);
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={handleClick}
      className="bg-white rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
          <Icon className="w-4 h-4 text-zinc-500" />
        </div>
        <span className="text-xs text-zinc-400">{time}</span>
      </div>
      <h3 className="font-medium text-sm text-zinc-900 mb-0.5">{title}</h3>
      <p className="text-xs text-zinc-400">{desc}</p>
    </motion.div>
  );
}
