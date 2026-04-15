"use client";

import { motion } from "framer-motion";
import { ArrowRight, Compass, GraduationCap, Sparkles, Target, Waypoints } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { KnowledgeInsightStrip } from "@/components/knowledge/KnowledgeInsightStrip";
import { useToast } from "@/components/ui/Toast";
import type {
  FocusSnapshotProjection,
  ProfileSnapshotProjection,
} from "@/lib/growth/projection-types";
import type { CareerTreeSnapshot, VisibleSkillTreeNode } from "@/lib/growth/types";
import {
  countVisibleTreeMetrics,
  findDefaultFocusNode,
  findNodeById,
  getTreeByDirectionKey,
  resolveProjectedFocusNode,
} from "@/lib/growth/view-model";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import { cn } from "@/lib/utils";

interface CareerTreesExplorerProps {
  snapshot: CareerTreeSnapshot;
  insights: KnowledgeInsight[];
  focusSnapshot: FocusSnapshotProjection | null;
  profileSnapshot: ProfileSnapshotProjection | null;
}

const BLACK_GOLD_VARS = {
  "--color-text": "#eee4d2",
  "--color-text-secondary": "rgba(238,228,210,0.76)",
  "--color-text-tertiary": "rgba(238,228,210,0.56)",
  "--color-text-muted": "rgba(180,134,62,0.7)",
  "--color-hover": "rgba(255,255,255,0.06)",
} as CSSProperties;

function getInitialDirectionKey(snapshot: CareerTreeSnapshot): string | null {
  return (
    snapshot.selectedDirectionKey ??
    snapshot.recommendedDirectionKey ??
    snapshot.trees[0]?.directionKey ??
    null
  );
}

