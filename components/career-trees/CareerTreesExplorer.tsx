"use client";

import { ArrowRight, Compass, GitBranch, MessageCircle, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CareerTreeGraph } from "@/components/career-trees/CareerTreeGraph";
import { useToast } from "@/components/ui/Toast";
import {
  buildCareerDevelopmentGraph,
  type CareerRoleNode,
} from "@/lib/career-tree/career-development-graph";
import type {
  FocusSnapshotProjection,
  ProfileSnapshotProjection,
  VisibleTreeMetrics,
} from "@/lib/career-tree/projection-types";
import type {
  CareerNodeState,
  CareerTreeSnapshot,
  VisibleSkillTreeNode,
} from "@/lib/career-tree/types";
import {
  findDefaultFocusNode,
  findNodeById,
  flattenVisibleNodes,
  resolveCareerTreeDisplayState,
} from "@/lib/career-tree/view-model";
import { cn } from "@/lib/utils";

interface CareerTreesExplorerProps {
  snapshot: CareerTreeSnapshot;
  focusSnapshot: FocusSnapshotProjection | null;
  profileSnapshot: ProfileSnapshotProjection | null;
}

function getInitialDirectionKey(snapshot: CareerTreeSnapshot): string | null {
  return (
    snapshot.selectedDirectionKey ??
    snapshot.recommendedDirectionKey ??
    snapshot.trees[0]?.directionKey ??
    null
  );
}

function getStateLabel(state: CareerNodeState): string {
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

function getFutureRoleLabel(role: CareerRoleNode): string {
  if (role.source === "candidate_tree") {
    return "备选方向";
  }

  return role.horizon === "next" ? "下一阶段" : "后续职业";
}

function DirectionMetricStrip({ metrics }: { metrics: VisibleTreeMetrics }) {
  const items = [
    { label: "能力点", value: metrics.total },
    { label: "学习中", value: metrics.inProgress },
    { label: "平均进度", value: `${metrics.averageProgress}%` },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
        >
          {item.label} {item.value}
        </span>
      ))}
    </div>
  );
}

function FocusNodePanel({ node }: { node: VisibleSkillTreeNode | null }) {
  return (
    <article className="rounded-3xl border border-black/6 bg-white p-4">
      <p className="text-xs font-medium text-[var(--color-text-tertiary)]">当前焦点</p>
      <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)]">
        {node?.title ?? "等待学习信号"}
      </h2>
      <p className="mt-2 line-clamp-3 text-sm leading-7 text-[var(--color-text-secondary)]">
        {node?.summary ?? "完成更多章节后，会自动识别当前最该推进的能力点。"}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--color-text-secondary)]">
        <span>{node ? getStateLabel(node.state) : "未开始"}</span>
        <span>{node?.progress ?? 0}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-panel-soft)]">
        <div
          className="h-full rounded-full bg-[var(--color-panel-strong)]"
          style={{ width: `${node?.progress ?? 0}%` }}
        />
      </div>
    </article>
  );
}

