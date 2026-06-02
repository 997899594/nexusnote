"use client";

import {
  BaseEdge,
  type Edge,
  type EdgeProps,
  getSmoothStepPath,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { hierarchy, tree } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";
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
  onSelectNode?: (nodeId: string) => void;
  onSelectCareer?: (directionKey: string) => void;
  variant?: CareerTreeGraphVariant;
  maxDepth?: number;
  planningHighlightNodeIds?: string[];
  className?: string;
}

interface SkillLayoutNode {
  id: string;
  skillNode?: VisibleSkillTreeNode;
  children: SkillLayoutNode[];
}

interface CareerSkillNodeData extends Record<string, unknown> {
  skillNode: VisibleSkillTreeNode;
  variant: CareerTreeGraphVariant;
  active: boolean;
  planningHighlighted: boolean;
}

interface CareerRoleNodeData extends Record<string, unknown> {
  role: CareerRoleNode;
  roleKind: "current" | "future";
  variant: CareerTreeGraphVariant;
  planningHighlighted: boolean;
}

interface CareerBranchEdgeData extends Record<string, unknown> {
  state: CareerNodeState | "role";
  active: boolean;
  kind: "skill" | "career";
}

type CareerSkillFlowNode = Node<CareerSkillNodeData, "careerSkill">;
type CareerRoleFlowNode = Node<CareerRoleNodeData, "careerRole">;
type CareerFlowNode = CareerSkillFlowNode | CareerRoleFlowNode;
type CareerFlowEdge = Edge<CareerBranchEdgeData, "careerBranch">;

const SKILL_LAYOUT_ROOT_ID = "__career-skill-layout-root";
const CURRENT_CAREER_NODE_ID = "__current-career";
const FUTURE_CAREER_NODE_PREFIX = "__future-career:";
const CENTER_NODE_ORIGIN: [number, number] = [0.5, 0.5];
const FLOW_PRO_OPTIONS = { hideAttribution: true };

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

function getStateTone(state: CareerNodeState | "role") {
  switch (state) {
    case "role":
      return {
        accent: "#111827",
        background: "#ffffff",
        border: "rgba(15,23,42,0.14)",
        edge: "rgba(15,23,42,0.42)",
        text: "text-[var(--color-text)]",
        opacity: 1,
        dash: undefined,
      };
    case "mastered":
      return {
        accent: "#15803d",
        background: "#fbfefb",
        border: "rgba(21,128,61,0.18)",
        edge: "rgba(21,128,61,0.4)",
        text: "text-[var(--color-text)]",
        opacity: 1,
        dash: undefined,
      };
    case "in_progress":
      return {
        accent: "#2563eb",
        background: "#fbfdff",
        border: "rgba(37,99,235,0.18)",
        edge: "rgba(37,99,235,0.38)",
        text: "text-[var(--color-text)]",
        opacity: 0.94,
        dash: undefined,
      };
    case "ready":
      return {
        accent: "#64748b",
        background: "#ffffff",
        border: "rgba(100,116,139,0.16)",
        edge: "rgba(100,116,139,0.32)",
        text: "text-[var(--color-text-secondary)]",
        opacity: 0.86,
        dash: "8 10",
      };
    case "locked":
      return {
        accent: "#94a3b8",
        background: "#ffffff",
        border: "rgba(148,163,184,0.14)",
        edge: "rgba(148,163,184,0.28)",
        text: "text-[var(--color-text-tertiary)]",
        opacity: 0.66,
        dash: "4 12",
      };
  }
}

