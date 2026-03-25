"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
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
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="touch-target ui-surface-card w-full rounded-[28px] p-4 text-left transition-all duration-200 hover:[box-shadow:var(--shadow-soft-panel-hover)] active:scale-[0.98] md:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="ui-icon-chip flex h-11 w-11 items-center justify-center">
            <Icon className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          </div>
          <div className="ui-surface-soft rounded-full px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
            课程
          </div>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">{time}</span>
      </div>

      <h3 className="mb-2 text-sm font-medium text-[var(--color-text)] md:text-[15px]">{title}</h3>
      <p className="text-xs leading-6 text-[var(--color-text-muted)] md:text-sm">{desc}</p>

      <div className="mt-5 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <span>继续学习</span>
        <ArrowUpRight className="h-3.5 w-3.5" />
      </div>
    </motion.button>
  );
}
