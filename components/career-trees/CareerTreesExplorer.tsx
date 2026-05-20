"use client";

import {
  ArrowLeft,
  ArrowRight,
  Compass,
  GitBranch,
  Loader2,
  MessageCircle,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
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
  metrics,
  isSaving,
  onSelectDirection,
}: {
  snapshot: CareerTreeSnapshot;
  currentDirectionKey: string;
  metrics: VisibleTreeMetrics;
  isSaving: boolean;
  onSelectDirection: (directionKey: string) => void;
}) {
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
            成长主线
          </h1>
          <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
            按真实学习信号整理方向、能力和下一步。
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <MetricTile label="进度" value={`${metrics.averageProgress}%`} />
          <MetricTile label="能力" value={metrics.total} />
        </div>
      </div>

      <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 flex items-center justify-between px-1 text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
          <span>方向</span>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        </div>

        <div className="space-y-1.5">
          {snapshot.trees.map((tree) => {
            const active = tree.directionKey === currentDirectionKey;
            const recommended = tree.directionKey === snapshot.recommendedDirectionKey;

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
                    {tree.title}
                  </span>
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

function TreeHeader({
  title,
  summary,
  generatedAt,
  onOpenCareerChat,
}: {
  title: string;
  summary: string;
  generatedAt: string | null;
  onOpenCareerChat: () => void;
}) {
  return (
    <div className="border-b border-black/[0.04] bg-white/82 px-4 pb-4 pt-4 backdrop-blur-xl md:px-6 md:pb-5 md:pt-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
            <GitBranch className="h-3.5 w-3.5" />
            能力地图
          </div>
          <h2 className="mt-2 line-clamp-2 text-2xl font-semibold leading-tight tracking-[-0.05em] text-[var(--color-text)] md:text-3xl">
            {title}
          </h2>
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            {summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--color-text-tertiary)]">
            {formatGeneratedAt(generatedAt)}
          </span>
          <button
            type="button"
            onClick={onOpenCareerChat}
            className="ui-primary-button inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            讨论方向
          </button>
        </div>
      </div>
    </div>
  );
}

function FocusPanel({
  node,
  metrics,
  futureCareers,
  onOpenCareerChat,
}: {
  node: VisibleSkillTreeNode | null;
  metrics: VisibleTreeMetrics;
  futureCareers: CareerRoleNode[];
  onOpenCareerChat: () => void;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-white/72 safe-top safe-bottom">
      <div className="border-b border-black/[0.04] px-4 pb-5 pt-5 lg:px-5">
        <div className="text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
          当前焦点
        </div>
        <h2 className="mt-3 line-clamp-3 text-[1rem] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-text)]">
          {node?.title ?? "等待更多学习信号"}
        </h2>
        <p className="mt-3 line-clamp-4 text-xs leading-5 text-[var(--color-text-secondary)]">
          {node?.summary ?? "完成更多课程内容后，这里会自动显示最该推进的能力。"}
        </p>

        <div className="mt-5 flex items-center justify-between text-[0.6875rem] text-[var(--color-text-tertiary)]">
          <span>{node ? getStateLabel(node.state) : "未开始"}</span>
          <span>{node?.progress ?? 0}%</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="h-full rounded-full bg-[var(--color-panel-strong)] transition-[width] duration-500"
            style={{ width: `${node?.progress ?? 0}%` }}
          />
        </div>
      </div>

      <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-5">
        <div className="grid grid-cols-2 gap-2">
          <MetricTile label="已掌握" value={metrics.mastered} />
          <MetricTile label="学习中" value={metrics.inProgress} />
          <MetricTile label="可开始" value={metrics.ready} />
          <MetricTile label="待解锁" value={metrics.locked} />
        </div>

        <div className="mt-5 space-y-2">
          <div className="text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
            下一步
          </div>
          <button
            type="button"
            onClick={onOpenCareerChat}
            className="flex w-full items-center justify-between gap-3 rounded-[22px] bg-[var(--color-panel-soft)] px-4 py-3 text-left text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-active)]"
          >
            分析差距和下一步
            <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)]" />
          </button>
          <Link
            href="/interview"
            className="flex w-full items-center justify-between gap-3 rounded-[22px] bg-white/70 px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white hover:text-[var(--color-text)]"
          >
            生成新课程
            <PlayCircle className="h-4 w-4 text-[var(--color-text-muted)]" />
          </Link>
        </div>

        <div className="mt-5 space-y-2">
          <div className="text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
            可发展方向
          </div>
          {futureCareers.length > 0 ? (
            futureCareers.slice(0, 3).map((career) => (
              <article key={career.key} className="rounded-[22px] bg-white/70 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-6 text-[var(--color-text)]">
                    {career.title}
                  </h3>
                  <span className="shrink-0 rounded-full bg-[var(--color-panel-soft)] px-2 py-1 text-[0.625rem] text-[var(--color-text-tertiary)]">
                    {getFutureRoleLabel(career)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                  {career.summary}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-[22px] bg-white/70 px-4 py-4 text-sm leading-6 text-[var(--color-text-secondary)]">
              先推进当前焦点，后续方向会随学习进度更新。
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

function StateShell({
  icon,
  eyebrow,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1180px] items-center px-4 py-8 md:px-6">
      <section className="w-full rounded-[32px] border border-black/[0.06] bg-white/86 p-6 shadow-[0_24px_76px_-58px_rgba(15,23,42,0.32)] backdrop-blur-xl md:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)]">
          {icon}
        </div>
        <div className="mt-6 text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
          {eyebrow}
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text)] md:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          {description}
        </p>
        <div className="mt-6">{action}</div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <StateShell
      icon={<Compass className="h-5 w-5" />}
      eyebrow="成长主线"
      title="还没有可用职业树"
      description="先完成课程访谈并保存课程大纲，系统会根据课程和笔记整理出候选方向。"
      action={
        <Link
          href="/interview"
          className="ui-primary-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
        >
          开始课程访谈
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    />
  );
}

function PendingState() {
  return (
    <StateShell
      icon={<Sparkles className="h-5 w-5" />}
      eyebrow="整理中"
      title="职业树正在整理"
      description="已保存的课程正在整理成候选方向，完成后会在这里显示主线、能力焦点和下一阶段建议。"
      action={
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-panel-soft)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-active)]"
        >
          返回个人中心
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    />
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

  const focusNode = activeNode ?? findDefaultFocusNode(currentTree.tree);
  const metrics = displayState.metrics;

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

  const handleOpenCareerChat = () => {
    const prompt = `按我当前的职业树方向“${currentTree.title}”，帮我分析最该先补的差距，以及下一步先学什么。`;
    const query = new URLSearchParams({
      context: "career",
      directionKey: currentTree.directionKey,
      msg: prompt,
    });

    router.push(`/chat/${crypto.randomUUID()}?${query.toString()}`);
  };

  const handleSelectCareer = (directionKey: string) => {
    if (snapshot.trees.some((tree) => tree.directionKey === directionKey)) {
      void handleSelectDirection(directionKey);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1640px] flex-col gap-3 p-3 lg:grid lg:h-dvh lg:grid-cols-[16rem_minmax(0,1fr)_19rem] lg:gap-4 lg:p-4 xl:grid-cols-[288px_minmax(0,1fr)_320px]">
      <div className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/78 shadow-[0_22px_64px_-48px_rgba(15,23,42,0.28)] backdrop-blur-xl lg:min-h-0">
        <DirectionRail
          snapshot={snapshot}
          currentDirectionKey={currentTree.directionKey}
          metrics={metrics}
          isSaving={isSaving}
          onSelectDirection={(directionKey) => void handleSelectDirection(directionKey)}
        />
      </div>

      <main className="min-h-0 min-w-0 overflow-hidden rounded-[30px] border border-black/[0.04] bg-white/94 shadow-[0_24px_76px_-58px_rgba(15,23,42,0.32)]">
        <div className="flex h-full min-h-0 flex-col bg-white/72">
          <TreeHeader
            title={displayState.displayDirection.title}
            summary={displayState.displayDirection.summary}
            generatedAt={snapshot.generatedAt}
            onOpenCareerChat={handleOpenCareerChat}
          />
          <div className="mobile-scroll min-h-[28rem] flex-1 overflow-auto p-3 md:p-4">
            <CareerTreeGraph
              graph={developmentGraph}
              activeNodeId={focusNode?.id ?? null}
              onSelectCareer={handleSelectCareer}
              onSelectNode={setActiveNodeId}
              variant="full"
              className="min-h-[36rem]"
            />
          </div>
        </div>
      </main>

      <div className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/82 shadow-[0_22px_64px_-50px_rgba(15,23,42,0.3)] backdrop-blur-xl lg:min-h-0">
        <FocusPanel
          node={focusNode}
          metrics={metrics}
          futureCareers={developmentGraph.futureCareers}
          onOpenCareerChat={handleOpenCareerChat}
        />
      </div>
    </div>
  );
}
