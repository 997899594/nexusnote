import type { GoldenPathChapterSkill, GoldenPathCourseContext } from "@/lib/golden-path/types";

export type GoldenPathSkillTone = "soft" | "warm" | "panel";

export function getGoldenPathSkillStateLabel(state: GoldenPathChapterSkill["state"]): string {
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

export function getGoldenPathSkillClassName(
  state: GoldenPathChapterSkill["state"],
  tone: GoldenPathSkillTone = "soft",
): string {
  if (tone === "warm") {
    switch (state) {
      case "mastered":
        return "border-[#ead9ab] bg-[#f8f1dd] text-[#6e5218]";
      case "in_progress":
        return "border-[#e8dcc0] bg-[#f5efe2] text-[#6d5a2a]";
      case "ready":
        return "border-[#dfe5ec] bg-[#eef1f5] text-[#4b5563]";
      case "locked":
        return "border-[#eceff3] bg-[#f5f6f8] text-[#9ca3af]";
    }
  }

  if (tone === "panel") {
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

  switch (state) {
    case "mastered":
      return "border-[#e7dcc0] bg-[#f8f1dd] text-[#6e5218]";
    case "in_progress":
      return "border-[#dfe5ec] bg-[#eef1f5] text-[#4b5563]";
    case "ready":
      return "border-[#e5e7eb] bg-[#f5f6f8] text-[#6b7280]";
    case "locked":
      return "border-[#eceff3] bg-[#f8fafc] text-[#9ca3af]";
  }
}

export function getCurrentChapterSkills(
  context: GoldenPathCourseContext | null,
  currentChapterIndex: number,
  fallbackCount = 0,
): GoldenPathChapterSkill[] {
  if (!context) {
    return [];
  }

  const chapter = context.chapters.find((item) => item.chapterIndex === currentChapterIndex + 1);

  if (chapter?.matchedSkills.length) {
    return chapter.matchedSkills;
  }

  return fallbackCount > 0 ? context.courseSkills.slice(0, fallbackCount) : [];
}
