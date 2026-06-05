"use client";

import type {
  CareerDevelopmentGraph,
  CareerRoleNode,
} from "@/lib/career-tree/career-development-graph";
import type { CareerNodeState, VisibleSkillTreeNode } from "@/lib/career-tree/types";
import { cn } from "@/lib/utils";

type CareerTreeGraphVariant = "full" | "compact";

interface CareerTreeGraphProps {
  graph: CareerDevelopmentGraph;
  activeNodeId?: string | null;
  onSelectNode?: (node: VisibleSkillTreeNode) => void;
  onSelectCareer?: (directionKey: string) => void;
  variant?: CareerTreeGraphVariant;
  maxDepth?: number;
  planningHighlightNodeIds?: string[];
  className?: string;
}

interface BranchProps {
  node: VisibleSkillTreeNode;
  depth: number;
  maxDepth?: number;
  activeNodeId?: string | null;
  planningHighlightNodeIds: Set<string>;
  variant: CareerTreeGraphVariant;
  onSelectNode?: (node: VisibleSkillTreeNode) => void;
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, progress));
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

function getStateTone(state: CareerNodeState) {
  switch (state) {
    case "mastered":
      return {
        accent: "#166534",
        border: "rgba(22,101,52,0.18)",
        background: "#fbfdf9",
        text: "text-[var(--color-text)]",
        muted: "text-emerald-800/70",
        rail: "bg-emerald-800/35",
        opacity: 1,
      };
    case "in_progress":
      return {
        accent: "#1d4ed8",
        border: "rgba(29,78,216,0.18)",
        background: "#fbfdff",
        text: "text-[var(--color-text)]",
        muted: "text-blue-800/70",
        rail: "bg-blue-800/35",
        opacity: 1,
      };
    case "ready":
      return {
        accent: "#475569",
        border: "rgba(71,85,105,0.18)",
        background: "#ffffff",
        text: "text-[var(--color-text-secondary)]",
        muted: "text-slate-600",
        rail: "bg-slate-500/35",
        opacity: 0.92,
      };
    case "locked":
      return {
        accent: "#94a3b8",
        border: "rgba(148,163,184,0.14)",
        background: "#ffffff",
        text: "text-[var(--color-text-tertiary)]",
        muted: "text-slate-400",
        rail: "bg-slate-300",
        opacity: 0.62,
      };
  }
}

function getRoleEyebrow(role: CareerRoleNode): string {
  if (role.source === "candidate_tree") {
    return "转向目标";
  }

  if (role.horizon === "next") {
    return "下一目标";
  }

  return "进阶目标";
}

function getNodeCourseCount(node: VisibleSkillTreeNode): number {
  return node.supportingCourses?.length ?? 0;
}

function CareerRoleCard({
  role,
  current,
  compact,
  onSelect,
}: {
  role: CareerRoleNode;
  current?: boolean;
  compact?: boolean;
  onSelect?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            current ? "bg-slate-950" : "bg-slate-300",
          )}
        />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "font-semibold leading-snug tracking-[-0.035em]",
              compact ? "text-sm" : current ? "text-lg" : "text-sm",
            )}
          >
            {role.title}
          </div>
          {role.routeTitle ? (
            <div className="mt-1 truncate text-[0.6875rem] text-[var(--color-text-muted)]">
              {role.routeTitle}
            </div>
          ) : null}
        </div>
        {role.isSelected || role.isRecommended ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[0.625rem] font-medium text-[var(--color-text-secondary)]">
            {role.isSelected ? "已选" : "推荐"}
          </span>
        ) : null}
      </div>
      {!compact && current ? (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--color-text-secondary)]">
          {role.summary}
        </p>
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full rounded-[20px] border border-black/[0.07] bg-white px-4 py-3 text-left transition-colors hover:border-slate-300 hover:text-[var(--color-text)]",
          current
            ? "text-[var(--color-text)]"
            : "text-[var(--color-text-secondary)] hover:bg-white",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[22px] border bg-white px-4 py-4",
        current
          ? "border-slate-950/12 text-[var(--color-text)] shadow-[0_18px_50px_-44px_rgba(15,23,42,0.55)]"
          : "border-black/[0.07] text-[var(--color-text-secondary)]",
      )}
    >
      {content}
    </div>
  );
}

