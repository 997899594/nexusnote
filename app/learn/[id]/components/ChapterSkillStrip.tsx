"use client";

import { Compass } from "lucide-react";
import type { GoldenPathCourseContext } from "@/lib/golden-path/types";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { getCurrentChapterSkills, getGoldenPathSkillClassName } from "./golden-path-skill-ui";

interface ChapterSkillStripProps {
  context: GoldenPathCourseContext | null;
  label?: string;
  maxSkills?: number;
  tone?: "soft" | "warm";
  className?: string;
}

export function ChapterSkillStrip({
  context,
  label = "本章训练能力",
  maxSkills = 4,
  tone = "soft",
  className,
}: ChapterSkillStripProps) {
  const currentChapterIndex = useLearnStore((state) => state.currentChapterIndex);

  if (!context) {
    return null;
  }

  const skills = getCurrentChapterSkills(context, currentChapterIndex, maxSkills);

  if (skills.length === 0) {
    return null;
  }

  return (
    <div className={cn("rounded-[22px] border border-black/5 bg-white/82 p-3", className)}>
      <div className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        <Compass className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {skills.slice(0, maxSkills).map((skill) => (
          <span
            key={skill.id}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-medium",
              getGoldenPathSkillClassName(skill.state, tone),
            )}
          >
            {skill.name}
          </span>
        ))}
      </div>
    </div>
  );
}