function FutureCareerPanel({ careers }: { careers: CareerRoleNode[] }) {
  return (
    <article className="rounded-3xl border border-black/6 bg-white p-4">
      <p className="text-xs font-medium text-[var(--color-text-tertiary)]">可发展方向</p>
      <div className="mt-3 space-y-3">
        {careers.length > 0 ? (
          careers.slice(0, 3).map((career) => (
            <div key={career.key} className="rounded-2xl bg-[var(--color-panel-soft)] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-2 text-sm font-semibold leading-6 text-[var(--color-text)]">
                  {career.title}
                </h3>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] text-[var(--color-text-tertiary)]">
                  {getFutureRoleLabel(career)}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                {career.summary}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl bg-[var(--color-panel-soft)] px-3 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            当前先完成主树能力，后续方向会随学习进度更新。
          </p>
        )}
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <section className="ui-surface-card-lg overflow-hidden border border-black/6 p-6">
      <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
        <Compass className="h-4 w-4" />
        成长主线
      </div>
      <h1 className="mt-4 text-3xl font-semibold text-[var(--color-text)]">还没有可生成的职业树</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
        先完成课程访谈并保存课程大纲，职业方向会自动生成。
      </p>
      <div className="mt-6">
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

function PendingState() {
  return (
    <section className="ui-surface-card-lg overflow-hidden border border-black/6 p-6">
      <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
        <Sparkles className="h-4 w-4" />
        生成中
      </div>
      <h1 className="mt-4 text-3xl font-semibold text-[var(--color-text)]">职业树正在整理</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
        已保存的课程正在整理成候选职业方向，完成后可以查看。
      </p>
    </section>
  );
}

function CandidateDirectionPicker({
  snapshot,
  currentDirectionKey,
  isSaving,
  open,
  onClose,
  onSelectDirection,
}: {
  snapshot: CareerTreeSnapshot;
  currentDirectionKey: string | null;
  isSaving: boolean;
  open: boolean;
  onClose: () => void;
  onSelectDirection: (directionKey: string) => void;
}) {
  if (!open || snapshot.trees.length <= 1) {
    return null;
  }

  return (
    <section className="ui-surface-card relative z-20 mb-5 overflow-hidden border border-black/6 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
            <GitBranch className="h-3.5 w-3.5" />
            切换方向
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
            当前方向会影响焦点、下一阶段和职业树读法。
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-black/8 bg-[var(--color-panel-soft)] p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-active)] hover:text-[var(--color-text)]"
          onClick={onClose}
        >
          <span className="sr-only">关闭主树选择</span>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.trees.map((tree) => {
          const active = tree.directionKey === currentDirectionKey;
          const nodeCount = flattenVisibleNodes(tree.tree).length;
          const recommended = tree.directionKey === snapshot.recommendedDirectionKey;

          return (
            <button
              key={tree.directionKey}
              type="button"
              className={cn(
                "group flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                active
                  ? "border-black/14 bg-[var(--color-panel-strong)] text-[var(--color-panel-strong-fg)]"
                  : "border-black/6 bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)] hover:bg-[var(--color-active)] hover:text-[var(--color-text)]",
              )}
              disabled={isSaving && !active}
              onClick={() => {
                onSelectDirection(tree.directionKey);
                onClose();
              }}
            >
              <span
                aria-hidden
                className={cn(
                  "h-2.5 w-2.5 shrink-0 rounded-full border",
                  active
                    ? "border-white/40 bg-white"
                    : "border-black/12 bg-[var(--color-text-muted)]",
                )}
              />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium tracking-[-0.03em]">
                    {tree.title}
                  </span>
                  <span className="mt-0.5 block text-[10px] opacity-70">
                    {tree.supportingCourses.length}门课 · {tree.supportingChapters.length}节 ·{" "}
                    {nodeCount}能力
                  </span>
                </span>
                {active || recommended ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-1 text-[10px]",
                      active
                        ? "border-white/24 bg-white/10 text-white"
                        : "border-black/8 bg-white text-[var(--color-text-secondary)]",
                    )}
                  >
                    {active ? "当前" : "推荐"}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function CareerTreesExplorer({
  snapshot,
  focusSnapshot,
  profileSnapshot,
}: CareerTreesExplorerProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [currentDirectionKey, setCurrentDirectionKey] = useState<string | null>(
    getInitialDirectionKey(snapshot),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [directionPickerOpen, setDirectionPickerOpen] = useState(false);

  const displayState = useMemo(
    () =>
      resolveCareerTreeDisplayState({
        snapshot,
        directionKey: currentDirectionKey,
        focusSnapshot,
        profileSnapshot,
      }),
    [currentDirectionKey, focusSnapshot, profileSnapshot, snapshot],
  );
  const currentTree = displayState?.currentTree ?? null;
  const developmentGraph = useMemo(
    () => buildCareerDevelopmentGraph(snapshot, currentTree?.directionKey ?? currentDirectionKey),
    [currentDirectionKey, currentTree?.directionKey, snapshot],
  );

  const activeNode = useMemo(
    () => (currentTree ? findNodeById(currentTree.tree, activeNodeId) : null),
    [activeNodeId, currentTree],
  );

  const preferredFocusNode = useMemo(
    () => displayState?.preferredFocusNode ?? null,
    [displayState],
  );

  useEffect(() => {
    if (
      currentDirectionKey &&
      snapshot.trees.some((tree) => tree.directionKey === currentDirectionKey)
    ) {
      return;
    }

    setCurrentDirectionKey(getInitialDirectionKey(snapshot));
  }, [currentDirectionKey, snapshot]);

  useEffect(() => {
    setActiveNodeId(preferredFocusNode?.id ?? null);
  }, [preferredFocusNode?.id]);

  if (snapshot.status === "empty") {
    return <EmptyState />;
  }

  if (snapshot.status === "pending") {
    return <PendingState />;
  }

  if (!displayState || !currentTree || !developmentGraph) {
    return <PendingState />;
  }

  const resolvedDisplayState = displayState;
  const focusNode = activeNode ?? findDefaultFocusNode(currentTree.tree);
  const metrics = resolvedDisplayState.metrics;

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

  const handleOpenCareerChat = () => {
    const prompt = currentTree
      ? `按我当前的职业树方向“${currentTree.title}”，帮我分析最该先补的差距，以及下一步先学什么。`
      : "按我当前的职业树，帮我分析最该先补的差距，以及下一步先学什么。";

    const query = new URLSearchParams({
      context: "career",
      msg: prompt,
    });

    if (currentTree?.directionKey) {
      query.set("directionKey", currentTree.directionKey);
    }

    router.push(`/chat/${crypto.randomUUID()}?${query.toString()}`);
  };

  return (
    <div className="ui-surface-card-lg relative overflow-hidden border border-black/6 p-4 md:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(180deg, color-mix(in oklch, var(--color-panel-soft) 72%, transparent), transparent 34%)",
        }}
      />
      <section className="relative z-10 mb-4 flex flex-col gap-3 px-1 md:mb-5 md:flex-row md:items-end md:justify-between md:px-2">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-[var(--color-text-tertiary)]">当前方向</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text)] md:text-4xl">
            {resolvedDisplayState.displayDirection.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
            {resolvedDisplayState.displayDirection.summary}
          </p>
          <div className="mt-4">
            <DirectionMetricStrip metrics={metrics} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="ui-soft-button inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors"
            onClick={handleOpenCareerChat}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            聊聊这个方向
          </button>
          {snapshot.trees.length > 1 ? (
            <button
              type="button"
              className="ui-soft-button rounded-full px-3 py-1.5 transition-colors"
              onClick={() => setDirectionPickerOpen((open) => !open)}
            >
              切换主树
            </button>
          ) : null}
          {isSaving ? (
            <span className="text-[var(--color-text-secondary)]">正在保存选择</span>
          ) : null}
        </div>
      </section>

      <CandidateDirectionPicker
        snapshot={snapshot}
        currentDirectionKey={currentTree.directionKey}
        isSaving={isSaving}
        open={directionPickerOpen}
        onClose={() => setDirectionPickerOpen(false)}
        onSelectDirection={(directionKey) => void handleSelectDirection(directionKey)}
      />

      <section className="relative z-10 grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <CareerTreeGraph
          graph={developmentGraph}
          activeNodeId={focusNode?.id ?? null}
          onSelectNode={setActiveNodeId}
          variant="full"
          className="min-h-[34rem]"
        />
        <aside className="grid gap-4 self-start md:grid-cols-2 xl:grid-cols-1">
          <FocusNodePanel node={focusNode} />
          <FutureCareerPanel careers={developmentGraph.futureCareers} />
        </aside>
      </section>
    </div>
  );
}