function getLayoutMetrics(variant: CareerTreeGraphVariant) {
  if (variant === "compact") {
    return {
      skillSiblingGap: 144,
      skillDepthGap: 94,
      futureY: 64,
      futureTierGap: 64,
      currentY: 164,
      currentOnlyY: 82,
      skillBaseY: 292,
      currentOnlySkillBaseY: 210,
      canvasHeight: "20rem",
      currentOnlyCanvasHeight: "18rem",
      fitPadding: 0.04,
      minZoom: 0.42,
      maxZoom: 1.9,
    };
  }

  return {
    skillSiblingGap: 218,
    skillDepthGap: 122,
    futureY: 92,
    futureTierGap: 90,
    currentY: 212,
    currentOnlyY: 126,
    skillBaseY: 372,
    currentOnlySkillBaseY: 304,
    canvasHeight: "42rem",
    currentOnlyCanvasHeight: "34rem",
    fitPadding: 0.04,
    minZoom: 0.36,
    maxZoom: 2.15,
  };
}

function getFutureCareerPosition(params: {
  index: number;
  count: number;
  centerX: number;
  variant: CareerTreeGraphVariant;
  futureY: number;
  tierGap: number;
}) {
  const compact = params.variant === "compact";
  const horizontalGap = compact ? 176 : 258;
  const outerGap = compact ? 286 : 424;

  if (params.count <= 1) {
    return {
      x: params.centerX,
      y: params.futureY + params.tierGap,
    };
  }

  if (params.count === 2) {
    return {
      x: params.centerX + (params.index === 0 ? -horizontalGap * 0.72 : horizontalGap * 0.72),
      y: params.futureY + params.tierGap * 0.72,
    };
  }

  const canopySlots = [
    { x: 0, y: 0 },
    { x: -horizontalGap, y: 1 },
    { x: horizontalGap, y: 1 },
    { x: -outerGap, y: 2 },
    { x: outerGap, y: 2 },
  ];
  const slot = canopySlots[params.index] ?? canopySlots[canopySlots.length - 1];

  return {
    x: params.centerX + slot.x,
    y: params.futureY + slot.y * params.tierGap,
  };
}

function toSkillLayoutNode(
  node: VisibleSkillTreeNode,
  depth: number,
  maxDepth: number | undefined,
): SkillLayoutNode {
  const children =
    maxDepth != null && depth >= maxDepth
      ? []
      : node.children.map((child) => toSkillLayoutNode(child, depth + 1, maxDepth));

  return {
    id: node.id,
    skillNode: node,
    children,
  };
}

function buildSkillLayoutRoot(
  nodes: VisibleSkillTreeNode[],
  maxDepth: number | undefined,
): SkillLayoutNode {
  return {
    id: SKILL_LAYOUT_ROOT_ID,
    children: nodes.map((node) => toSkillLayoutNode(node, 0, maxDepth)),
  };
}

function shiftElementsIntoPositiveSpace(nodes: CareerFlowNode[]) {
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const shiftX = minX < 120 ? 120 - minX : 0;
  const shiftY = minY < 80 ? 80 - minY : 0;

  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + shiftX,
      y: node.position.y + shiftY,
    },
  }));
}

