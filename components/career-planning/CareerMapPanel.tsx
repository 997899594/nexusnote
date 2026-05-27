"use client";

import { ArrowRight, BookOpen, Compass, GitBranch, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { CareerMapDraft } from "@/lib/ai/career-planning/schemas";
import type {
  CareerPlanningRoute,
  CareerPlanningSignal,
  CareerPlanningSkillGap,
  CareerPlanningWorkspaceData,
} from "@/lib/career-planning/workspace-data";
import type { CareerNodeState } from "@/lib/career-tree/types";
import { cn } from "@/lib/utils";

interface CareerMapPanelProps {
  data: CareerPlanningWorkspaceData;
  activeRouteKey?: string | null;
  draft?: CareerMapDraft | null;
  headerAction?: ReactNode;
  onSelectRoute?: (directionKey: string) => void;
  className?: string;
}

const SOURCE_LABELS: Record<CareerPlanningSignal["source"], string> = {
  course: "课程",
  skill_tree: "职业树",
  insight: "洞察",
};

const DRAFT_SOURCE_LABELS: Record<CareerMapDraft["observations"][number]["source"], string> = {
  course: "课程",
  skill_tree: "职业树",
  insight: "洞察",
  interview: "访谈",
};

function getStateLabel(state: CareerNodeState): string {
  switch (state) {
    case "mastered":
      return "已掌握";
    case "in_progress":
      return "学习中";
    case "ready":
      return "可开始";
    case "locked":
      return "待补齐";
  }
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-[var(--color-panel-soft)] px-3 py-3">
      <div className="text-[0.625rem] font-medium text-[var(--color-text-tertiary)]">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-[-0.05em] text-[var(--color-text)]">
        {value}
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: CareerPlanningSignal }) {
  return (
    <article className="rounded-[22px] border border-black/[0.04] bg-white/72 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
          {signal.label}
        </p>
        <span className="rounded-full bg-[var(--color-panel-soft)] px-2 py-1 text-[0.625rem] text-[var(--color-text-tertiary)]">
          {SOURCE_LABELS[signal.source]}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--color-text)]">
        {signal.value}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
        {signal.detail}
      </p>
    </article>
  );
}

function SkillRow({ node }: { node: CareerPlanningSkillGap }) {
  return (
    <div className="rounded-2xl bg-white/74 px-3 py-2.5 ring-1 ring-black/[0.04]">
      <div className="flex items-center justify-between gap-3">
        <p className="line-clamp-1 text-sm font-medium text-[var(--color-text)]">{node.title}</p>
        <span className="shrink-0 text-[0.625rem] text-[var(--color-text-tertiary)]">
          {getStateLabel(node.state)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-panel-soft)]">
        <div
          className="h-full rounded-full bg-[var(--color-panel-strong)]"
          style={{ width: `${node.progress}%` }}
        />
      </div>
    </div>
  );
}

function RouteCard({
  route,
  active,
  onSelect,
}: {
  route: CareerPlanningRoute;
  active: boolean;
  onSelect?: (directionKey: string) => void;
}) {
  const topGap = route.gapNodes[0] ?? null;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(route.directionKey)}
      className={cn(
        "w-full rounded-[26px] border px-4 py-4 text-left transition-colors",
        active
          ? "border-black/[0.08] bg-white shadow-[var(--shadow-soft-panel)]"
          : "border-black/[0.04] bg-white/64 hover:bg-white/86",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
            {active ? "主线" : "备选"}
          </p>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold tracking-[-0.03em] text-[var(--color-text)]">
            {route.title}
          </h3>
        </div>
        <span className="rounded-full bg-[var(--color-panel-soft)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--color-text-secondary)]">
          {formatConfidence(route.confidence)}
        </span>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--color-text-secondary)]">
        {route.summary}
      </p>
      {topGap ? (
        <div className="mt-3 rounded-2xl bg-[var(--color-panel-soft)] px-3 py-2.5">
          <p className="text-[0.625rem] text-[var(--color-text-tertiary)]">下一处缺口</p>
          <p className="mt-1 line-clamp-1 text-sm font-medium text-[var(--color-text)]">
            {topGap.title}
          </p>
        </div>
      ) : null}
    </button>
  );
}

function DraftRouteCard({
  route,
  active,
}: {
  route: CareerMapDraft["routes"][number];
  active: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-[22px] border px-4 py-3",
        active ? "border-black/[0.08] bg-white" : "border-black/[0.04] bg-white/62",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
            {active ? "访谈收敛" : "备选"}
          </p>
          <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-[var(--color-text)]">
            {route.title}
          </h3>
        </div>
        <span className="rounded-full bg-[var(--color-panel-soft)] px-2 py-1 text-[0.625rem] text-[var(--color-text-secondary)]">
          {route.fitScore}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
        {route.reason}
      </p>
    </article>
  );
}

