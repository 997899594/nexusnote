import { ArrowRight, Compass, Sparkles } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { VisibleTreeMetrics } from "@/lib/growth/projection-types";
import type {
  CandidateCareerTree,
  GrowthNodeState,
  VisibleSkillTreeNode,
} from "@/lib/growth/types";
import {
  flattenVisibleNodes,
  getCurrentGrowthTree,
  resolveGrowthDisplayState,
} from "@/lib/growth/view-model";
import { getGrowthWorkspaceDataCached } from "@/lib/growth/workspace-data";

interface ProfileCareerTreeSummaryProps {
  userId: string;
}

const PROFILE_CAREER_TREE_STYLE = {
  "--color-text": "#f2e5cd",
  "--color-text-secondary": "rgba(242,229,205,0.74)",
  "--color-text-tertiary": "rgba(242,229,205,0.5)",
  "--color-text-muted": "rgba(191,139,59,0.76)",
  "--color-hover": "rgba(239,205,135,0.08)",
} as CSSProperties;

const MAX_PROFILE_SKILLS = 4;
const MAX_FUTURE_DIRECTIONS = 2;

function getStateLabel(state: GrowthNodeState): string {
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

function getStateRank(state: GrowthNodeState): number {
  switch (state) {
    case "in_progress":
      return 0;
    case "ready":
      return 1;
    case "mastered":
      return 2;
    case "locked":
      return 3;
  }
}

function getProfileSkillHighlights(
  tree: CandidateCareerTree,
  focus: VisibleSkillTreeNode | null,
): VisibleSkillTreeNode[] {
  const nodesById = new Map<string, VisibleSkillTreeNode>();

  if (focus) {
    nodesById.set(focus.id, focus);
  }

  for (const node of flattenVisibleNodes(tree.tree)
    .filter((node) => node.id !== focus?.id)
    .sort((left, right) => {
      const stateDiff = getStateRank(left.state) - getStateRank(right.state);
      if (stateDiff !== 0) {
        return stateDiff;
      }

      return right.progress - left.progress;
    })) {
    nodesById.set(node.id, node);
    if (nodesById.size >= MAX_PROFILE_SKILLS) {
      break;
    }
  }

  return [...nodesById.values()];
}

function getFutureDirections(snapshotTrees: CandidateCareerTree[], currentDirectionKey: string) {
  return snapshotTrees
    .filter((tree) => tree.directionKey !== currentDirectionKey)
    .slice(0, MAX_FUTURE_DIRECTIONS);
}

function MetricLine({ metrics, confidence }: { metrics: VisibleTreeMetrics; confidence: number }) {
  const items = [
    `平均进度 ${metrics.averageProgress}%`,
    `能力点 ${metrics.total}`,
    `学习中 ${metrics.inProgress}`,
    `置信度 ${Math.round(confidence * 100)}%`,
  ];

  return (
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-[#2f2418] py-3 text-xs text-[var(--color-text-tertiary)] md:text-sm">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function CareerRouteLine({
  currentTitle,
  futureDirections,
}: {
  currentTitle: string;
  futureDirections: CandidateCareerTree[];
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-[#2a2016] bg-[#0a0908]/78 px-4 py-4 md:px-5">
      <div className="pointer-events-none absolute inset-x-5 top-[3.15rem] hidden h-px bg-[linear-gradient(90deg,rgba(239,205,135,0.74),rgba(107,79,39,0.42),transparent)] md:block" />
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr] md:items-start">
        <div className="relative">
          <div className="mb-3 h-3 w-3 rotate-45 border border-[#f0d28b] bg-[#15100a] shadow-[0_0_22px_rgba(232,184,88,0.42)]" />
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#b98a43]">当前方向</p>
          <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[#f3dfad]">
            {currentTitle}
          </h3>
        </div>

        {futureDirections.length > 0 ? (
          futureDirections.map((tree) => (
            <div
              key={tree.directionKey}
              className="relative border-l border-[#3a2a18] pl-4 md:border-0 md:pl-0"
            >
              <div className="mb-3 h-2.5 w-2.5 rotate-45 border border-[#8c6632] bg-[#0d0b08]" />
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#8f6a38]">可发展</p>
              <h3 className="mt-2 text-sm font-medium leading-6 text-[#d8c191]">{tree.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#9a886d]">{tree.summary}</p>
            </div>
          ))
        ) : (
          <div className="relative border-l border-[#3a2a18] pl-4 md:col-span-2 md:border-0 md:pl-0">
            <div className="mb-3 h-2.5 w-2.5 rotate-45 border border-[#8c6632] bg-[#0d0b08]" />
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#8f6a38]">下一步</p>
            <h3 className="mt-2 text-sm font-medium leading-6 text-[#d8c191]">
              继续完成课程后，新的职业方向会自然长出来。
            </h3>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillHighlightList({ skills }: { skills: VisibleSkillTreeNode[] }) {
  if (skills.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[1.5rem] border border-[#2a2016] bg-[#080807]/72">
      <div className="flex items-center justify-between border-b border-[#2a2016] px-4 py-3 md:px-5">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#b98a43]">关键能力</p>
        <p className="text-xs text-[#8f806c]">来自当前职业树</p>
      </div>
      <div className="divide-y divide-[#241b12]">
        {skills.map((skill, index) => (
          <div
            key={skill.id}
            className="grid gap-3 px-4 py-3 md:grid-cols-[2.25rem_1fr_auto] md:px-5"
          >
            <div className="flex h-8 w-8 items-center justify-center border border-[#4b351b] bg-[#100d09] text-xs tabular-nums text-[#d8ac58]">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className="text-sm font-semibold leading-6 text-[#f0ddae]">{skill.title}</h4>
                <span className="text-xs text-[#9f8d72]">{getStateLabel(skill.state)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#a8977b]">{skill.summary}</p>
            </div>
            <div className="min-w-[7.5rem] md:text-right">
              <div className="font-mono text-sm text-[#e4c177]">{skill.progress}%</div>
              <div className="mt-2 h-px bg-[#2c2117]">
                <div
                  className="h-px bg-[linear-gradient(90deg,#9b6d31,#f0d28b)]"
                  style={{ width: `${skill.progress}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function ProfileCareerTreeSummary({ userId }: ProfileCareerTreeSummaryProps) {
  const { snapshot, profileSnapshot, focusSnapshot } = await getGrowthWorkspaceDataCached(
    userId,
    0,
  );

  if (snapshot.status === "empty") {
    return (
      <section className="ui-surface-card-lg rounded-3xl p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              <Compass className="h-4 w-4" />
              成长主线
            </div>
            <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)] md:text-2xl">
              还没有形成稳定职业树
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--color-text-tertiary)]">
              先通过访谈生成课程，系统才会逐步识别你的成长主线和候选职业方向。
            </p>
          </div>
          <Link
            href="/interview"
            className="ui-primary-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            开始课程访谈
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  if (snapshot.status === "pending") {
    return (
      <section className="ui-surface-card-lg rounded-3xl p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              <Sparkles className="h-4 w-4" />
              生成中
            </div>
            <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)] md:text-2xl">
              正在整理职业方向
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--color-text-tertiary)]">
              已保存的课程会被整理成候选职业树，完成后可以直接查看。
            </p>
          </div>
          <Link
            href="/career-trees"
            className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
          >
            查看生成进度
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  const currentTree = getCurrentGrowthTree(snapshot);
  if (!currentTree) {
    return null;
  }

  const displayState = resolveGrowthDisplayState({
    snapshot,
    directionKey: currentTree.directionKey,
    focusSnapshot,
    profileSnapshot,
  });

  if (!displayState) {
    return null;
  }

  const { displayDirection, metrics, preferredFocusNode: focus } = displayState;
  const futureDirections = getFutureDirections(snapshot.trees, currentTree.directionKey);
  const skillHighlights = getProfileSkillHighlights(currentTree, focus);

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-[#2e2419] bg-[radial-gradient(circle_at_12%_10%,rgba(204,149,64,0.18),transparent_28%),linear-gradient(180deg,#111111_0%,#08090a_100%)] p-5 text-white md:p-7"
      style={PROFILE_CAREER_TREE_STYLE}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 0 48%, rgba(216,172,88,0.12) 49%, transparent 50% 100%)",
        }}
      />
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#b98a43]">
            <Compass className="h-4 w-4" />
            职业树
          </div>
          <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)] md:text-2xl">
            {displayDirection.title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
            {displayDirection.summary}
          </p>
        </div>

        <Link
          href="/career-trees"
          className="inline-flex items-center gap-2 whitespace-nowrap border-b border-[#6d512c]/70 pb-1 text-sm font-medium text-[#e1c489] transition-colors hover:text-[#f0e3cc]"
        >
          查看完整职业树
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="relative z-10 mt-5 grid gap-4">
        <CareerRouteLine
          currentTitle={displayDirection.title}
          futureDirections={futureDirections}
        />
        <SkillHighlightList skills={skillHighlights} />
      </div>

      <div className="relative z-10">
        <MetricLine metrics={metrics} confidence={displayDirection.confidence} />
      </div>
    </section>
  );
}