function buildFlowElements(params: {
  graph: CareerDevelopmentGraph;
  activeNodeId?: string | null;
  variant: CareerTreeGraphVariant;
  maxDepth?: number;
  planningHighlightNodeIds?: string[];
}): { nodes: CareerFlowNode[]; edges: CareerFlowEdge[]; signature: string } {
  const metrics = getLayoutMetrics(params.variant);
  const planningHighlightNodeIds = new Set(params.planningHighlightNodeIds ?? []);
  const hasFutureCareers = params.graph.futureCareers.length > 0;
  const currentCareerY = hasFutureCareers ? metrics.currentY : metrics.currentOnlyY;
  const careerToSkillClearance = params.variant === "compact" ? 118 : 176;
  const skillBaseY = Math.max(
    hasFutureCareers ? metrics.skillBaseY : metrics.currentOnlySkillBaseY,
    currentCareerY + careerToSkillClearance,
  );
  const root = hierarchy(buildSkillLayoutRoot(params.graph.skillRoots, params.maxDepth));
  const layout = tree<SkillLayoutNode>()
    .nodeSize([metrics.skillSiblingGap, metrics.skillDepthGap])
    .separation((left, right) => (left.parent === right.parent ? 1 : 1.18));
  const positioned = layout(root);
  const skillNodes = positioned
    .descendants()
    .filter((layoutNode) => layoutNode.data.skillNode)
    .map<CareerSkillFlowNode>((layoutNode) => {
      const skillNode = layoutNode.data.skillNode as VisibleSkillTreeNode;

      return {
        id: skillNode.id,
        type: "careerSkill",
        position: {
          x: layoutNode.x,
          y: skillBaseY + (layoutNode.depth - 1) * metrics.skillDepthGap,
        },
        data: {
          skillNode,
          variant: params.variant,
          active: skillNode.id === params.activeNodeId,
          planningHighlighted: planningHighlightNodeIds.has(skillNode.id),
        },
        selectable: false,
        draggable: false,
        zIndex:
          skillNode.id === params.activeNodeId || planningHighlightNodeIds.has(skillNode.id)
            ? 3
            : 2,
      };
    });
  const skillCenterX =
    skillNodes.length > 0
      ? skillNodes.reduce((total, node) => total + node.position.x, 0) / skillNodes.length
      : 0;
  const currentCareerNode: CareerRoleFlowNode = {
    id: CURRENT_CAREER_NODE_ID,
    type: "careerRole",
    position: { x: skillCenterX, y: currentCareerY },
    data: {
      role: params.graph.currentCareer,
      roleKind: "current",
      variant: params.variant,
      planningHighlighted:
        planningHighlightNodeIds.has(params.graph.currentCareer.key) ||
        planningHighlightNodeIds.has(CURRENT_CAREER_NODE_ID),
    },
    selectable: false,
    draggable: false,
    zIndex: 4,
  };

  const futureCareerNodes: CareerRoleFlowNode[] = params.graph.futureCareers.map((role, index) => {
    const count = params.graph.futureCareers.length;
    const position = getFutureCareerPosition({
      index,
      count,
      centerX: skillCenterX,
      variant: params.variant,
      futureY: metrics.futureY,
      tierGap: metrics.futureTierGap,
    });

    return {
      id: `${FUTURE_CAREER_NODE_PREFIX}${role.key}`,
      type: "careerRole",
      position,
      data: {
        role,
        roleKind: "future",
        variant: params.variant,
        planningHighlighted:
          planningHighlightNodeIds.has(role.key) ||
          planningHighlightNodeIds.has(`${FUTURE_CAREER_NODE_PREFIX}${role.key}`),
      },
      selectable: false,
      draggable: false,
      zIndex: 3,
    };
  });

  const shiftedNodes = shiftElementsIntoPositiveSpace([
    ...futureCareerNodes,
    currentCareerNode,
    ...skillNodes,
  ]);
  const shiftedNodeById = new Map(shiftedNodes.map((node) => [node.id, node]));
  const skillNodeIds = new Set(skillNodes.map((node) => node.id));
  const skillEdges = positioned
    .links()
    .filter((link) => link.source.data.skillNode && link.target.data.skillNode)
    .map<CareerFlowEdge>((link) => {
      const parent = link.source.data.skillNode as VisibleSkillTreeNode;
      const child = link.target.data.skillNode as VisibleSkillTreeNode;
      const active =
        parent.id === params.activeNodeId ||
        child.id === params.activeNodeId ||
        planningHighlightNodeIds.has(parent.id) ||
        planningHighlightNodeIds.has(child.id);

      return {
        id: `skill:${parent.id}:${child.id}`,
        source: parent.id,
        target: child.id,
        type: "careerBranch",
        data: {
          state: child.state,
          active,
          kind: "skill",
        },
        selectable: false,
        focusable: false,
        reconnectable: false,
      };
    });
  const rootEdges = params.graph.skillRoots
    .filter((node) => skillNodeIds.has(node.id))
    .map<CareerFlowEdge>((node) => ({
      id: `career:${node.id}:${CURRENT_CAREER_NODE_ID}`,
      source: CURRENT_CAREER_NODE_ID,
      target: node.id,
      type: "careerBranch",
      data: {
        state: "role",
        active: node.id === params.activeNodeId || planningHighlightNodeIds.has(node.id),
        kind: "career",
      },
      selectable: false,
      focusable: false,
      reconnectable: false,
    }));
  const futureCareerEdges = params.graph.futureCareers.map<CareerFlowEdge>((role) => ({
    id: `career-future:${CURRENT_CAREER_NODE_ID}:${role.key}`,
    source: `${FUTURE_CAREER_NODE_PREFIX}${role.key}`,
    target: CURRENT_CAREER_NODE_ID,
    type: "careerBranch",
    data: {
      state: "role",
      active:
        role.isSelected ||
        role.isRecommended ||
        planningHighlightNodeIds.has(role.key) ||
        planningHighlightNodeIds.has(`${FUTURE_CAREER_NODE_PREFIX}${role.key}`) ||
        planningHighlightNodeIds.has(CURRENT_CAREER_NODE_ID),
      kind: "career",
    },
    selectable: false,
    focusable: false,
    reconnectable: false,
  }));
  return {
    nodes: shiftedNodes,
    edges: [...futureCareerEdges, ...rootEdges, ...skillEdges].filter(
      (edge) => shiftedNodeById.has(edge.source) && shiftedNodeById.has(edge.target),
    ),
    signature: shiftedNodes
      .map((node) => `${node.id}:${Math.round(node.position.x)}:${Math.round(node.position.y)}`)
      .join("|"),
  };
}

