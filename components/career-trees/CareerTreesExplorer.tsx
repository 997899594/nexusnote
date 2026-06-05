"use client";

import { ArrowLeft, GitBranch, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CareerPlanningMentorPanel } from "@/components/career-trees/CareerPlanningMentorPanel";
import { CareerTreeGraph } from "@/components/career-trees/CareerTreeGraph";
import { useToast } from "@/components/ui/Toast";
import type { CareerGraphPatch } from "@/lib/ai/career-planning/schemas";
import type { CareerPlanningWorkspaceData } from "@/lib/career-planning/workspace-data";
import {
  buildCareerDevelopmentGraph,
  type CareerDevelopmentGraph,
} from "@/lib/career-tree/career-development-graph";
import type {
  FocusSnapshotProjection,
  ProfileSnapshotProjection,
  VisibleTreeMetrics,
} from "@/lib/career-tree/projection-types";
import type {
  CareerTreeSnapshot,
  SupportingCourseRef,
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
  planningData: CareerPlanningWorkspaceData;
}

const EMPTY_PLANNING_HIGHLIGHTS: string[] = [];

interface CourseChoiceState {
  node: VisibleSkillTreeNode;
  courses: SupportingCourseRef[];
}

function getInitialDirectionKey(snapshot: CareerTreeSnapshot): string | null {
  return (
    snapshot.selectedDirectionKey ??
    snapshot.recommendedDirectionKey ??
    snapshot.trees[0]?.directionKey ??
    null
  );
}

function formatGeneratedAt(value: string | null): string {
  if (!value) {
    return "刚刚更新";
  }

  return new Date(value).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[20px] bg-white/70 px-3 py-3">
      <div className="text-[0.625rem] font-medium text-[var(--color-text-tertiary)]">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-[-0.05em] text-[var(--color-text)]">
        {value}
      </div>
    </div>
  );
}

