"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Compass,
  GraduationCap,
  Lock,
  Sparkles,
  Target,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { type CSSProperties, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type {
  GoldenPathDomainSnapshot,
  GoldenPathLinkedCourse,
  GoldenPathNodeSnapshot,
  GoldenPathRouteSnapshot,
  GoldenPathSkillState,
  GoldenPathSnapshot,
} from "@/lib/golden-path/types";
import { cn } from "@/lib/utils";

interface GoldenPathExplorerProps {
  snapshot: GoldenPathSnapshot;
}

const BLACK_GOLD_VARS = {
  "--color-text": "#eee4d2",
  "--color-text-secondary": "rgba(238,228,210,0.76)",
  "--color-text-tertiary": "rgba(238,228,210,0.56)",
  "--color-text-muted": "rgba(180,134,62,0.7)",
  "--color-hover": "rgba(255,255,255,0.06)",
  "--color-panel-soft": "rgba(180,134,62,0.1)",
} as CSSProperties;

function getRouteStageLabel(route: GoldenPathRouteSnapshot): string {
  if (route.masteredCount >= 4 || route.progress >= 68) {
    return "主线已成型";
  }

  if (route.inProgressCount >= 3 || route.progress >= 36) {
    return "正在推进";
  }

  return "刚开始收敛";
}

function getStateLabel(state: GoldenPathSkillState): string {
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

function getStateDotTone(state: GoldenPathSkillState, active = false): string {
  switch (state) {
    case "mastered":
      return active
        ? "border-[#d1a968] bg-[#c19756] text-[#c19756] shadow-[0_0_18px_rgba(193,151,86,0.26)]"
        : "border-[#9b7337] bg-[#8d6730] text-[#8d6730]";
    case "in_progress":
      return active
        ? "border-[#d7ba7e] bg-[#d7ba7e]/16 text-[#d7ba7e] shadow-[0_0_24px_rgba(193,151,86,0.22)]"
        : "border-[#a47a3a] bg-transparent text-[#a47a3a]";
    case "ready":
      return active
        ? "border-[#cab393] bg-[#cab393]/10 text-[#cab393]"
        : "border-[#6b6156] bg-transparent text-[#948471]";
    case "locked":
      return active
        ? "border-[#5c5752] bg-[#171717] text-[#5c5752]"
        : "border-[#413f3d] bg-[#111214] text-[#4b4845]";
  }
}

function getStateLabelTone(state: GoldenPathSkillState, active = false): string {
  switch (state) {
    case "mastered":
      return active
        ? "border-[#725228]/80 bg-[linear-gradient(180deg,#1a140e_0%,#110e0b_100%)] text-[#e1c489]"
        : "border-[#4e3920]/80 bg-[#14110e] text-[#c6a160]";
    case "in_progress":
      return active
        ? "border-[#8d6730]/75 bg-[linear-gradient(180deg,#18120d_0%,#120f0c_100%)] text-[#efe3cb]"
        : "border-[#624821]/75 bg-[#14110f] text-[#dfc7a0]";
    case "ready":
      return active
        ? "border-[#6c5940]/80 bg-[#141211] text-[var(--color-text)]"
        : "border-[#41382f]/80 bg-[#121112] text-[var(--color-text-secondary)]";
    case "locked":
      return active
        ? "border-[#343231]/80 bg-[#111214] text-[var(--color-text-secondary)]"
        : "border-[#2a292b]/80 bg-[#0d0e10] text-[var(--color-text-tertiary)]";
  }
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "最近";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function sortSkills(left: GoldenPathNodeSnapshot, right: GoldenPathNodeSnapshot): number {
  const statePriority = {
    in_progress: 0,
    ready: 1,
    mastered: 2,
    locked: 3,
  } as const;

  return (
    statePriority[left.state] - statePriority[right.state] ||
    right.importance - left.importance ||
    right.progressScore - left.progressScore
  );
}

function getRouteSkills(route: GoldenPathRouteSnapshot): GoldenPathNodeSnapshot[] {
  return [
    ...new Map(
      route.domains.flatMap((domain) => domain.nodes).map((skill) => [skill.id, skill]),
    ).values(),
  ].sort(sortSkills);
}

function getDefaultSkillId(route: GoldenPathRouteSnapshot | undefined): string {
  if (!route) {
    return "";
  }

  return (
    route.nextActions[0]?.id ??
    getRouteSkills(route).find((skill) => skill.state !== "mastered")?.id ??
    getRouteSkills(route)[0]?.id ??
    ""
  );
}

function getSkillRelatedLearning(
  skill: GoldenPathNodeSnapshot,
  linkedLearning: GoldenPathLinkedCourse[],
): Array<
  GoldenPathLinkedCourse & {
    relatedChapters: GoldenPathLinkedCourse["matchedChapters"];
  }
> {
  return linkedLearning
    .filter((course) => skill.linkedCourseIds.includes(course.courseId))
    .map((course) => ({
      ...course,
      relatedChapters: course.matchedChapters.filter(
        (chapter) =>
          skill.linkedChapterKeys.includes(chapter.key) ||
          chapter.matchedSkills.includes(skill.name),
      ),
    }))
    .sort((left, right) => {
      const leftScore =
        left.relatedChapters.length * 18 + left.progressPercent + left.matchedSkills.length * 6;
      const rightScore =
        right.relatedChapters.length * 18 + right.progressPercent + right.matchedSkills.length * 6;
      return rightScore - leftScore;
    })
    .slice(0, 3);
}

function MaterialPatina({
  variant,
  className,
}: {
  variant: "seal" | "plaque" | "sigil";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0",
        variant === "seal" &&
          "bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.08),transparent_16%),radial-gradient(circle_at_78%_74%,rgba(193,151,86,0.1),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.025)_0%,transparent_38%,transparent_64%,rgba(193,151,86,0.04)_100%)] opacity-90",
        variant === "plaque" &&
          "bg-[radial-gradient(circle_at_22%_20%,rgba(255,255,255,0.05),transparent_18%),linear-gradient(135deg,rgba(193,151,86,0.04)_0%,transparent_42%,transparent_72%,rgba(255,255,255,0.02)_100%)] opacity-85",
        variant === "sigil" &&
          "bg-[linear-gradient(135deg,rgba(255,255,255,0.03)_0%,transparent_40%,transparent_72%,rgba(193,151,86,0.03)_100%)] opacity-80",
        className,
      )}
    />
  );
}

function BranchCurve({ side, className }: { side: "left" | "right"; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 42"
      className={cn(
        "pointer-events-none absolute h-[42px] w-[64px]",
        side === "right" && "-scale-x-100",
        className,
      )}
    >
      <title>Branch connector</title>
      <path
        d="M60 4C46 8 35 15 24 28C18 35 12 38 4 38"
        stroke="rgba(48,37,25,0.95)"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M60 4C46 8 35 15 24 28C18 35 12 38 4 38"
        stroke="rgba(193,151,86,0.44)"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function AncientTreeBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-[26%] top-24 h-56 rounded-full bg-[radial-gradient(circle,rgba(193,151,86,0.14)_0%,rgba(193,151,86,0.05)_34%,transparent_72%)] blur-3xl" />
      <div className="absolute left-1/2 top-28 h-[68%] w-24 -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(31,22,16,0.92)_0%,rgba(19,15,12,0.72)_44%,transparent_78%)] blur-md" />
      <div className="absolute inset-x-[12%] bottom-[-5rem] h-40 bg-[radial-gradient(ellipse_at_center,rgba(193,151,86,0.1)_0%,rgba(193,151,86,0.02)_42%,transparent_72%)] blur-2xl" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,transparent_18%,transparent_78%,rgba(193,151,86,0.04)_100%)]" />

      <svg
        aria-hidden
        viewBox="0 0 1200 760"
        className="absolute inset-x-0 top-24 hidden h-[36rem] w-full opacity-90 xl:block"
      >
        <title>Ancient tree backdrop</title>

        <ellipse
          cx="600"
          cy="110"
          rx="138"
          ry="48"
          fill="none"
          stroke="rgba(193,151,86,0.16)"
          strokeWidth="1.2"
        />
        <ellipse
          cx="600"
          cy="110"
          rx="176"
          ry="62"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="0.9"
        />

        <path
          d="M600 118C585 218 584 312 592 404C600 500 598 586 588 702"
          stroke="rgba(42,31,22,0.96)"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M600 118C585 218 584 312 592 404C600 500 598 586 588 702"
          stroke="rgba(193,151,86,0.18)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />

        <path
          d="M594 254C532 254 470 232 402 190C348 156 300 126 246 88"
          stroke="rgba(39,29,22,0.92)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M594 254C532 254 470 232 402 190C348 156 300 126 246 88"
          stroke="rgba(193,151,86,0.16)"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />

        <path
          d="M598 344C540 350 486 376 428 424C376 468 326 506 252 546"
          stroke="rgba(39,29,22,0.9)"
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M598 344C540 350 486 376 428 424C376 468 326 506 252 546"
          stroke="rgba(193,151,86,0.16)"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />

        <path
          d="M606 254C668 254 730 232 798 190C852 156 900 126 954 88"
          stroke="rgba(39,29,22,0.92)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M606 254C668 254 730 232 798 190C852 156 900 126 954 88"
          stroke="rgba(193,151,86,0.16)"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />

        <path
          d="M602 344C660 350 714 376 772 424C824 468 874 506 948 546"
          stroke="rgba(39,29,22,0.9)"
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M602 344C660 350 714 376 772 424C824 468 874 506 948 546"
          stroke="rgba(193,151,86,0.16)"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />

        <path
          d="M588 698C550 708 500 720 438 730C360 742 286 742 204 734"
          stroke="rgba(31,23,18,0.92)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M588 698C550 708 500 720 438 730C360 742 286 742 204 734"
          stroke="rgba(193,151,86,0.14)"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />

        <path
          d="M590 698C632 708 684 720 748 730C826 742 902 742 994 734"
          stroke="rgba(31,23,18,0.92)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M590 698C632 708 684 720 748 730C826 742 902 742 994 734"
          stroke="rgba(193,151,86,0.14)"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

function RouteSeal({ route }: { route: GoldenPathRouteSnapshot }) {
  return (
    <div className="relative w-full max-w-[22rem]">
      <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,rgba(193,151,86,0),rgba(193,151,86,0.75),rgba(193,151,86,0))]" />
      <div className="absolute inset-x-8 bottom-0 h-px bg-[linear-gradient(90deg,rgba(193,151,86,0),rgba(193,151,86,0.28),rgba(193,151,86,0))]" />
      <div className="relative overflow-hidden rounded-[30px] border border-[#6a4b22]/60 bg-[radial-gradient(circle_at_top,rgba(193,151,86,0.16),transparent_38%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.04),transparent_24%),linear-gradient(180deg,#17120f_0%,#0d0c0b_100%)] px-6 py-6 text-white shadow-[0_32px_70px_-44px_rgba(0,0,0,0.82)]">
        <MaterialPatina variant="seal" className="rounded-[30px]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[28px] border border-white/[0.04]" />
        <div className="pointer-events-none absolute left-1/2 top-2 h-5 w-16 -translate-x-1/2 rounded-b-full border-x border-b border-[#7a5a2c]/45 bg-[linear-gradient(180deg,rgba(193,151,86,0.18),rgba(193,151,86,0))]" />
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#b98a43]">主印</div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/68">
            {getRouteStageLabel(route)}
          </div>
        </div>

        <div className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-white">
          {route.name}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(193,151,86,0),rgba(193,151,86,0.78),rgba(193,151,86,0.16))]" />
          <div className="text-sm font-medium text-[#e1c489]">{route.progress}%</div>
          <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(193,151,86,0.16),rgba(193,151,86,0.78),rgba(193,151,86,0))]" />
        </div>
      </div>
    </div>
  );
}

