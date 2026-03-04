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
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="bg-[var(--color-surface)] rounded-2xl p-4 md:p-5 cursor-pointer transition-all duration-200 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98] touch-target border border-[var(--color-border-subtle)]"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-hover)] flex items-center justify-center">
          <Icon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">{time}</span>
      </div>
      <h3 className="font-medium text-sm text-[var(--color-text)] mb-0.5">{title}</h3>
      <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
    </motion.div>
  );
}
