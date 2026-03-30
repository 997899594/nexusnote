"use client";

import { Compass, Sparkles, Target } from "lucide-react";
import type { GoldenPathCourseContext } from "@/lib/golden-path/types";
import { useLearnStore } from "@/stores/learn";

interface GoldenPathChapterPanelProps {
  context: GoldenPathCourseContext | null;
  compact?: boolean;
}

function getStateLabel(state: GoldenPathCourseContext["courseSkills"][number]["state"]): string {
  switch (state) {
    case "mastered":
      return "已掌握";
    case "in_progress":
      return "学习中";
    case "ready":
      return "可开始";
    case "locked":
      return "待解锁";
  }
}

function getStateClassName(
  state: GoldenPathCourseContext["courseSkills"][number]["state"],
): string {
  switch (state) {
    case "mastered":
      return "bg-[#f3ead0] text-[#6e5218]";
    case "in_progress":
      return "bg-[#ece8de] text-[#6d5a2a]";
    case "ready":
      return "bg-[#eef1f5] text-[#4b5563]";
    case "locked":
      return "bg-[#f3f4f6] text-[#9ca3af]";
  }
}

export function GoldenPathChapterPanel({ context, compact = false }: GoldenPathChapterPanelProps) {
  const currentChapterIndex = useLearnStore((state) => state.currentChapterIndex);

  if (!context) {
    return null;
  }

  const chapter = context.chapters.find((item) => item.chapterIndex === currentChapterIndex + 1);
  const matchedSkills = chapter?.matchedSkills ?? [];

  if (compact) {
    return (
      <div className="rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.16)]">
        <div className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          <Compass className="h-3.5 w-3.5" />
          黄金之路
        </div>
        <div className="mt-2 text-sm font-semibold text-[var(--color-text)]">
          {context.mainRouteName}
        </div>
        <p className="mt-1 text-xs leading-6 text-[var(--color-text-secondary)]">
          本章正在推进{" "}
          {matchedSkills.length || context.courseSkills.length ? "这些关键技能点" : "主线能力"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(matchedSkills.length > 0 ? matchedSkills : context.courseSkills.slice(0, 3)).map(
            (skill) => (
              <span
                key={skill.id}
                className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-medium ${getStateClassName(skill.state)}`}
              >
                {skill.name}
              </span>
            ),
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-[28px] border border-[#ead9ab]/70 bg-[linear-gradient(135deg,#fcf8ef_0%,#f7f1e2_100%)] p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-[#8b6a24]">
            <Sparkles className="h-3.5 w-3.5" />
            黄金之路
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)]">
            本章正在推进 {context.mainRouteName}
          </h3>
          <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
            {chapter
              ? `第 ${chapter.chapterIndex} 章会重点推动这些技能点。`
              : context.mainRouteTagline}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm text-[var(--color-text-secondary)]">
          <Target className="h-4 w-4" />
          {matchedSkills.length} 个本章相关技能点
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {(matchedSkills.length > 0 ? matchedSkills : context.courseSkills.slice(0, 5)).map(
          (skill) => (
            <div
              key={skill.id}
              className="rounded-2xl border border-white/70 bg-white/85 px-3.5 py-2 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.16)]"
            >
              <div className="text-sm font-medium text-[var(--color-text)]">{skill.name}</div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {getStateLabel(skill.state)} · {skill.progressScore}%
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