function CareerRoleNodeView({ data }: NodeProps<CareerRoleFlowNode>) {
  const isCompact = data.variant === "compact";
  const isFuture = data.roleKind === "future";
  const nodeSizeClass = isCompact
    ? isFuture
      ? "h-[46px] w-[168px]"
      : "h-[52px] w-[196px]"
    : isFuture
      ? "h-[54px] w-[212px]"
      : "h-[64px] w-[268px]";
  const statusLabel = data.role.isSelected ? "已选" : data.role.isRecommended ? "推荐" : "";
  const tone = getStateTone("role");

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-visible text-center",
        nodeSizeClass,
      )}
    >
      <Handle className="!opacity-0" position={Position.Bottom} type="source" />
      <Handle className="!opacity-0" position={Position.Top} type="target" />
      <button
        type="button"
        style={{
          background: tone.background,
          borderColor: data.planningHighlighted ? "rgba(15,23,42,0.28)" : tone.border,
        }}
        className={cn(
          "nodrag nowheel group relative flex h-full w-full items-center gap-3 rounded-[18px] border px-4 text-left shadow-none transition-colors duration-200",
          isFuture
            ? "cursor-pointer text-[var(--color-text-secondary)] hover:border-slate-300 hover:text-[var(--color-text)]"
            : "cursor-default text-[var(--color-text)]",
          data.planningHighlighted && "ring-2 ring-slate-900/10",
        )}
        aria-label={data.role.title}
      >
        {!isFuture ? (
          <span
            aria-hidden
            className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-slate-950/80"
          />
        ) : null}
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            isFuture ? "bg-slate-300" : "bg-slate-950",
          )}
        />
        <span
          className={cn(
            "line-clamp-2 min-w-0 flex-1 font-semibold leading-snug tracking-[-0.03em]",
            isCompact ? "text-xs" : isFuture ? "text-sm" : "text-base",
          )}
        >
          {data.role.title}
        </span>
        {statusLabel ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[0.625rem] font-medium text-[var(--color-text-secondary)]">
            {statusLabel}
          </span>
        ) : null}
      </button>
    </div>
  );
}