function SkillNodeCard({
  node,
  active,
  highlighted,
  variant,
  onSelect,
}: {
  node: VisibleSkillTreeNode;
  active: boolean;
  highlighted: boolean;
  variant: CareerTreeGraphVariant;
  onSelect?: (node: VisibleSkillTreeNode) => void;
}) {
  const tone = getStateTone(node.state);
  const progress = clampProgress(node.progress);
  const courseCount = getNodeCourseCount(node);
  const compact = variant === "compact";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(node)}
      className={cn(
        "group relative w-full rounded-[18px] border bg-white text-left transition-colors duration-200",
        compact ? "px-3.5 py-3" : "px-4 py-3.5",
        active || highlighted
          ? "ring-2 ring-slate-950/10"
          : "hover:border-slate-300 hover:text-[var(--color-text)]",
      )}
      style={{
        background: tone.background,
        borderColor: active || highlighted ? tone.accent : tone.border,
        opacity: tone.opacity,
      }}
      aria-label={node.title}
    >
      <span
        aria-hidden
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
        style={{ background: tone.accent }}
      />
      <span className="flex items-center gap-2">
        <span className={cn("text-[0.625rem] font-medium", tone.muted)}>
          {getStateLabel(node.state)}
        </span>
        {courseCount > 0 ? (
          <span className="rounded-full bg-black/[0.045] px-2 py-0.5 text-[0.625rem] font-medium text-[var(--color-text-secondary)]">
            课程
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-[0.625rem] tabular-nums text-[var(--color-text-muted)]">
          {progress}%
        </span>
      </span>
      <span
        className={cn(
          "mt-2 block line-clamp-2 font-semibold leading-snug tracking-[-0.025em]",
          compact ? "text-sm" : "text-[0.95rem]",
          active ? "text-[var(--color-text)]" : tone.text,
        )}
      >
        {node.title}
      </span>
      <span className="mt-3 block h-1 overflow-hidden rounded-full bg-black/[0.055]">
        <span
          className="block h-full rounded-full transition-[width]"
          style={{ width: `${progress}%`, background: tone.accent }}
        />
      </span>
    </button>
  );
}

function CareerPathBranch({
  node,
  depth,
  maxDepth,
  activeNodeId,
  planningHighlightNodeIds,
  variant,
  onSelectNode,
}: BranchProps) {
  const children = maxDepth != null && depth >= maxDepth ? [] : node.children;
  const active = node.id === activeNodeId;
  const highlighted = planningHighlightNodeIds.has(node.id);
  const compact = variant === "compact";

  return (
    <div className="relative">
      {depth > 0 ? (
        <span aria-hidden className="absolute -left-5 top-7 h-px w-5 bg-slate-200" />
      ) : null}
      <SkillNodeCard
        node={node}
        active={active}
        highlighted={highlighted}
        variant={variant}
        onSelect={onSelectNode}
      />
      {children.length > 0 ? (
        <div
          className={cn(
            "mt-3 space-y-3 border-l border-slate-200",
            compact ? "ml-4 pl-4" : "ml-6 pl-5",
          )}
        >
          {children.map((child) => (
            <CareerPathBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              activeNodeId={activeNodeId}
              planningHighlightNodeIds={planningHighlightNodeIds}
              variant={variant}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TargetStage({
  graph,
  variant,
  planningHighlightNodeIds,
  onSelectCareer,
}: {
  graph: CareerDevelopmentGraph;
  variant: CareerTreeGraphVariant;
  planningHighlightNodeIds: Set<string>;
  onSelectCareer?: (directionKey: string) => void;
}) {
  const compact = variant === "compact";
  const futureCareers = graph.futureCareers.slice(0, 3);

  return (
    <div
      className={cn("grid gap-3", compact ? "grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_18rem]")}
    >
      <div className="relative">
        <CareerRoleCard role={graph.currentCareer} current compact={compact} />
        {graph.skillRoots.length > 0 ? (
          <span
            aria-hidden
            className="absolute left-1/2 -bottom-6 h-6 w-px bg-gradient-to-b from-slate-300 to-transparent"
          />
        ) : null}
      </div>
      {futureCareers.length > 0 ? (
        <div className={cn("grid gap-2", compact ? "grid-cols-1" : "content-start")}>
          {futureCareers.map((role) => (
            <div
              key={role.key}
              className={cn(
                "rounded-[20px]",
                planningHighlightNodeIds.has(role.key) && "ring-2 ring-slate-950/10",
              )}
            >
              <div className="mb-1 px-1 text-[0.625rem] font-medium text-[var(--color-text-muted)]">
                {getRoleEyebrow(role)}
              </div>
              <CareerRoleCard
                role={role}
                compact
                onSelect={
                  role.source === "candidate_tree" ? () => onSelectCareer?.(role.key) : undefined
                }
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CareerTreeGraph({
  graph,
  activeNodeId,
  onSelectNode,
  onSelectCareer,
  variant = "full",
  maxDepth,
  planningHighlightNodeIds,
  className,
}: CareerTreeGraphProps) {
  const compact = variant === "compact";
  const planningHighlightIds = new Set(planningHighlightNodeIds ?? []);

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden border border-black/[0.06] bg-[#fbfbf8]",
        compact ? "rounded-[1.25rem]" : "rounded-[1.75rem]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.032) 1px, transparent 1px)",
          backgroundSize: compact ? "32px 32px" : "48px 48px",
        }}
      />
      <div className="relative z-10 flex h-full min-h-0 flex-col p-3 md:p-4">
        <TargetStage
          graph={graph}
          variant={variant}
          planningHighlightNodeIds={planningHighlightIds}
          onSelectCareer={onSelectCareer}
        />

        <div
          className={cn(
            "mobile-scroll mt-6 min-h-0 flex-1 overflow-y-auto rounded-[24px] border border-black/[0.045] bg-white/64",
            compact ? "p-3" : "p-5",
          )}
        >
          <div className={cn("mx-auto space-y-3", compact ? "max-w-none" : "max-w-[760px]")}>
            {graph.skillRoots.map((node) => (
              <CareerPathBranch
                key={node.id}
                node={node}
                depth={0}
                maxDepth={maxDepth}
                activeNodeId={activeNodeId}
                planningHighlightNodeIds={planningHighlightIds}
                variant={variant}
                onSelectNode={onSelectNode}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
