"use client";

import { ArrowRight, Compass, GitBranch, MessageCircle, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CAREER_TREE_BLACK_GOLD_VARS,
  CareerTreeGraph,
} from "@/components/career-trees/CareerTreeGraph";
import { useToast } from "@/components/ui/Toast";
import { buildCareerDevelopmentGraph } from "@/lib/career-tree/career-development-graph";
import type {
  FocusSnapshotProjection,
  ProfileSnapshotProjection,
} from "@/lib/career-tree/projection-types";
import type { CareerTreeSnapshot } from "@/lib/career-tree/types";
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
        已保存的课程正在整理成候选职业方向，完成后会出现在这里。
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
    <section className="relative z-20 mb-5 overflow-hidden rounded-[1.75rem] border border-[#4b3218]/80 bg-[radial-gradient(circle_at_50%_0%,rgba(216,172,88,0.14),transparent_36%),linear-gradient(180deg,rgba(13,10,7,0.98),rgba(5,4,3,0.98))] p-4 shadow-[0_24px_70px_-44px_rgba(0,0,0,0.9),inset_0_0_30px_rgba(216,172,88,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#b98a43]">
            <GitBranch className="h-3.5 w-3.5" />
            选择主树
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#d8c39a]/72">
            选择一个职业方向作为当前主树，树内会展示它自己的后续职业。
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-[#4b3218]/80 bg-black/24 p-2 text-[#c7ae78]/80 transition-colors hover:border-[#d8ac58]/60 hover:text-[#f4dfad]"
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
                  ? "border-[#d8ac58]/72 bg-[#d8ac58]/12 text-[#f4dfad]"
                  : "border-[#3b2a17]/80 bg-black/20 text-[#c7ae78]/78 hover:border-[#9c7238]/72 hover:text-[#f2e5cd]",
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
                  "h-2.5 w-2.5 shrink-0 rounded-full border shadow-[0_0_14px_rgba(216,172,88,0.28)]",
                  active ? "border-[#f0d28b] bg-[#d8ac58]" : "border-[#9c7238]/70 bg-[#0f0b07]",
                )}
              />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium tracking-[-0.03em]">
                    {tree.title}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-[#9f8a66]/80">
                    {tree.supportingCourses.length}门课 · {tree.supportingChapters.length}节 ·{" "}
                    {nodeCount}能力
                  </span>
                </span>
                {active || recommended ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-1 text-[10px]",
                      active
                        ? "border-[#d8ac58]/60 bg-[#d8ac58]/14 text-[#f4dfad]"
                        : "border-[#5a3c1d]/80 bg-black/20 text-[#b98a43]",
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

  if (!currentTree || !developmentGraph) {
    return <PendingState />;
  }

  const focusNode = activeNode ?? findDefaultFocusNode(currentTree.tree);

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
    <div
      className="relative overflow-hidden rounded-[2.75rem] border border-[#2e2419] bg-[radial-gradient(circle_at_50%_-12%,rgba(206,151,65,0.2),transparent_34%),radial-gradient(circle_at_8%_18%,rgba(117,74,31,0.22),transparent_30%),linear-gradient(180deg,#0d0b08_0%,#050403_100%)] p-4 text-white shadow-[0_38px_110px_-58px_rgba(0,0,0,0.92)] md:p-6"
      style={CAREER_TREE_BLACK_GOLD_VARS}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 0 44%, rgba(216,172,88,0.1) 45%, transparent 46% 100%), radial-gradient(circle at 50% 0%, rgba(255,231,171,0.24), transparent 30%)",
        }}
      />
      <section className="relative z-10 mb-4 flex flex-col gap-3 px-1 text-white md:mb-5 md:flex-row md:items-end md:justify-between md:px-2">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#b98a43]">
            <Compass className="h-3.5 w-3.5" />
            Career Tree
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.055em] text-[#f4dfad] md:text-5xl">
            职业发展树
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#c7ae78]/76">
          <span>当前主树</span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[#4b3218]/80 bg-black/18 px-3 py-1.5 text-[#e1c489] transition-colors hover:border-[#d8ac58]/60 hover:text-[#f4dfad]"
            onClick={handleOpenCareerChat}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            聊聊这个方向
          </button>
          {snapshot.trees.length > 1 ? (
            <button
              type="button"
              className="rounded-full border border-[#4b3218]/80 bg-black/18 px-3 py-1.5 text-[#e1c489] transition-colors hover:border-[#d8ac58]/60 hover:text-[#f4dfad]"
              onClick={() => setDirectionPickerOpen((open) => !open)}
            >
              切换主树
            </button>
          ) : null}
          {isSaving ? <span className="text-[#e1c489]">正在保存选择</span> : null}
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

      <section className="relative z-10">
        <CareerTreeGraph
          graph={developmentGraph}
          activeNodeId={focusNode?.id ?? null}
          onSelectNode={setActiveNodeId}
          variant="full"
          className="min-h-[34rem]"
        />
      </section>
    </div>
  );
}