function CareerSkillNode({ data }: NodeProps<CareerSkillFlowNode>) {
  const { skillNode, active, planningHighlighted, variant } = data;
  const tone = getStateTone(skillNode.state);
  const progress = clampProgress(skillNode.progress);
  const isCompact = variant === "compact";
  const label = getStateLabel(skillNode.state);
  const nodeSizeClass = isCompact ? "h-[64px] w-[168px]" : "h-[78px] w-[216px]";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-visible text-center",
        nodeSizeClass,
      )}
    >
      <Handle className="!opacity-0" position={Position.Bottom} type="source" />
      <Handle className="!opacity-0" position={Position.Top} type="target" />
      <div
        className={cn(
          "relative flex h-full w-full shrink-0 flex-col justify-between rounded-[16px] border px-3.5 py-2.5 text-left shadow-none transition-colors duration-200",
          active ? "ring-2 ring-slate-900/10" : "hover:border-slate-300",
          planningHighlighted && "ring-2 ring-slate-900/10",
        )}
        style={{
          background: tone.background,
          borderColor: active || planningHighlighted ? tone.accent : tone.border,
          opacity: tone.opacity,
        }}
      >
        <span
          aria-hidden
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
          style={{ background: tone.accent }}
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="truncate text-[0.625rem] font-medium text-[var(--color-text-tertiary)]">
              {label}
            </span>
            <span className="ml-auto shrink-0 text-[0.625rem] tabular-nums text-[var(--color-text-muted)]">
              {progress}%
            </span>
          </div>
          <div
            className={cn(
              "mt-1.5 line-clamp-2 font-semibold leading-snug tracking-[-0.025em]",
              isCompact ? "text-xs" : "text-sm",
              active ? "text-[var(--color-text)]" : tone.text,
            )}
          >
            {skillNode.title}
          </div>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${progress}%`, background: tone.accent }}
          />
        </div>
        <div className="sr-only">
          {label}，进度 {progress}%
        </div>
      </div>
    </div>
  );
}

function CareerBranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<CareerFlowEdge>) {
  const tone = getStateTone(data?.state ?? "locked");
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18,
    offset: data?.kind === "career" ? 34 : 26,
  });

  return (
    <BaseEdge
      id={id}
      interactionWidth={22}
      path={path}
      style={{
        opacity: data?.active ? 1 : tone.opacity,
        stroke: data?.active ? tone.accent : tone.edge,
        strokeDasharray: tone.dash,
        strokeLinecap: "round",
        strokeWidth: data?.active ? 2.6 : data?.kind === "career" ? 1.9 : 1.6,
      }}
    />
  );
}

function CompactRoleCard({
  role,
  roleKind,
  planningHighlighted,
  onSelect,
}: {
  role: CareerRoleNode;
  roleKind: "current" | "future";
  planningHighlighted: boolean;
  onSelect?: () => void;
}) {
  const isFuture = roleKind === "future";
  const statusLabel = role.isSelected ? "已选" : role.isRecommended ? "推荐" : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className={cn(
        "relative flex w-full items-center gap-2 rounded-[18px] border border-black/[0.08] bg-white px-3.5 py-3 text-left transition-colors",
        isFuture ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text)]",
        onSelect && "hover:border-slate-300 hover:text-[var(--color-text)]",
        planningHighlighted && "ring-2 ring-slate-900/10",
      )}
      aria-label={role.title}
    >
      {!isFuture ? (
        <span
          aria-hidden
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-slate-950/80"
        />
      ) : null}
      <span
        aria-hidden
        className={cn("h-2 w-2 shrink-0 rounded-full", isFuture ? "bg-slate-300" : "bg-slate-950")}
      />
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold tracking-[-0.03em]">
        {role.title}
      </span>
      {statusLabel ? (
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[0.625rem] font-medium text-[var(--color-text-secondary)]">
          {statusLabel}
        </span>
      ) : null}
    </button>
  );
}

function CompactSkillCard({
  skillNode,
  active,
  planningHighlighted,
  onSelect,
}: {
  skillNode: VisibleSkillTreeNode;
  active: boolean;
  planningHighlighted: boolean;
  onSelect?: () => void;
}) {
  const tone = getStateTone(skillNode.state);
  const progress = clampProgress(skillNode.progress);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex w-full flex-col rounded-[16px] border bg-white px-3.5 py-2.5 text-left transition-colors",
        active ? "ring-2 ring-slate-900/10" : "hover:border-slate-300",
        planningHighlighted && "ring-2 ring-slate-900/10",
      )}
      style={{
        background: tone.background,
        borderColor: active || planningHighlighted ? tone.accent : tone.border,
        opacity: tone.opacity,
      }}
      aria-label={skillNode.title}
    >
      <span
        aria-hidden
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
        style={{ background: tone.accent }}
      />
      <span className="flex items-center gap-2">
        <span className="truncate text-[0.625rem] font-medium text-[var(--color-text-tertiary)]">
          {getStateLabel(skillNode.state)}
        </span>
        <span className="ml-auto shrink-0 text-[0.625rem] tabular-nums text-[var(--color-text-muted)]">
          {progress}%
        </span>
      </span>
      <span
        className={cn(
          "mt-1.5 line-clamp-2 text-sm font-semibold leading-snug tracking-[-0.025em]",
          active ? "text-[var(--color-text)]" : tone.text,
        )}
      >
        {skillNode.title}
      </span>
      <span className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/[0.06]">
        <span
          className="block h-full rounded-full transition-[width]"
          style={{ width: `${progress}%`, background: tone.accent }}
        />
      </span>
    </button>
  );
}

function CompactSkillBranch({
  node,
  depth,
  maxDepth,
  activeNodeId,
  planningHighlightNodeIds,
  onSelectNode,
}: {
  node: VisibleSkillTreeNode;
  depth: number;
  maxDepth?: number;
  activeNodeId?: string | null;
  planningHighlightNodeIds: Set<string>;
  onSelectNode?: (nodeId: string) => void;
}) {
  const children = maxDepth != null && depth >= maxDepth ? [] : node.children;

  return (
    <div className="relative">
      <span aria-hidden className="absolute top-7 -left-4 h-px w-4 bg-slate-200" />
      <CompactSkillCard
        active={node.id === activeNodeId}
        planningHighlighted={planningHighlightNodeIds.has(node.id)}
        skillNode={node}
        onSelect={() => onSelectNode?.(node.id)}
      />
      {children.length > 0 ? (
        <div className="mt-2.5 ml-3 space-y-2.5 border-l border-slate-200 pl-3">
          {children.map((child) => (
            <CompactSkillBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              activeNodeId={activeNodeId}
              planningHighlightNodeIds={planningHighlightNodeIds}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CompactCareerTreeGraph({
  graph,
  activeNodeId,
  onSelectNode,
  onSelectCareer,
  maxDepth,
  planningHighlightNodeIds,
  className,
}: CareerTreeGraphProps) {
  const planningHighlightIds = new Set(planningHighlightNodeIds ?? []);

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative z-10 space-y-3 p-3.5">
        {graph.futureCareers.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {graph.futureCareers.map((role) => (
              <CompactRoleCard
                key={role.key}
                role={role}
                roleKind="future"
                planningHighlighted={
                  planningHighlightIds.has(role.key) ||
                  planningHighlightIds.has(`${FUTURE_CAREER_NODE_PREFIX}${role.key}`)
                }
                onSelect={() => onSelectCareer?.(role.key)}
              />
            ))}
          </div>
        ) : null}

        <div className={cn(graph.futureCareers.length > 0 && "pl-4 border-l border-slate-200")}>
          <CompactRoleCard
            role={graph.currentCareer}
            roleKind="current"
            planningHighlighted={
              planningHighlightIds.has(graph.currentCareer.key) ||
              planningHighlightIds.has(CURRENT_CAREER_NODE_ID)
            }
          />
        </div>

        <div className="ml-3 space-y-2.5 border-l border-slate-200 pl-3">
          {graph.skillRoots.map((node) => (
            <CompactSkillBranch
              key={node.id}
              node={node}
              depth={0}
              maxDepth={maxDepth}
              activeNodeId={activeNodeId}
              planningHighlightNodeIds={planningHighlightIds}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const NODE_TYPES = {
  careerSkill: CareerSkillNode,
  careerRole: CareerRoleNodeView,
};

const EDGE_TYPES = {
  careerBranch: CareerBranchEdge,
};

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
  const instanceRef = useRef<ReactFlowInstance<CareerFlowNode, CareerFlowEdge> | null>(null);
  const [flowReadyVersion, setFlowReadyVersion] = useState(0);
  const isCompact = variant === "compact";
  const metrics = getLayoutMetrics(variant);
  const hasFutureCareers = graph.futureCareers.length > 0;
  const graphMinHeight = hasFutureCareers ? metrics.canvasHeight : metrics.currentOnlyCanvasHeight;
  const canvasHeight = isCompact ? graphMinHeight : "100%";
  const elements = useMemo(
    () => buildFlowElements({ graph, activeNodeId, variant, maxDepth, planningHighlightNodeIds }),
    [activeNodeId, graph, maxDepth, planningHighlightNodeIds, variant],
  );

  useEffect(() => {
    if (!elements.signature || flowReadyVersion === 0) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      void instanceRef.current?.fitView({
        duration: 420,
        maxZoom: metrics.maxZoom,
        padding: metrics.fitPadding,
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [elements.signature, flowReadyVersion, metrics.fitPadding, metrics.maxZoom]);

  if (isCompact) {
    return (
      <CompactCareerTreeGraph
        graph={graph}
        activeNodeId={activeNodeId}
        onSelectNode={onSelectNode}
        onSelectCareer={onSelectCareer}
        maxDepth={maxDepth}
        planningHighlightNodeIds={planningHighlightNodeIds}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden border border-black/[0.06] bg-[#fbfbf8]",
        isCompact ? "rounded-[1.25rem]" : "rounded-[1.75rem]",
        className,
      )}
      style={{ minHeight: graphMinHeight }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.34]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)",
          backgroundSize: isCompact ? "32px 32px" : "48px 48px",
        }}
      />

      <div className="relative z-10 h-full min-w-0 w-full" style={{ height: canvasHeight }}>
        <ReactFlow<CareerFlowNode, CareerFlowEdge>
          className="h-full w-full"
          colorMode="light"
          edges={elements.edges}
          edgeTypes={EDGE_TYPES}
          edgesFocusable={!isCompact}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ maxZoom: metrics.maxZoom, padding: metrics.fitPadding }}
          maxZoom={metrics.maxZoom}
          minZoom={metrics.minZoom}
          nodes={elements.nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodesFocusable={!isCompact}
          nodeOrigin={CENTER_NODE_ORIGIN}
          nodeTypes={NODE_TYPES}
          onInit={(instance) => {
            instanceRef.current = instance;
            setFlowReadyVersion((version) => version + 1);
          }}
          onNodeClick={(_, node) => {
            if (isCompact) {
              return;
            }

            if (node.type === "careerSkill") {
              onSelectNode?.(node.id);
            }
            if (node.type === "careerRole" && node.data.roleKind === "future") {
              onSelectCareer?.(node.data.role.key);
            }
          }}
          panOnDrag={!isCompact}
          panOnScroll={false}
          preventScrolling={false}
          proOptions={FLOW_PRO_OPTIONS}
          zoomOnDoubleClick={false}
          zoomOnPinch={!isCompact}
          zoomOnScroll={false}
        />
      </div>
    </div>
  );
}