function DirectionRail({
  snapshot,
  currentDirectionKey,
  developmentGraph,
  metrics,
  isSaving,
  onSelectDirection,
}: {
  snapshot: CareerTreeSnapshot;
  currentDirectionKey: string;
  developmentGraph: CareerDevelopmentGraph;
  metrics: VisibleTreeMetrics;
  isSaving: boolean;
  onSelectDirection: (directionKey: string) => void;
}) {
  const roleByDirectionKey = new Map(
    [developmentGraph.currentCareer, ...developmentGraph.futureCareers]
      .filter((role) => role.source === "current_tree" || role.source === "candidate_tree")
      .map((role) => [role.key, role]),
  );

  return (
    <aside className="flex h-full min-h-0 flex-col bg-white/72 safe-top safe-bottom">
      <div className="border-b border-black/[0.04] px-4 pb-5 pt-5 lg:px-5">
        <Link
          href="/profile"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text)]"
          aria-label="返回个人中心"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </Link>

        <div className="mt-5">
          <div className="mb-2 text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
            职业树
          </div>
          <h1 className="text-[1rem] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-text)]">
            职业目标
          </h1>
          <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
            课程证据驱动下一步。
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <MetricTile label="能力覆盖" value={`${metrics.averageProgress}%`} />
          <MetricTile label="能力" value={metrics.total} />
        </div>
      </div>

      <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 flex items-center justify-between px-1 text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
          <span>目标</span>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        </div>

        <div className="space-y-1.5">
          {snapshot.trees.map((tree) => {
            const active = tree.directionKey === currentDirectionKey;
            const recommended = tree.directionKey === snapshot.recommendedDirectionKey;
            const role = roleByDirectionKey.get(tree.directionKey);
            const title = role?.title ?? tree.title;
            const routeTitle = role?.routeTitle;

            return (
              <button
                key={tree.directionKey}
                type="button"
                onClick={() => onSelectDirection(tree.directionKey)}
                disabled={isSaving && !active}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-[20px] px-3 py-3 text-left transition-colors",
                  active
                    ? "bg-[var(--color-panel-soft)] text-[var(--color-text)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    active ? "bg-[var(--color-panel-strong)]" : "bg-black/[0.12]",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold tracking-[-0.02em]">
                    {title}
                  </span>
                  {routeTitle ? (
                    <span className="mt-1 block truncate text-[0.6875rem] text-[var(--color-text-muted)]">
                      {routeTitle}
                    </span>
                  ) : null}
                  <span className="mt-1 block text-[0.6875rem] text-[var(--color-text-muted)]">
                    {tree.supportingCourses.length} 门课 · {flattenVisibleNodes(tree.tree).length}{" "}
                    个能力
                  </span>
                </span>
                {active || recommended ? (
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[0.625rem] text-[var(--color-text-secondary)]">
                    {active ? "当前" : "推荐"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function MobileDirectionStrip({
  snapshot,
  currentDirectionKey,
  developmentGraph,
  isSaving,
  onSelectDirection,
}: {
  snapshot: CareerTreeSnapshot;
  currentDirectionKey: string;
  developmentGraph: CareerDevelopmentGraph;
  isSaving: boolean;
  onSelectDirection: (directionKey: string) => void;
}) {
  const roleByDirectionKey = new Map(
    [developmentGraph.currentCareer, ...developmentGraph.futureCareers]
      .filter((role) => role.source === "current_tree" || role.source === "candidate_tree")
      .map((role) => [role.key, role]),
  );

  return (
    <div className="mobile-scroll flex gap-2 overflow-x-auto px-4 py-3 md:px-6 lg:hidden">
      {snapshot.trees.map((tree) => {
        const active = tree.directionKey === currentDirectionKey;
        const recommended = tree.directionKey === snapshot.recommendedDirectionKey;
        const role = roleByDirectionKey.get(tree.directionKey);

        return (
          <button
            key={tree.directionKey}
            type="button"
            onClick={() => onSelectDirection(tree.directionKey)}
            disabled={isSaving && !active}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
              active
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-black/[0.08] bg-white text-[var(--color-text-secondary)]",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                active ? "bg-white" : "bg-[var(--color-text-tertiary)]",
              )}
            />
            <span className="max-w-[12rem] truncate">{role?.title ?? tree.title}</span>
            {recommended && !active ? (
              <span className="text-[0.625rem] text-[var(--color-text-muted)]">推荐</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function TreeHeader({
  title,
  summary,
  routeTitle,
  generatedAt,
}: {
  title: string;
  summary: string;
  routeTitle: string | null;
  generatedAt: string | null;
}) {
  return (
    <div className="border-b border-black/[0.04] bg-white/82 px-4 pb-4 pt-4 backdrop-blur-xl md:px-6 md:pb-5 md:pt-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
            <GitBranch className="h-3.5 w-3.5" />
            职业目标
          </div>
          <h2 className="mt-2 line-clamp-2 text-2xl font-semibold leading-tight tracking-[-0.05em] text-[var(--color-text)] md:text-3xl">
            {title}
          </h2>
          {routeTitle ? (
            <div className="mt-1 text-xs font-medium text-[var(--color-text-muted)]">
              {routeTitle}
            </div>
          ) : null}
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            {summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--color-text-tertiary)]">
            {formatGeneratedAt(generatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function CourseChoicePanel({
  choice,
  onClose,
}: {
  choice: CourseChoiceState;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-4 bottom-4 z-30 w-[min(22rem,calc(100%-2rem))] rounded-[24px] border border-black/[0.08] bg-white/95 p-3 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3 px-1 pb-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-[-0.02em] text-[var(--color-text)]">
            {choice.node.title}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">选择课程</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-xs text-[var(--color-text-tertiary)] transition-colors hover:bg-slate-100 hover:text-[var(--color-text)]"
        >
          关闭
        </button>
      </div>
      <div className="space-y-1.5">
        {choice.courses.map((course) => (
          <Link
            key={course.courseId}
            href={`/learn/${course.courseId}`}
            className="block rounded-[16px] border border-black/[0.06] bg-white px-3 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-slate-300 hover:text-[var(--color-text)]"
          >
            {course.title}
          </Link>
        ))}
      </div>
    </div>
  );
}

function EmptyWorkbench({ planningData }: { planningData: CareerPlanningWorkspaceData }) {
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-white">
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="ui-page-frame safe-top flex shrink-0 items-center gap-4 pb-4 pt-5 md:pb-5 md:pt-6">
          <Link
            href="/profile"
            className="ui-control-surface rounded-xl p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
            aria-label="返回个人中心"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-semibold text-[var(--color-text)]">职业规划导师</h1>
          </div>
        </header>

        <CareerPlanningMentorPanel
          data={planningData}
          selectedDirectionKey={null}
          variant="workspace"
        />
      </section>
    </div>
  );
}

export function CareerTreesExplorer({
  snapshot,
  focusSnapshot,
  profileSnapshot,
  planningData,
}: CareerTreesExplorerProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [currentDirectionKey, setCurrentDirectionKey] = useState<string | null>(
    getInitialDirectionKey(snapshot),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [courseChoice, setCourseChoice] = useState<CourseChoiceState | null>(null);
  const [activePlanningPatch, setActivePlanningPatch] = useState<CareerGraphPatch | null>(
    planningData.planningState?.graphPatch ?? null,
  );

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
  const preferredFocusNode = displayState?.preferredFocusNode ?? null;
  const planningHighlightNodeIds =
    activePlanningPatch?.highlightNodeIds ?? EMPTY_PLANNING_HIGHLIGHTS;

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

  useEffect(() => {
    setActivePlanningPatch(planningData.planningState?.graphPatch ?? null);
  }, [planningData.planningState?.graphPatch]);

  if (snapshot.status === "empty" || snapshot.status === "pending") {
    return <EmptyWorkbench planningData={planningData} />;
  }

  if (!displayState || !currentTree || !developmentGraph) {
    return <EmptyWorkbench planningData={planningData} />;
  }

  const focusNode = activeNode ?? findDefaultFocusNode(currentTree.tree);
  const metrics = displayState.metrics;
  const displayCareer = developmentGraph.currentCareer;

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

      addToast("已切换当前方向", "success");
    } catch {
      setCurrentDirectionKey(previous);
      addToast("方向切换失败，请稍后重试", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectCareer = (directionKey: string) => {
    if (snapshot.trees.some((tree) => tree.directionKey === directionKey)) {
      void handleSelectDirection(directionKey);
    }
  };

  const handleSelectNode = (node: VisibleSkillTreeNode) => {
    setActiveNodeId(node.id);
    setCourseChoice(null);

    const courses = node.supportingCourses ?? [];
    if (courses.length === 1) {
      router.push(`/learn/${courses[0].courseId}`);
      return;
    }

    if (courses.length > 1) {
      setCourseChoice({ node, courses });
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1640px] flex-col gap-3 p-3 lg:grid lg:h-dvh lg:grid-cols-[16rem_minmax(0,1fr)_22rem] lg:gap-4 lg:p-4 xl:grid-cols-[288px_minmax(0,1fr)_380px]">
      <div className="hidden overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/78 shadow-[0_22px_64px_-48px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:block lg:min-h-0">
        <DirectionRail
          snapshot={snapshot}
          currentDirectionKey={currentTree.directionKey}
          developmentGraph={developmentGraph}
          metrics={metrics}
          isSaving={isSaving}
          onSelectDirection={(directionKey) => void handleSelectDirection(directionKey)}
        />
      </div>

      <main className="min-h-0 min-w-0 overflow-hidden rounded-[30px] border border-black/[0.04] bg-white/94 shadow-[0_24px_76px_-58px_rgba(15,23,42,0.32)]">
        <div className="flex h-full min-h-0 flex-col bg-white/72">
          <TreeHeader
            title={displayCareer.title}
            summary={displayCareer.summary}
            routeTitle={displayCareer.routeTitle}
            generatedAt={snapshot.generatedAt}
          />
          <MobileDirectionStrip
            snapshot={snapshot}
            currentDirectionKey={currentTree.directionKey}
            developmentGraph={developmentGraph}
            isSaving={isSaving}
            onSelectDirection={(directionKey) => void handleSelectDirection(directionKey)}
          />
          <div className="mobile-scroll relative min-h-[30rem] flex-1 overflow-visible p-3 md:p-4 lg:min-h-[28rem]">
            <CareerTreeGraph
              graph={developmentGraph}
              activeNodeId={focusNode?.id ?? null}
              onSelectCareer={handleSelectCareer}
              onSelectNode={handleSelectNode}
              planningHighlightNodeIds={planningHighlightNodeIds}
              variant="compact"
              className="h-full min-h-[30rem] lg:hidden"
            />
            <CareerTreeGraph
              graph={developmentGraph}
              activeNodeId={focusNode?.id ?? null}
              onSelectCareer={handleSelectCareer}
              onSelectNode={handleSelectNode}
              planningHighlightNodeIds={planningHighlightNodeIds}
              variant="full"
              className="hidden h-full min-h-[34rem] lg:block"
            />
            {courseChoice ? (
              <CourseChoicePanel choice={courseChoice} onClose={() => setCourseChoice(null)} />
            ) : null}
          </div>
        </div>
      </main>

      <div className="min-h-[38rem] overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/82 shadow-[0_22px_64px_-50px_rgba(15,23,42,0.3)] backdrop-blur-xl lg:min-h-0">
        <CareerPlanningMentorPanel
          data={planningData}
          onPatchChange={setActivePlanningPatch}
          selectedDirectionKey={currentTree.directionKey}
        />
      </div>
    </div>
  );
}