function DomainPlaque({
  domain,
  isActive,
  align,
  onSelect,
}: {
  domain: GoldenPathDomainSnapshot;
  isActive: boolean;
  align: "left" | "right";
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative inline-flex w-full max-w-[18rem] items-center gap-3 overflow-hidden rounded-[18px] border px-4 py-3 text-left transition-all",
        align === "left" && "xl:ml-auto xl:flex-row-reverse xl:text-right",
        isActive
          ? "border-[#6b4b22]/75 bg-[radial-gradient(circle_at_top_left,rgba(193,151,86,0.15),transparent_42%),linear-gradient(180deg,#18130f_0%,#100f0d_100%)] shadow-[0_22px_40px_-32px_rgba(193,151,86,0.18)]"
          : "border-[#30271f]/80 bg-[linear-gradient(180deg,#141312_0%,#101011_100%)] hover:border-[#4f3820] hover:bg-[linear-gradient(180deg,#171513_0%,#111111_100%)]",
      )}
    >
      <MaterialPatina variant="plaque" className="rounded-[18px]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[16px] border border-white/[0.03]" />
      <span
        className={cn(
          "relative h-2.5 w-2.5 shrink-0 rounded-full border",
          isActive
            ? "border-[#d1a968] bg-[#c19756] shadow-[0_0_14px_rgba(193,151,86,0.2)]"
            : "border-[#71542b] bg-[#1a1613]",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
          能力域
        </div>
        <div className="mt-1 truncate text-sm font-semibold text-[var(--color-text)]">
          {domain.name}
        </div>
      </div>
      <div className="text-xs font-medium text-[#c9aa69]">{domain.progress}%</div>
      <div className="absolute inset-x-4 bottom-0 h-px bg-[linear-gradient(90deg,rgba(193,151,86,0),rgba(193,151,86,0.28),rgba(193,151,86,0))]" />
    </button>
  );
}

