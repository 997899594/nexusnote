import { ArrowRight, Compass, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  buildCareerDevelopmentGraph,
  type CareerRoleNode,
} from "@/lib/career-tree/career-development-graph";
import type { VisibleTreeMetrics } from "@/lib/career-tree/projection-types";
import type { CareerNodeState } from "@/lib/career-tree/types";
import { getCurrentCareerTree, resolveCareerTreeDisplayState } from "@/lib/career-tree/view-model";
import { getCareerTreeWorkspaceDataCached } from "@/lib/career-tree/workspace-data";

interface ProfileCareerTreeSummaryProps {
  userId: string;
}

const MAX_FUTURE_CAREERS = 2;

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

function MetricLine({ metrics }: { metrics: VisibleTreeMetrics }) {
  const items = [
    { label: "平均进度", value: `${metrics.averageProgress}%` },
    { label: "能力点", value: metrics.total },
    { label: "学习中", value: metrics.inProgress },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-[var(--color-panel-soft)] px-3 py-3">
          <div className="text-[11px] text-[var(--color-text-tertiary)]">{item.label}</div>
          <div className="mt-1 text-lg font-semibold tracking-[-0.04em] text-[var(--color-text)]">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function NextCareerCard({ futureCareers }: { futureCareers: CareerRoleNode[] }) {
  const primaryFutureCareer = futureCareers[0] ?? null;

  return (
    <div className="rounded-2xl border border-black/6 bg-white px-4 py-4">
      <p className="text-[11px] text-[var(--color-text-tertiary)]">
        {primaryFutureCareer ? getFutureRoleLabel(primaryFutureCareer) : "下一步"}
      </p>
      <h3 className="mt-2 text-base font-semibold text-[var(--color-text)]">
        {primaryFutureCareer?.title ?? "继续学习当前课程"}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        {primaryFutureCareer?.summary ?? "完成更多章节后，职业树会更新下一阶段方向。"}
      </p>
    </div>
  );
}

function FocusCard({
  focus,
}: {
  focus: {
    title: string;
    summary: string;
    progress: number;
    state: CareerNodeState;
  } | null;
}) {
  return (
    <div className="rounded-2xl border border-black/6 bg-white px-4 py-4">
      <p className="text-[11px] text-[var(--color-text-tertiary)]">当前焦点</p>
      <h3 className="mt-2 text-base font-semibold text-[var(--color-text)]">
        {focus?.title ?? "等待更多学习信号"}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        {focus
          ? `${getStateLabel(focus.state)} · ${focus.progress}%`
          : "完成课程后会自动生成焦点。"}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-panel-soft)]">
        <div
          className="h-full rounded-full bg-[var(--color-panel-strong)]"
          style={{ width: `${focus?.progress ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export async function ProfileCareerTreeSummary({ userId }: ProfileCareerTreeSummaryProps) {
  const { snapshot, profileSnapshot, focusSnapshot } = await getCareerTreeWorkspaceDataCached(
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
              先通过访谈生成课程，成长主线和候选职业方向会逐步形成。
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
            查看职业树
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  const currentTree = getCurrentCareerTree(snapshot);
  if (!currentTree) {
    return null;
  }

  const displayState = resolveCareerTreeDisplayState({
    snapshot,
    directionKey: currentTree.directionKey,
    focusSnapshot,
    profileSnapshot,
  });

  if (!displayState) {
    return null;
  }

  const { displayDirection, metrics, preferredFocusNode: focus } = displayState;
  const developmentGraph = buildCareerDevelopmentGraph(snapshot, currentTree.directionKey);
  const futureCareers = (developmentGraph?.futureCareers ?? []).slice(0, MAX_FUTURE_CAREERS);

  return (
    <section className="ui-surface-card-lg border border-black/6 p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--color-text-tertiary)]">职业树</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
            {displayDirection.title}
          </h2>
        </div>
        <Link
          href="/career-trees"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:text-[var(--color-text-secondary)]"
        >
          查看职业树
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-7 text-[var(--color-text-secondary)]">
        {displayDirection.summary}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <FocusCard focus={focus} />
        <NextCareerCard futureCareers={futureCareers} />
      </div>

      <div className="mt-3">
        <MetricLine metrics={metrics} />
      </div>
    </section>
  );
}