function CareerMapDraftPanel({ draft }: { draft: CareerMapDraft }) {
  return (
    <section className="rounded-[30px] border border-black/[0.05] bg-[#fbfaf5]/88 p-5 shadow-[var(--shadow-soft-panel)]">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-text-secondary)]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
            访谈更新
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)]">
            {draft.message}
          </h2>
          <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
            {draft.nextQuestion.why}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {draft.observations.slice(0, 3).map((observation) => (
          <div
            key={`${observation.source}-${observation.title}`}
            className="rounded-2xl bg-white/78 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="line-clamp-1 text-sm font-medium text-[var(--color-text)]">
                {observation.title}
              </p>
              <span className="shrink-0 text-[0.625rem] text-[var(--color-text-tertiary)]">
                {DRAFT_SOURCE_LABELS[observation.source]}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
              {observation.summary}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-white/78 px-3 py-3">
        <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-[var(--color-text-muted)]">
          下一次校准
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-[var(--color-text)]">
          {draft.nextQuestion.question}
        </p>
        {draft.nextQuestion.options?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {draft.nextQuestion.options.map((option) => (
              <span
                key={option}
                className="rounded-full bg-[var(--color-panel-soft)] px-2.5 py-1 text-[0.6875rem] text-[var(--color-text-secondary)]"
              >
                {option}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {draft.routes.map((route) => (
          <DraftRouteCard
            key={route.directionKey}
            route={route}
            active={route.directionKey === draft.selectedRouteKey}
          />
        ))}
      </div>
    </section>
  );
}

function EmptyCareerMap({ status }: { status: CareerPlanningWorkspaceData["snapshot"]["status"] }) {
  const isPending = status === "pending";

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-10">
      <div className="max-w-sm rounded-[30px] border border-black/[0.05] bg-white/74 p-6 text-center shadow-[var(--shadow-soft-panel)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)]">
          {isPending ? <Sparkles className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[var(--color-text)]">
          {isPending ? "正在整理职业地图" : "先从课程开始"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          {isPending
            ? "已保存课程会被整理成职业信号，完成后可以继续做方向访谈。"
            : "职业规划需要先有课程和学习证据。生成课程后，我会从真实学习轨迹开始引导。"}
        </p>
        <Link
          href={isPending ? "/career-trees" : "/interview"}
          className="ui-primary-button mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
        >
          {isPending ? "查看进度" : "开始课程访谈"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function CareerMapPanel({
  data,
  activeRouteKey,
  draft,
  headerAction,
  onSelectRoute,
  className,
}: CareerMapPanelProps) {
  const activeRoute =
    data.routes.find((route) => route.directionKey === activeRouteKey) ?? data.currentRoute;
  const routeLabel = data.planningState ? "规划主线" : "当前判断";

  return (
    <aside className={cn("ui-page-shell flex h-full min-h-0 flex-col bg-white/72", className)}>
      <header className="safe-top border-b border-black/[0.04] px-5 pb-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="ui-primary-button flex h-10 w-10 items-center justify-center rounded-2xl">
              <Compass className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
                职业地图
              </p>
              <h1 className="mt-1 text-base font-semibold text-[var(--color-text)]">
                课程驱动的方向判断
              </h1>
            </div>
          </div>
          {headerAction}
        </div>
      </header>

      {data.snapshot.status !== "ready" || !activeRoute ? (
        <EmptyCareerMap status={data.snapshot.status} />
      ) : (
        <div className="mobile-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {draft ? (
            <div className="mb-5">
              <CareerMapDraftPanel draft={draft} />
            </div>
          ) : null}

          <section className="rounded-[30px] bg-white/76 p-5 shadow-[var(--shadow-soft-panel)]">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)]">
                <GitBranch className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
                  {routeLabel}
                </p>
                <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.05em] text-[var(--color-text)]">
                  {activeRoute.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {activeRoute.whyThisDirection}
                </p>
              </div>
            </div>

            {data.metrics ? (
              <div className="mt-5 grid grid-cols-3 gap-2">
                <MetricPill label="进度" value={`${data.metrics.averageProgress}%`} />
                <MetricPill label="能力" value={data.metrics.total} />
                <MetricPill label="学习中" value={data.metrics.inProgress} />
              </div>
            ) : null}
          </section>

          {data.signals.length > 0 ? (
            <section className="mt-5">
              <div className="mb-3 text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
                课程信号
              </div>
              <div className="space-y-2">
                {data.signals.map((signal) => (
                  <SignalCard key={`${signal.label}-${signal.detail}`} signal={signal} />
                ))}
              </div>
            </section>
          ) : null}

          {activeRoute.gapNodes.length > 0 ? (
            <section className="mt-5">
              <div className="mb-3 text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
                待校准缺口
              </div>
              <div className="space-y-2">
                {activeRoute.gapNodes.slice(0, 4).map((node) => (
                  <SkillRow key={node.id} node={node} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-5">
            <div className="mb-3 text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--color-text-muted)]">
              候选路线
            </div>
            <div className="space-y-3">
              {data.routes.map((route) => (
                <RouteCard
                  key={route.directionKey}
                  route={route}
                  active={route.directionKey === activeRoute.directionKey}
                  onSelect={onSelectRoute}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