function SkillSigil({
  skill,
  isActive,
  align,
  onSelect,
}: {
  skill: GoldenPathNodeSnapshot;
  isActive: boolean;
  align: "left" | "right";
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group inline-flex max-w-full items-center gap-3 text-left transition-all",
        align === "left" && "xl:flex-row-reverse xl:text-right",
      )}
    >
      <span
        className={cn(
          "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all",
          getStateDotTone(skill.state, isActive),
        )}
      >
        {skill.state === "in_progress" ? (
          <span
            className={cn(
              "absolute inset-[-4px] rounded-full border",
              isActive ? "animate-pulse border-[#b98a43]/35" : "border-[#8d6730]/18 opacity-70",
            )}
          />
        ) : null}
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            skill.state === "in_progress" ? "bg-[#d7ba7e]" : "bg-current",
          )}
        />
      </span>

      <span
        className={cn(
          "relative inline-flex max-w-[min(100%,17rem)] items-center gap-2 overflow-hidden rounded-full border px-3 py-1.5 text-sm transition-all",
          getStateLabelTone(skill.state, isActive),
          isActive && "shadow-[0_18px_34px_-32px_rgba(193,151,86,0.35)]",
        )}
      >
        <MaterialPatina variant="sigil" className="rounded-full" />
        <span className="truncate">{skill.name}</span>
        {isActive ? (
          <span className="text-[10px] uppercase tracking-[0.16em] opacity-68">
            {getStateLabel(skill.state)}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function MiniDomainPreview({
  domain,
  isSelected,
}: {
  domain: GoldenPathDomainSnapshot;
  isSelected: boolean;
}) {
  const previewSkills = domain.nodes.slice().sort(sortSkills).slice(0, 3);

  return (
    <div className="relative">
      <div className="mx-auto h-4 w-px bg-[linear-gradient(180deg,rgba(193,151,86,0.35),rgba(193,151,86,0.04))]" />
      <div
        className={cn(
          "relative overflow-hidden rounded-[16px] border px-3 py-2.5",
          isSelected
            ? "border-[#5c4120]/80 bg-[linear-gradient(180deg,#18130f_0%,#100f0d_100%)]"
            : "border-[#2c251e]/80 bg-[linear-gradient(180deg,#141312_0%,#101011_100%)]",
        )}
      >
        <MaterialPatina variant="plaque" className="rounded-[16px]" />
        <div
          className={cn(
            "truncate text-xs font-semibold",
            isSelected ? "text-white" : "text-[var(--color-text)]",
          )}
        >
          {domain.name}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {previewSkills.map((skill) => (
            <span
              key={skill.id}
              className={cn("h-1.5 w-1.5 rounded-full border", getStateDotTone(skill.state))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TreeDomainBranch({
  domain,
  activeSkillId,
  isActive,
  side,
  onSelectDomain,
  onSelectSkill,
}: {
  domain: GoldenPathDomainSnapshot;
  activeSkillId: string | null;
  isActive: boolean;
  side: "left" | "right";
  onSelectDomain: () => void;
  onSelectSkill: (skillId: string) => void;
}) {
  const skills = [...domain.nodes].sort(sortSkills);

  return (
    <div className={cn("relative", side === "left" ? "xl:pr-7" : "xl:pl-7")}>
      <div
        className={cn(
          "absolute top-0 hidden h-7 w-px xl:block",
          side === "left" ? "right-8" : "left-8",
          "bg-[linear-gradient(180deg,rgba(193,151,86,0.32),rgba(193,151,86,0.04))]",
        )}
      />
      <div
        className={cn(
          "absolute top-[22px] hidden h-3 w-3 xl:block",
          side === "left" ? "right-[29px]" : "left-[29px]",
        )}
      >
        <span className="block h-full w-full rounded-full border border-[#7b5a2c]/55 bg-[#17120e]" />
      </div>
      <BranchCurve
        side={side}
        className={cn(
          "top-[15px] hidden xl:block",
          side === "left" ? "right-[31px]" : "left-[31px]",
        )}
      />

      <div className={cn("pt-7", side === "left" ? "xl:pr-10" : "xl:pl-10")}>
        <DomainPlaque domain={domain} isActive={isActive} align={side} onSelect={onSelectDomain} />
      </div>

      <div className={cn("relative mt-4", side === "left" ? "xl:pr-10" : "xl:pl-10")}>
        <div
          className={cn(
            "absolute top-1 bottom-4 w-px",
            side === "left"
              ? "left-[7px] xl:right-[18px] xl:left-auto"
              : "left-[7px] xl:left-[18px]",
            "bg-[linear-gradient(180deg,rgba(193,151,86,0.24),rgba(193,151,86,0.04))]",
          )}
        />
        <div className="space-y-2.5">
          {skills.map((skill, index) => (
            <div
              key={skill.id}
              className={cn(
                "relative flex pl-5 xl:pl-0",
                side === "left" ? "xl:justify-end" : "xl:justify-start",
                !isActive && index >= 2 && "hidden md:flex",
              )}
            >
              <BranchCurve
                side={side}
                className={cn(
                  "top-1/2 h-5 w-5 -translate-y-1/2",
                  side === "left"
                    ? "left-[3px] xl:right-[11px] xl:left-auto"
                    : "left-[3px] xl:left-[11px]",
                )}
              />
              <SkillSigil
                skill={skill}
                isActive={skill.id === activeSkillId}
                align={side}
                onSelect={() => onSelectSkill(skill.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RouteChoiceTree({
  route,
  isCurrent,
  isRecommended,
  isSelected,
  onSelect,
}: {
  route: GoldenPathRouteSnapshot;
  isCurrent: boolean;
  isRecommended: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative overflow-hidden border-y px-4 py-4 text-left transition-all",
        isSelected
          ? "border-[#7a5a2c]/70 bg-[radial-gradient(circle_at_top_left,rgba(180,134,62,0.12),transparent_34%),linear-gradient(180deg,#18130f_0%,#100d0b_100%)] text-white"
          : "border-[#29231b]/80 bg-[linear-gradient(180deg,#151413_0%,#101010_100%)] text-[var(--color-text)] hover:border-[#4a3820] hover:bg-[linear-gradient(180deg,#181716_0%,#111111_100%)]",
      )}
    >
      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.18em]">
        {isCurrent ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5",
              isSelected
                ? "border border-white/10 bg-white/[0.08] text-white/72"
                : "border border-white/8 bg-white/[0.04] text-[var(--color-text-secondary)]",
            )}
          >
            当前主线
          </span>
        ) : null}
        {isRecommended ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5",
              isSelected
                ? "border border-[#7a5a2c]/35 bg-[#7a5a2c]/18 text-[#d7ba7e]"
                : "border border-[#4b3820]/70 bg-[#181511] text-[#be9a5b]",
            )}
          >
            系统推荐
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-[19rem]">
          <div
            className={cn(
              "rounded-[20px] border px-4 py-4 text-center",
              isSelected
                ? "border-[#6a4b22]/80 bg-[radial-gradient(circle_at_top,rgba(193,151,86,0.12),transparent_38%),linear-gradient(180deg,#18130f_0%,#100d0b_100%)]"
                : "border-[#2e261e]/80 bg-[linear-gradient(180deg,#141312_0%,#101011_100%)]",
            )}
          >
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#b98a43]">主印</div>
            <div className="mt-2 text-lg font-semibold tracking-[-0.04em]">{route.name}</div>
            <div className="mt-3 text-xs opacity-68">{getRouteStageLabel(route)}</div>
          </div>

          <div className="mx-auto h-5 w-px bg-[linear-gradient(180deg,rgba(193,151,86,0.32),rgba(193,151,86,0.04))]" />

          <div className="grid gap-3 sm:grid-cols-2">
            {route.domains.map((domain) => (
              <MiniDomainPreview key={domain.id} domain={domain} isSelected={isSelected} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <div className="min-w-0 truncate opacity-70">{route.domains.length} 枝能力域</div>
        <div className="shrink-0 font-medium text-[#d7ba7e]">{route.progress}%</div>
      </div>
    </button>
  );
}

export function GoldenPathExplorer({ snapshot }: GoldenPathExplorerProps) {
  const { addToast } = useToast();
  const [currentRouteId, setCurrentRouteId] = useState(snapshot.currentRouteId);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(snapshot.selectedRouteId);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [candidateRouteId, setCandidateRouteId] = useState(snapshot.currentRouteId);
  const [isSaving, setIsSaving] = useState(false);

  const currentRoute =
    snapshot.routes.find((route) => route.id === currentRouteId) ??
    snapshot.routes.find((route) => route.id === snapshot.recommendedRouteId) ??
    snapshot.routes[0];

  const [activeDomainId, setActiveDomainId] = useState(currentRoute?.domains[0]?.id ?? "");
  const [activeSkillId, setActiveSkillId] = useState(getDefaultSkillId(currentRoute));

  const routeSkills = currentRoute ? getRouteSkills(currentRoute) : [];
  const activeSkill =
    routeSkills.find((skill) => skill.id === activeSkillId) ?? currentRoute?.nextActions[0] ?? null;
  const selectedDomain =
    currentRoute?.domains.find((domain) => domain.id === activeDomainId) ??
    currentRoute?.domains.find((domain) =>
      domain.nodes.some((skill) => skill.id === activeSkill?.id),
    ) ??
    currentRoute?.domains[0] ??
    null;
  const relatedLearning =
    activeSkill && currentRoute
      ? getSkillRelatedLearning(activeSkill, currentRoute.linkedLearning)
      : [];
  const focusCourse = relatedLearning[0];
  const focusChapter = focusCourse?.relatedChapters[0];
  const nextMove = currentRoute?.nextActions[0] ?? null;
  const nextMoveLearning =
    nextMove && currentRoute ? getSkillRelatedLearning(nextMove, currentRoute.linkedLearning) : [];
  const nextMoveCourse = nextMoveLearning[0];

  useEffect(() => {
    if (!currentRoute) {
      return;
    }

    const defaultSkillId = getDefaultSkillId(currentRoute);
    const defaultDomainId =
      currentRoute.domains.find((domain) =>
        domain.nodes.some((skill) => skill.id === defaultSkillId),
      )?.id ??
      currentRoute.domains[0]?.id ??
      "";

    setActiveSkillId(defaultSkillId);
    setActiveDomainId(defaultDomainId);
    setCandidateRouteId(currentRoute.id);
  }, [currentRoute]);

  if (!currentRoute) {
    return (
      <section className="ui-surface-card rounded-[32px] p-8">
        <p className="text-[var(--color-text-secondary)]">成长主线暂时还没有可展示的数据。</p>
      </section>
    );
  }

  const recommendedRoute =
    snapshot.routes.find((route) => route.id === snapshot.recommendedRouteId) ?? snapshot.routes[0];

  const selectDomainBranch = (domain: GoldenPathDomainSnapshot) => {
    setActiveDomainId(domain.id);
    const firstSkill = [...domain.nodes].sort(sortSkills)[0];
    if (firstSkill) {
      setActiveSkillId(firstSkill.id);
    }
  };

  const handleConfirmRoute = async () => {
    if (!candidateRouteId || isSaving) {
      return;
    }

    if (candidateRouteId === currentRouteId) {
      setIsChooserOpen(false);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/user/golden-path", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ routeId: candidateRouteId }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      setCurrentRouteId(candidateRouteId);
      setSelectedRouteId(candidateRouteId);
      setIsChooserOpen(false);
      addToast("已切换当前主线", "success");
    } catch {
      addToast("主线切换失败，请稍后重试", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-7" style={BLACK_GOLD_VARS}>
      <section className="border-b border-[#332516] pb-6 text-white">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[#b98a43]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#b98a43]" />
                成长主线
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
                {currentRoute.name}
              </h1>
            </div>

            <button
              type="button"
              onClick={() => setIsChooserOpen((current) => !current)}
              className="inline-flex items-center gap-2 border-b border-[#6d512c] pb-1 text-sm font-medium text-[#e1c489] transition-colors hover:text-[#f0e3cc]"
            >
              {isChooserOpen ? "收起候选树" : "切换主线"}
              <ArrowRight
                className={cn("h-4 w-4 transition-transform", isChooserOpen && "rotate-90")}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/68">
            <span>进度 {currentRoute.progress}%</span>
            <span>{getRouteStageLabel(currentRoute)}</span>
            {recommendedRoute && recommendedRoute.id !== currentRoute.id ? (
              <span className="text-[#d7ba7e]">系统推荐 {recommendedRoute.name}</span>
            ) : (
              <span className="text-[#d7ba7e]">当前与系统推荐一致</span>
            )}
            <span>{selectedRouteId ? "由你选定" : "当前跟随系统推荐"}</span>
          </div>
        </div>
      </section>

      {isChooserOpen ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden border-y border-[#2e2419] bg-[linear-gradient(180deg,#111111_0%,#0c0d0e_100%)]"
        >
          <div className="border-b border-[#2f2418] bg-[radial-gradient(circle_at_top_left,rgba(180,134,62,0.12),transparent_44%),linear-gradient(180deg,#171411_0%,#11100f_100%)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#b98a43]">
                  <Waypoints className="h-4 w-4" />
                  候选树谱
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                  从四棵候选树里选择当前主线
                </h2>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCandidateRouteId(currentRoute.id);
                    setIsChooserOpen(false);
                  }}
                  className="border-b border-white/10 pb-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmRoute()}
                  disabled={isSaving}
                  className={cn(
                    "border-b pb-1 text-sm font-medium transition-colors",
                    isSaving
                      ? "cursor-not-allowed border-white/8 text-white/35"
                      : "border-[#6d512c] text-[#f0e3cc] hover:text-[#e1c489]",
                  )}
                >
                  {isSaving ? "保存中..." : "设为当前主线"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-5 py-5 lg:grid-cols-2">
            {snapshot.routes.map((route) => (
              <RouteChoiceTree
                key={route.id}
                route={route}
                isCurrent={route.id === currentRoute.id}
                isRecommended={route.id === snapshot.recommendedRouteId}
                isSelected={route.id === candidateRouteId}
                onSelect={() => setCandidateRouteId(route.id)}
              />
            ))}
          </div>
        </motion.section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-[30px] border border-[#2e2419] bg-[linear-gradient(180deg,#111111_0%,#0c0d0e_100%)] shadow-[0_24px_56px_-40px_rgba(0,0,0,0.62)]">
            <AncientTreeBackdrop />
            <div className="relative z-10 border-b border-[#2f2418] bg-[radial-gradient(circle_at_top_left,rgba(180,134,62,0.12),transparent_44%),linear-gradient(180deg,#171411_0%,#11100f_100%)] px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#b98a43]">
                <Compass className="h-4 w-4" />
                主线技能树
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                {currentRoute.name}
              </h2>
            </div>

            <div className="relative z-10 space-y-5 px-5 py-5">
              <div className="flex justify-center">
                <RouteSeal route={currentRoute} />
              </div>

              <div className="flex justify-center">
                <div className="h-10 w-px bg-[linear-gradient(180deg,rgba(139,103,49,0.28),rgba(139,103,49,0.04))]" />
              </div>

              <div className="space-y-4 xl:hidden">
                {selectedDomain ? (
                  <TreeDomainBranch
                    domain={selectedDomain}
                    activeSkillId={activeSkill?.id ?? null}
                    isActive
                    side="right"
                    onSelectDomain={() => selectDomainBranch(selectedDomain)}
                    onSelectSkill={(skillId) => {
                      setActiveDomainId(selectedDomain.id);
                      setActiveSkillId(skillId);
                    }}
                  />
                ) : null}

                {currentRoute.domains.filter((domain) => domain.id !== selectedDomain?.id).length >
                0 ? (
                  <div className="space-y-3 border-t border-[#332516] pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.24em] text-[#b98a43]">
                          其余分支
                        </div>
                      </div>
                      <div className="border-b border-[#5c4120]/55 pb-1 text-[11px] uppercase tracking-[0.18em] text-white/48">
                        单枝展开
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {currentRoute.domains
                        .filter((domain) => domain.id !== selectedDomain?.id)
                        .map((domain) => (
                          <DomainPlaque
                            key={domain.id}
                            domain={domain}
                            isActive={false}
                            align="right"
                            onSelect={() => selectDomainBranch(domain)}
                          />
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="hidden gap-5 xl:grid xl:grid-cols-2">
                {currentRoute.domains.map((domain, index) => (
                  <TreeDomainBranch
                    key={domain.id}
                    domain={domain}
                    activeSkillId={activeSkill?.id ?? null}
                    isActive={domain.id === selectedDomain?.id}
                    side={index % 2 === 0 ? "left" : "right"}
                    onSelectDomain={() => selectDomainBranch(domain)}
                    onSelectSkill={(skillId) => {
                      setActiveDomainId(domain.id);
                      setActiveSkillId(skillId);
                    }}
                  />
                ))}
              </div>

              <div className="border-t border-[#332516] pt-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#b98a43]">
                      <Sparkles className="h-4 w-4" />
                      下一步
                    </div>
                    {nextMove ? (
                      <button
                        type="button"
                        onClick={() => setActiveSkillId(nextMove.id)}
                        className="mt-2 inline-flex items-center gap-2 text-left text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)] transition-colors hover:text-[#e1c489]"
                      >
                        {nextMove.name}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        暂无建议
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {nextMove ? (
                      <>
                        <span className="border-b border-[#5c4120]/55 pb-1 text-[var(--color-text-secondary)]">
                          {getStateLabel(nextMove.state)}
                        </span>
                        <span className="border-b border-[#5c4120]/55 pb-1 text-[var(--color-text-secondary)]">
                          {nextMove.progressScore}%
                        </span>
                        {nextMoveCourse ? (
                          <Link
                            href={`/learn/${nextMoveCourse.courseId}`}
                            className="border-b border-[#6d512c]/55 pb-1 text-[#d7ba7e] transition-colors hover:text-[#e1c489]"
                          >
                            {nextMoveCourse.title}
                          </Link>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="border-t border-[#2f2418] pt-5 xl:ml-auto xl:w-full xl:max-w-[15rem] xl:border-t-0 xl:border-l xl:pl-4 xl:pt-0">
          <motion.div
            key={activeSkill?.id ?? currentRoute.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="xl:sticky xl:top-24"
          >
            <div className="pb-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#b98a43]">
                <Target className="h-4 w-4" />
                焦点
              </div>
              {activeSkill ? (
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
                  {activeSkill.name}
                </h3>
              ) : (
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
                  {currentRoute.name}
                </h3>
              )}
            </div>

            <div className="space-y-4">
              {activeSkill ? (
                <>
                  <div className="space-y-2 border-y border-white/6 py-4 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--color-text-muted)]">状态</span>
                      <span className="text-[var(--color-text)]">
                        {getStateLabel(activeSkill.state)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--color-text-muted)]">进度</span>
                      <span className="text-[var(--color-text)]">{activeSkill.progressScore}%</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--color-text-muted)]">证据</span>
                      <span className="text-[var(--color-text)]">
                        {activeSkill.evidence.courseCount} 课 · {activeSkill.evidence.chapterCount}{" "}
                        章
                      </span>
                    </div>
                  </div>

                  {(activeSkill.prerequisites?.length ?? 0) > 0 ? (
                    <div>
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        <Lock className="h-4 w-4" />
                        前置
                      </div>
                      <div className="mt-3 space-y-2 border-t border-white/6 pt-3">
                        {activeSkill.prerequisites?.map((prerequisiteId) => {
                          const prerequisite = routeSkills.find(
                            (skill) => skill.id === prerequisiteId,
                          );

                          if (!prerequisite) {
                            return null;
                          }

                          return (
                            <button
                              key={prerequisite.id}
                              type="button"
                              onClick={() => setActiveSkillId(prerequisite.id)}
                              className={cn(
                                "inline-flex items-center gap-2 border-b pb-1 text-left text-xs transition-colors",
                                prerequisite.state === "mastered"
                                  ? "border-[#6d512c]/55 text-[#d7ba7e]"
                                  : "border-white/8 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
                              )}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current/80" />
                              {prerequisite.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {focusCourse ? (
                    <div>
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        <GraduationCap className="h-4 w-4" />
                        学习入口
                      </div>
                      <div className="mt-3 space-y-3 border-t border-white/6 pt-3">
                        <Link
                          href={`/learn/${focusCourse.courseId}`}
                          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-text)] transition-colors hover:text-[#d7ba7e]"
                        >
                          {focusCourse.title}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          {focusCourse.progressPercent}% · {formatDate(focusCourse.updatedAt)}
                        </div>
                        {focusChapter ? (
                          <Link
                            href={`/learn/${focusCourse.courseId}?chapter=${focusChapter.chapterIndex}`}
                            className="inline-flex items-center gap-2 border-b border-[#5c4120]/45 pb-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[#d7ba7e]"
                          >
                            第 {focusChapter.chapterIndex} 章 · {focusChapter.title}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="border-t border-dashed border-white/10 pt-4 text-xs text-[var(--color-text-secondary)]">
                  暂无焦点
                </div>
              )}
            </div>
          </motion.div>
        </aside>
      </section>
    </div>
  );
}
