"use client";

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
  const canOpen = Boolean(url);

  const handleClick = () => {
    if (url) {
      router.push(url);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canOpen}
      aria-label={canOpen ? `继续学习：${title}` : title}
      className="touch-target ui-surface-card w-full rounded-[28px] p-4 text-left transition-colors duration-200 hover:[box-shadow:var(--shadow-soft-panel-hover)] disabled:cursor-default disabled:opacity-70 md:min-h-[220px] md:p-6"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="ui-icon-chip flex h-10 w-10 items-center justify-center rounded-2xl">
          <Icon className="h-4 w-4 text-[var(--color-text-secondary)]" />
        </div>
        <span className="pt-0.5 text-[11px] text-[var(--color-text-muted)]">{time}</span>
      </div>

      <h3 className="mb-2 line-clamp-2 text-[0.95rem] font-medium leading-6 text-[var(--color-text)] md:text-[15px]">
        {title}
      </h3>
      <p className="line-clamp-2 text-xs leading-6 text-[var(--color-text-secondary)] md:text-sm">
        {desc}
      </p>

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-secondary)] md:mt-6">
        <span className="font-medium">{canOpen ? "继续学习" : "暂无入口"}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-panel-soft)] md:h-9 md:w-9">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}
