import { ArrowRight, Compass, GraduationCap, Sparkles } from "lucide-react";
import Link from "next/link";
import { getCareerTreeSnapshotCached } from "@/lib/career-tree/snapshot";
import type { CandidateCareerTree, VisibleSkillTreeNode } from "@/lib/career-tree/types";

interface ProfileGoldenPathSummaryProps {
  userId: string;
}

function flattenNodes(nodes: VisibleSkillTreeNode[]): VisibleSkillTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function getCurrentTree(snapshot: Awaited<ReturnType<typeof getCareerTreeSnapshotCached>>) {
  return (
    snapshot.trees.find((tree) => tree.directionKey === snapshot.selectedDirectionKey) ??
    snapshot.trees.find((tree) => tree.directionKey === snapshot.recommendedDirectionKey) ??
    snapshot.trees[0] ??
    null
  );
}

function getTreeMetrics(tree: CandidateCareerTree) {
  const nodes = flattenNodes(tree.tree);
  const inProgress = nodes.filter((node) => node.state === "in_progress").length;
  const mastered = nodes.filter((node) => node.state === "mastered").length;
  const nextFocus =
    nodes.find((node) => node.state === "in_progress") ??
    nodes.find((node) => node.state === "ready") ??
    null;
  const averageProgress =
    nodes.length > 0
      ? Math.round(nodes.reduce((sum, node) => sum + node.progress, 0) / nodes.length)
      : 0;

  return {
    inProgress,
    mastered,
    nextFocus,
    averageProgress,
  };
}

export async function ProfileGoldenPathSummary({ userId }: ProfileGoldenPathSummaryProps) {
  const snapshot = await getCareerTreeSnapshotCached(userId);

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
            className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
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
              AI 正在整理职业方向
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--color-text-tertiary)]">
              课程证据已经入场，系统正在合并隐藏能力分支并组织候选职业树。
            </p>
          </div>
          <Link
            href="/golden-path"
            className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
          >
            查看生成进度
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  const currentTree = getCurrentTree(snapshot);
  if (!currentTree) {
    return null;
  }

  const metrics = getTreeMetrics(currentTree);

  return (
    <section className="ui-surface-card-lg rounded-3xl p-5 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            <Compass className="h-4 w-4" />
            成长主线
          </div>
          <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)] md:text-2xl">
            {currentTree.title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--color-text-tertiary)]">
            {currentTree.summary}
          </p>
        </div>

        <Link
          href="/golden-path"
          className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
        >
          查看职业树
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-black/6 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fa_100%)] p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                当前进度
              </p>
              <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                {metrics.averageProgress}%
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--color-panel-soft)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              {currentTree.supportingCourses.length} 门支持课程
            </div>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--color-hover)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#111827_0%,#6b7280_100%)]"
              style={{ width: `${Math.max(8, metrics.averageProgress)}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
            <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5">
              学习中 {metrics.inProgress}
            </span>
            <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5">
              已掌握 {metrics.mastered}
            </span>
            <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5">
              置信度 {Math.round(currentTree.confidence * 100)}%
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-black/6 bg-[var(--color-panel-soft)] p-4 md:p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            <GraduationCap className="h-4 w-4" />
            下一步落点
          </div>
          <div className="mt-4 space-y-3">
            {metrics.nextFocus ? (
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[var(--color-text-secondary)]">
                  <GraduationCap className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--color-text)]">
                    {metrics.nextFocus.title}
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    当前进度 {metrics.nextFocus.progress}%
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                暂时还没有明确的下一步焦点。
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
