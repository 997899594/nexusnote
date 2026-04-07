"use client";

import { Sparkles } from "lucide-react";
import type { GoldenPathChapterSkill, GoldenPathCourseContext } from "@/lib/golden-path/types";
import { cn } from "@/lib/utils";
import { useLearnStore } from "@/stores/learn";
import { getCurrentChapterSkills, getGoldenPathSkillStateLabel } from "./golden-path-skill-ui";

interface GoldenPathChapterPanelProps {
  context: GoldenPathCourseContext | null;
}

const TREE_POSITIONS = [
  { left: "18%", top: 118 },
  { left: "50%", top: 132 },
  { left: "82%", top: 118 },
  { left: "32%", top: 224 },
  { left: "68%", top: 224 },
] as const;

function getNodeTone(state: GoldenPathChapterSkill["state"]): string {
  switch (state) {
    case "mastered":
      return "border-[#d6b25f]/55 bg-[radial-gradient(circle_at_top_left,rgba(214,178,95,0.16),transparent_55%),linear-gradient(180deg,#fbf4df_0%,#f7efd6_100%)] text-[#6f5316] shadow-[0_18px_36px_-28px_rgba(214,178,95,0.42)]";
    case "in_progress":
      return "border-[#d9c49b]/55 bg-[radial-gradient(circle_at_top_left,rgba(217,196,155,0.12),transparent_55%),linear-gradient(180deg,#f7f1e4_0%,#f3ece0_100%)] text-[#745c27] shadow-[0_18px_36px_-28px_rgba(183,147,83,0.28)]";
    case "ready":
      return "border-black/8 bg-[linear-gradient(180deg,#f7f8fa_0%,#f1f4f7_100%)] text-[var(--color-text-secondary)]";
    case "locked":
      return "border-black/6 bg-[linear-gradient(180deg,#f7f8fa_0%,#f4f6f8_100%)] text-[var(--color-text-tertiary)] opacity-90";
  }
}

function getNodeGlow(state: GoldenPathChapterSkill["state"]): string {
  switch (state) {
    case "mastered":
      return "bg-[#d6b25f]";
    case "in_progress":
      return "bg-[#c69a4a]";
    case "ready":
      return "bg-[#9aa3af]";
    case "locked":
      return "bg-[#d1d5db]";
  }
}

function getTreePosition(index: number) {
  return TREE_POSITIONS[index] ?? TREE_POSITIONS[TREE_POSITIONS.length - 1];
}

export function GoldenPathChapterPanel({ context }: GoldenPathChapterPanelProps) {
  const currentChapterIndex = useLearnStore((state) => state.currentChapterIndex);

  if (!context) {
    return null;
  }

  const chapter = context.chapters.find((item) => item.chapterIndex === currentChapterIndex + 1);
  const matchedSkills = getCurrentChapterSkills(context, currentChapterIndex, 5).slice(0, 5);
  const skillCount = matchedSkills.length;

  if (skillCount === 0) {
    return null;
  }

  return (
    <div className="mt-5 overflow-hidden rounded-[32px] border border-[#2a2419] bg-[radial-gradient(circle_at_top_left,rgba(231,199,114,0.16),transparent_32%),linear-gradient(180deg,#15120e_0%,#1a1510_100%)] p-4 text-white shadow-[0_28px_64px_-40px_rgba(15,23,42,0.28)] md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white/55">
            <Sparkles className="h-3.5 w-3.5 text-[#ddb96d]" />
            章节技能树
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em] text-white md:text-[1.15rem]">
            当前章节点亮 {context.mainRouteName}
          </h3>
          <p className="mt-2 text-sm leading-7 text-white/62">
            {chapter?.matchedSkills.length
              ? "当前章节相关节点已经挂到主线之下，随着阅读和完成度逐步点亮。"
              : context.mainRouteTagline}
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/62">
          <span className="h-2 w-2 rounded-full bg-[#ddb96d]" />
          本章节点 {skillCount}
        </div>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(231,199,114,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-3 py-5 md:px-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(231,199,114,0.08),transparent_18%),radial-gradient(circle_at_84%_24%,rgba(255,255,255,0.05),transparent_12%),radial-gradient(circle_at_70%_82%,rgba(231,199,114,0.08),transparent_18%)]" />

        <div className="relative mx-auto min-h-[320px] max-w-[760px]">
          <div className="pointer-events-none absolute left-1/2 top-[68px] h-[82px] w-[2px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,rgba(221,185,109,0.85),rgba(221,185,109,0.12))]" />
          <div className="pointer-events-none absolute left-1/2 top-[148px] h-[2px] w-[min(72%,520px)] -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(221,185,109,0.1),rgba(221,185,109,0.55),rgba(221,185,109,0.1))]" />

          <div className="absolute left-1/2 top-0 w-[min(86%,320px)] -translate-x-1/2">
            <div className="rounded-[24px] border border-[#ddb96d]/30 bg-[radial-gradient(circle_at_top_left,rgba(231,199,114,0.14),transparent_45%),linear-gradient(180deg,#1b160f_0%,#17130e_100%)] px-4 py-3 text-center shadow-[0_26px_52px_-34px_rgba(224,188,99,0.42)]">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">系统主线</div>
              <div className="mt-2 text-base font-semibold text-white">{context.mainRouteName}</div>
              <div className="mt-2 text-[11px] text-white/52">
                {chapter ? `第 ${chapter.chapterIndex} 章正在推进` : "当前课程正在推进"}
              </div>
            </div>
          </div>

          {matchedSkills.map((skill, index) => {
            const position = getTreePosition(index);
            const isLowerBranch = index >= 3;

            return (
              <div
                key={skill.id}
                className="absolute w-[min(42vw,188px)] min-w-[148px] -translate-x-1/2 md:w-[172px]"
                style={{ left: position.left, top: position.top }}
              >
                <div
                  className={cn(
                    "relative rounded-[22px] border px-3.5 py-3 backdrop-blur-sm",
                    getNodeTone(skill.state),
                  )}
                >
                  <div
                    className={cn(
                      "absolute -top-5 left-1/2 h-5 w-[2px] -translate-x-1/2 rounded-full",
                      isLowerBranch
                        ? "bg-[linear-gradient(180deg,rgba(221,185,109,0.32),rgba(221,185,109,0.08))]"
                        : "bg-[linear-gradient(180deg,rgba(221,185,109,0.58),rgba(221,185,109,0.14))]",
                    )}
                  />
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                        skill.state === "in_progress" && "animate-pulse",
                        getNodeGlow(skill.state),
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-5">{skill.name}</div>
                      <div className="mt-1 text-[11px] opacity-72">
                        {getGoldenPathSkillStateLabel(skill.state)} · {skill.progressScore}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