function getStateLabel(state: VisibleSkillTreeNode["state"]): string {
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

function getStateTone(state: VisibleSkillTreeNode["state"], active = false): string {
  switch (state) {
    case "mastered":
      return active ? "text-[#e1c489] border-[#6d512c]" : "text-[#c6a160] border-[#4e3920]";
    case "in_progress":
      return active ? "text-[#efe3cb] border-[#8d6730]" : "text-[#dfc7a0] border-[#624821]";
    case "ready":
      return active
        ? "text-[var(--color-text)] border-[#6c5940]"
        : "text-[var(--color-text-secondary)] border-[#41382f]";
    case "locked":
      return active
        ? "text-[var(--color-text-secondary)] border-[#343231]"
        : "text-[var(--color-text-tertiary)] border-[#2a292b]";
  }
}

function TreeNodeLine({
  node,
  depth,
  activeNodeId,
  onSelect,
}: {
  node: VisibleSkillTreeNode;
  depth: number;
  activeNodeId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const isActive = node.id === activeNodeId;

  return (
    <div className="relative">
      {depth > 0 ? (
        <div
          aria-hidden
          className="absolute left-0 top-0 h-full border-l border-[#332516]/80"
          style={{ marginLeft: `${(depth - 1) * 1.15 + 0.35}rem` }}
        />
      ) : null}
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "group relative flex w-full items-start gap-3 border-b border-white/6 py-3 text-left transition-colors",
          isActive && "bg-white/[0.02]",
        )}
        style={{ paddingLeft: `${depth * 1.15}rem` }}
      >
        <span
          className={cn(
            "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border",
            getStateTone(node.state, isActive),
            node.state === "mastered" && "bg-current",
            node.state !== "mastered" && "bg-transparent",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                isActive ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]",
              )}
            >
              {node.title}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {node.progress}% · {getStateLabel(node.state)}
            </span>
          </div>
          <div className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{node.summary}</div>
        </div>
      </button>
      {node.children.length > 0 ? (
        <div>
          {node.children.map((child) => (
            <TreeNodeLine
              key={child.id}
              node={child}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="overflow-hidden rounded-[30px] border border-[#2e2419] bg-[linear-gradient(180deg,#111111_0%,#0c0d0e_100%)] p-6 text-white">
      <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[#b98a43]">
        <Compass className="h-4 w-4" />
        成长主线
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">还没有可生成的职业树</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68">
        先完成课程访谈并保存课程大纲，系统才会开始长出候选职业方向。
      </p>
      <div className="mt-6">
        <Link
          href="/interview"
          className="inline-flex items-center gap-2 border-b border-[#6d512c] pb-1 text-sm font-medium text-[#e1c489] transition-colors hover:text-[#f0e3cc]"
        >
          开始课程访谈
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function PendingState() {
  return (
    <section className="overflow-hidden rounded-[30px] border border-[#2e2419] bg-[linear-gradient(180deg,#111111_0%,#0c0d0e_100%)] p-6 text-white">
      <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[#b98a43]">
        <Sparkles className="h-4 w-4" />
        生成中
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">职业树正在整理</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68">
        已经检测到课程证据，系统正在合并隐藏能力分支并组织候选职业方向。
      </p>
    </section>
  );
}

export function CareerTreesExplorer({
  snapshot,
  insights,
  focusSnapshot,
  profileSnapshot,
}: CareerTreesExplorerProps) {
  const { addToast } = useToast();
  const [currentDirectionKey, setCurrentDirectionKey] = useState<string | null>(
    getInitialDirectionKey(snapshot),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const currentTree = useMemo(
    () =>
      getTreeByDirectionKey(snapshot, currentDirectionKey) ??
      getTreeByDirectionKey(snapshot, snapshot.recommendedDirectionKey) ??
      snapshot.trees[0] ??
      null,
    [currentDirectionKey, snapshot],
  );

  const currentMetrics = useMemo(
    () => (currentTree ? countVisibleTreeMetrics(currentTree.tree) : null),
    [currentTree],
  );

  const activeNode = useMemo(
    () => (currentTree ? findNodeById(currentTree.tree, activeNodeId) : null),
    [activeNodeId, currentTree],
  );

  const preferredFocusNode = useMemo(() => {
    if (!currentTree) {
      return null;
    }

    const profileFocus =
      profileSnapshot?.currentDirection?.directionKey === currentTree.directionKey
        ? profileSnapshot.focus
        : null;
    const projectedFocus =
      focusSnapshot?.directionKey === currentTree.directionKey
        ? (focusSnapshot.node ?? {
            id: focusSnapshot.nodeId,
            anchorRef: focusSnapshot.anchorRef,
          })
        : null;

    return (
      resolveProjectedFocusNode(currentTree.tree, profileFocus ?? projectedFocus) ??
      findDefaultFocusNode(currentTree.tree)
    );
  }, [currentTree, focusSnapshot, profileSnapshot]);

  useEffect(() => {
    setActiveNodeId(preferredFocusNode?.id ?? null);
  }, [preferredFocusNode?.id]);

  if (snapshot.status === "empty") {
    return <EmptyState />;
  }

  if (snapshot.status === "pending") {
    return <PendingState />;
  }

  if (!currentTree) {
    return <PendingState />;
  }

  const focusNode = activeNode ?? findDefaultFocusNode(currentTree.tree);
  const displayDirectionKey = currentTree.directionKey;

  const handleSelectDirection = async (directionKey: string) => {
    if (directionKey === currentDirectionKey || isSaving) {
      setCurrentDirectionKey(directionKey);
      return;
    }

    const previous = currentDirectionKey;
    setCurrentDirectionKey(directionKey);
    setIsSaving(true);

    try {
      const response = await fetch("/api/user/career-trees", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ selectedDirectionKey: directionKey }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      addToast("已切换当前职业树", "success");
    } catch {
      setCurrentDirectionKey(previous);
      addToast("职业树切换失败，请稍后重试", "error");
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
                <Compass className="h-4 w-4" />
                成长主线
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
                {currentTree.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68">
                {currentTree.summary}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/68">
            <span>置信度 {Math.round(currentTree.confidence * 100)}%</span>
            <span>节点 {currentMetrics?.total ?? 0}</span>
            <span>平均进度 {currentMetrics?.averageProgress ?? 0}%</span>
            {snapshot.recommendedDirectionKey === displayDirectionKey ? (
              <span className="text-[#d7ba7e]">AI 推荐</span>
            ) : null}
            {snapshot.selectedDirectionKey === displayDirectionKey ? (
              <span className="text-[#d7ba7e]">当前偏好</span>
            ) : null}
          </div>

          <div className="max-w-3xl border-l border-[#5c4120]/60 pl-4 text-sm leading-7 text-[#d9ccb7]">
            {currentTree.whyThisDirection}
          </div>
        </div>
      </section>

      {insights.length > 0 ? (
        <section className="space-y-3 border-b border-[#2f2418] pb-6">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#b98a43]">成长信号</div>
          <KnowledgeInsightStrip insights={insights} />
        </section>
      ) : null}

      <section className="overflow-hidden border-y border-[#2e2419] bg-[linear-gradient(180deg,#111111_0%,#0c0d0e_100%)]">
        <div className="border-b border-[#2f2418] px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#b98a43]">
            <Waypoints className="h-4 w-4" />
            候选方向
          </div>
        </div>
        <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.trees.map((tree) => {
            const isCurrent = tree.directionKey === displayDirectionKey;
            const isRecommended = tree.directionKey === snapshot.recommendedDirectionKey;
            const isSelected = tree.directionKey === snapshot.selectedDirectionKey;

            return (
              <button
                key={tree.directionKey}
                type="button"
                onClick={() => void handleSelectDirection(tree.directionKey)}
                className={cn(
                  "border-b border-r border-[#2e2419] px-5 py-4 text-left transition-colors",
                  isCurrent
                    ? "bg-[radial-gradient(circle_at_top_left,rgba(180,134,62,0.12),transparent_34%),linear-gradient(180deg,#17120f_0%,#100d0b_100%)]"
                    : "bg-[linear-gradient(180deg,#111111_0%,#0d0d0e_100%)] hover:bg-[linear-gradient(180deg,#151413_0%,#101010_100%)]",
                )}
              >
                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-[#b98a43]">
                  {isCurrent ? <span>当前</span> : null}
                  {isRecommended ? <span>推荐</span> : null}
                  {isSelected ? <span>偏好</span> : null}
                </div>
                <div className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                  {tree.title}
                </div>
                <div className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {tree.summary}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-tertiary)]">
                  <span>{Math.round(tree.confidence * 100)}%</span>
                  <span>{tree.supportingCourses.length} 门课</span>
                  <span>{tree.supportingChapters.length} 个章节</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-[30px] border border-[#2e2419] bg-[linear-gradient(180deg,#111111_0%,#0c0d0e_100%)] shadow-[0_24px_56px_-40px_rgba(0,0,0,0.62)]">
            <div className="relative z-10 border-b border-[#2f2418] px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#b98a43]">
                <Compass className="h-4 w-4" />
                职业树
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                {currentTree.title}
              </h2>
            </div>

            <div className="relative z-10 px-5 py-5">
              <div className="space-y-1">
                {currentTree.tree.map((node) => (
                  <TreeNodeLine
                    key={node.id}
                    node={node}
                    depth={0}
                    activeNodeId={focusNode?.id ?? null}
                    onSelect={setActiveNodeId}
                  />
                ))}
              </div>

              <div className="mt-5 border-t border-[#332516] pt-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#b98a43]">
                      <Sparkles className="h-4 w-4" />
                      下一步
                    </div>
                    {focusNode ? (
                      <button
                        type="button"
                        onClick={() => setActiveNodeId(focusNode.id)}
                        className="mt-2 inline-flex items-center gap-2 text-left text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)] transition-colors hover:text-[#e1c489]"
                      >
                        {focusNode.title}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        暂无建议
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {focusNode ? (
                      <>
                        <span className="border-b border-[#5c4120]/55 pb-1 text-[var(--color-text-secondary)]">
                          {getStateLabel(focusNode.state)}
                        </span>
                        <span className="border-b border-[#5c4120]/55 pb-1 text-[var(--color-text-secondary)]">
                          {focusNode.progress}%
                        </span>
                        {currentTree.supportingCourses[0] ? (
                          <Link
                            href={`/learn/${currentTree.supportingCourses[0].courseId}`}
                            className="border-b border-[#6d512c]/55 pb-1 text-[#d7ba7e] transition-colors hover:text-[#e1c489]"
                          >
                            {currentTree.supportingCourses[0].title}
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
            key={focusNode?.id ?? currentTree.directionKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="xl:sticky xl:top-24"
          >
            <div className="pb-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#b98a43]">
                <Target className="h-4 w-4" />
                焦点
              </div>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
                {focusNode?.title ?? currentTree.title}
              </h3>
            </div>

            {focusNode ? (
              <div className="space-y-4">
                <div className="space-y-2 border-y border-white/6 py-4 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--color-text-muted)]">状态</span>
                    <span className="text-[var(--color-text)]">
                      {getStateLabel(focusNode.state)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--color-text-muted)]">进度</span>
                    <span className="text-[var(--color-text)]">{focusNode.progress}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--color-text-muted)]">子枝</span>
                    <span className="text-[var(--color-text)]">{focusNode.children.length}</span>
                  </div>
                </div>

                {currentTree.supportingCourses[0] ? (
                  <div>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      <GraduationCap className="h-4 w-4" />
                      学习入口
                    </div>
                    <div className="mt-3 space-y-3 border-t border-white/6 pt-3">
                      <Link
                        href={`/learn/${currentTree.supportingCourses[0].courseId}`}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-text)] transition-colors hover:text-[#d7ba7e]"
                      >
                        {currentTree.supportingCourses[0].title}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      {currentTree.supportingChapters[0] ? (
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          第 {currentTree.supportingChapters[0].chapterIndex} 章 ·{" "}
                          {currentTree.supportingChapters[0].title}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="border-t border-dashed border-white/10 pt-4 text-xs text-[var(--color-text-secondary)]">
                暂无焦点
              </div>
            )}
          </motion.div>
        </aside>
      </section>
    </div>
  );
}
