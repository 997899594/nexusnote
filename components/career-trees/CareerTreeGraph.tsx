"use client";

import {
  BaseEdge,
  type Edge,
  type EdgeProps,
  getBezierPath,
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

interface FlowNodeDimensions {
  width: number;
  height: number;
}

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
        edge: "rgba(15,23,42,0.72)",
        glow: "rgba(15,23,42,0.12)",
        halo: "rgba(15,23,42,0.07)",
        metal: "#0f172a",
        text: "text-[var(--color-text)]",
        opacity: 1,
        dash: undefined,
      };
    case "mastered":
      return {
        edge: "rgba(21,128,61,0.7)",
        glow: "rgba(21,128,61,0.12)",
        halo: "rgba(21,128,61,0.08)",
        metal: "#15803d",
        text: "text-[var(--color-text)]",
        opacity: 1,
        dash: undefined,
      };
    case "in_progress":
      return {
        edge: "rgba(37,99,235,0.72)",
        glow: "rgba(37,99,235,0.14)",
        halo: "rgba(37,99,235,0.09)",
        metal: "#2563eb",
        text: "text-[var(--color-text)]",
        opacity: 0.96,
        dash: undefined,
      };
    case "ready":
      return {
        edge: "rgba(71,85,105,0.48)",
        glow: "rgba(71,85,105,0.08)",
        halo: "rgba(71,85,105,0.06)",
        metal: "#64748b",
        text: "text-[var(--color-text-secondary)]",
        opacity: 0.82,
        dash: "7 9",
      };
    case "locked":
      return {
        edge: "rgba(148,163,184,0.34)",
        glow: "rgba(148,163,184,0.06)",
        halo: "rgba(148,163,184,0.05)",
        metal: "#94a3b8",
        text: "text-[var(--color-text-tertiary)]",
        opacity: 0.58,
        dash: "3 10",
      };
  }
}

function getLayoutMetrics(variant: CareerTreeGraphVariant) {
  if (variant === "compact") {
    return {
      skillSiblingGap: 104,
      skillDepthGap: 78,
      futureY: 62,
      futureTierGap: 78,
      currentY: 206,
      currentOnlyY: 140,
      skillBaseY: 444,
      currentOnlySkillBaseY: 362,
      canvasHeight: "17.5rem",
      currentOnlyCanvasHeight: "17.5rem",
      fitPadding: 0.14,
      minZoom: 0.34,
      maxZoom: 1.2,
    };
  }

  return {
    skillSiblingGap: 272,
    skillDepthGap: 116,
    futureY: 104,
    futureTierGap: 130,
    currentY: 330,
    currentOnlyY: 218,
    skillBaseY: 570,
    currentOnlySkillBaseY: 450,
    canvasHeight: "42rem",
    currentOnlyCanvasHeight: "36rem",
    fitPadding: 0.18,
    minZoom: 0.22,
    maxZoom: 1.32,
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
  const horizontalGap = compact ? 142 : 340;
  const outerGap = compact ? 190 : 500;

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

function getRoleNodeDimensions(
  variant: CareerTreeGraphVariant,
  roleKind: CareerRoleNodeData["roleKind"],
): FlowNodeDimensions {
  if (variant === "compact") {
    return roleKind === "future" ? { width: 128, height: 44 } : { width: 158, height: 52 };
  }

  return roleKind === "future" ? { width: 204, height: 62 } : { width: 360, height: 104 };
}

function getSkillNodeDimensions(variant: CareerTreeGraphVariant): FlowNodeDimensions {
  return variant === "compact" ? { width: 42, height: 42 } : { width: 214, height: 64 };
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

function getSkillTerminals(nodes: VisibleSkillTreeNode[], maxDepth: number | undefined) {
  const terminals: VisibleSkillTreeNode[] = [];

  function visit(node: VisibleSkillTreeNode, depth: number) {
    const children = maxDepth != null && depth >= maxDepth ? [] : node.children;

    if (children.length === 0) {
      terminals.push(node);
      return;
    }

    for (const child of children) {
      visit(child, depth + 1);
    }
  }

  for (const node of nodes) {
    visit(node, 0);
  }

  return terminals;
}

function getVisibleSkillDepth(nodes: VisibleSkillTreeNode[], maxDepth: number | undefined): number {
  let maxVisibleDepth = 0;

  function visit(node: VisibleSkillTreeNode, depth: number) {
    maxVisibleDepth = Math.max(maxVisibleDepth, depth);
    if (maxDepth != null && depth >= maxDepth) {
      return;
    }

    for (const child of node.children) {
      visit(child, depth + 1);
    }
  }

  for (const node of nodes) {
    visit(node, 0);
  }

  return maxVisibleDepth;
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
  const skillDepth = getVisibleSkillDepth(params.graph.skillRoots, params.maxDepth);
  const hasFutureCareers = params.graph.futureCareers.length > 0;
  const currentCareerY = hasFutureCareers ? metrics.currentY : metrics.currentOnlyY;
  const careerToSkillClearance = params.variant === "compact" ? 96 : 174;
  const skillBaseY = Math.max(
    hasFutureCareers ? metrics.skillBaseY : metrics.currentOnlySkillBaseY,
    currentCareerY + careerToSkillClearance + skillDepth * metrics.skillDepthGap,
  );
  const root = hierarchy(buildSkillLayoutRoot(params.graph.skillRoots, params.maxDepth));
  const layout = tree<SkillLayoutNode>()
    .nodeSize([metrics.skillSiblingGap, metrics.skillDepthGap])
    .separation((left, right) => (left.parent === right.parent ? 1.18 : 1.46));
  const positioned = layout(root);
  const skillNodeDimensions = getSkillNodeDimensions(params.variant);
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
          y: skillBaseY - layoutNode.depth * metrics.skillDepthGap,
        },
        initialHeight: skillNodeDimensions.height,
        initialWidth: skillNodeDimensions.width,
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
  const currentCareerNodeDimensions = getRoleNodeDimensions(params.variant, "current");
  const currentCareerNode: CareerRoleFlowNode = {
    id: CURRENT_CAREER_NODE_ID,
    type: "careerRole",
    position: { x: skillCenterX, y: currentCareerY },
    initialHeight: currentCareerNodeDimensions.height,
    initialWidth: currentCareerNodeDimensions.width,
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
    const dimensions = getRoleNodeDimensions(params.variant, "future");

    return {
      id: `${FUTURE_CAREER_NODE_PREFIX}${role.key}`,
      type: "careerRole",
      position,
      initialHeight: dimensions.height,
      initialWidth: dimensions.width,
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
  const terminalEdges = getSkillTerminals(params.graph.skillRoots, params.maxDepth)
    .filter((node) => skillNodeIds.has(node.id))
    .map<CareerFlowEdge>((node) => ({
      id: `career:${node.id}:${CURRENT_CAREER_NODE_ID}`,
      source: node.id,
      target: CURRENT_CAREER_NODE_ID,
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
    source: CURRENT_CAREER_NODE_ID,
    target: `${FUTURE_CAREER_NODE_PREFIX}${role.key}`,
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
    edges: [...futureCareerEdges, ...terminalEdges, ...skillEdges].filter(
      (edge) => shiftedNodeById.has(edge.source) && shiftedNodeById.has(edge.target),
    ),
    signature: shiftedNodes
      .map((node) => `${node.id}:${Math.round(node.position.x)}:${Math.round(node.position.y)}`)
      .join("|"),
  };
}

function SkillStationMark({
  progress,
  color,
  muted,
}: {
  progress: number;
  color: string;
  muted: boolean;
}) {
  const circumference = 113.1;
  const progressLength = (progress / 100) * circumference;

  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <svg aria-hidden className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
        <title>能力进度</title>
        <circle cx="22" cy="22" fill="none" r="18" stroke="rgba(15,23,42,0.08)" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          fill="none"
          r="18"
          stroke={color}
          strokeDasharray={`${progressLength} ${circumference}`}
          strokeLinecap="round"
          strokeWidth="3.5"
        />
      </svg>
      <span
        aria-hidden
        className={cn("relative h-2.5 w-2.5 rounded-full", muted && "h-2 w-2")}
        style={{
          background: color,
          boxShadow: muted ? undefined : `0 0 0 5px color-mix(in srgb, ${color} 12%, transparent)`,
        }}
      />
    </span>
  );
}

function formatRoleSignal(role: CareerRoleNode): string {
  if (role.horizon === "current") {
    return [`${role.supportingCoursesCount}课`, `${role.visibleNodeCount}能力`].join(" · ");
  }

  return `${role.horizon === "next" ? "下一阶" : "更远"} · ${role.visibleNodeCount}能力`;
}

function CareerRoleNodeView({ data }: NodeProps<CareerRoleFlowNode>) {
  const isCompact = data.variant === "compact";
  const isFuture = data.roleKind === "future";
  const isCurrent = data.roleKind === "current";
  const nodeSizeClass = isCompact
    ? isFuture
      ? "h-[44px] w-[128px]"
      : "h-[52px] w-[158px]"
    : isFuture
      ? "h-[58px] w-[184px] sm:h-[62px] sm:w-[204px]"
      : "h-[104px] w-[304px] sm:w-[360px]";
  const statusLabel = data.role.isSelected ? "已选" : data.role.isRecommended ? "推荐" : "";
  const roleLabel = isFuture
    ? data.role.source === "candidate_tree"
      ? "备选方向"
      : data.role.horizon === "next"
        ? "下一阶段岗位"
        : "可发展岗位"
    : "当前方向";
  const signalLabel = formatRoleSignal(data.role);
  const accentColor = isFuture
    ? data.role.isSelected
      ? "#2563eb"
      : data.role.isRecommended
        ? "#0f766e"
        : "#64748b"
    : "#0f172a";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-visible text-center",
        nodeSizeClass,
      )}
    >
      <Handle className="!opacity-0" position={Position.Top} type="source" />
      <Handle className="!opacity-0" position={Position.Bottom} type="target" />
      <button
        type="button"
        aria-label={`${roleLabel}，${data.role.title}，${signalLabel}`}
        className={cn(
          "nodrag nowheel group relative isolate flex h-full w-full flex-col items-start justify-center overflow-hidden border text-left transition duration-300",
          isCurrent
            ? "rounded-[28px] bg-[var(--color-panel-strong)] text-[var(--color-panel-strong-fg)]"
            : "rounded-full bg-white text-[var(--color-text)]",
          isCompact ? "px-4" : isFuture ? "px-5" : "px-6",
          isFuture ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default",
          data.planningHighlighted && "translate-y-[-1px]",
          isCurrent
            ? "border-white/10 shadow-[0_28px_68px_-42px_rgba(15,23,42,0.7)]"
            : data.planningHighlighted
              ? "border-slate-900/24 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.46)]"
              : "border-black/[0.08] shadow-[0_14px_32px_-30px_rgba(15,23,42,0.34)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-3 left-3 rounded-full transition-opacity duration-300",
            isCurrent ? "w-1.5 bg-white/82" : "w-1",
          )}
          style={{
            background: isCurrent ? undefined : accentColor,
            opacity: data.planningHighlighted || isFuture || isCurrent ? 1 : 0.7,
          }}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
            isCurrent ? "rounded-[28px]" : "rounded-full",
          )}
          style={{
            background: isCurrent
              ? "linear-gradient(90deg, rgba(255,255,255,0.08), transparent 46%, rgba(255,255,255,0.04))"
              : "linear-gradient(90deg, rgba(15,23,42,0.045), transparent 42%, rgba(255,255,255,0.72))",
          }}
        />
        <span
          className={cn(
            "relative z-10 flex w-full min-w-0 items-center gap-2 font-medium",
            isCurrent
              ? "text-[11px] text-white/60"
              : "text-[10px] text-[var(--color-text-tertiary)]",
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", isCurrent && "bg-white/72")}
            style={{ background: isCurrent ? undefined : accentColor }}
          />
          <span className="truncate">{roleLabel}</span>
          {statusLabel ? (
            <span
              className={cn(isCurrent ? "text-white/72" : "text-[var(--color-text-secondary)]")}
            >
              {statusLabel}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "relative z-10 mt-1 block w-full truncate font-display font-semibold leading-tight",
            isCurrent ? "text-white" : "text-[var(--color-text)]",
            isCompact ? "text-xs" : isFuture ? "text-sm" : "text-xl sm:text-[1.35rem]",
          )}
        >
          {data.role.title}
        </span>
        {!isCompact ? (
          <span
            className={cn(
              "relative z-10 mt-2 block w-full truncate text-[11px]",
              isCurrent ? "text-white/54" : "text-[var(--color-text-tertiary)]",
            )}
          >
            {signalLabel}
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
  const emphasized = active || planningHighlighted;
  const nodeSizeClass = isCompact ? "h-[42px] w-[42px]" : "h-[64px] w-[214px]";
  const stationSizeClass = isCompact ? "h-[26px] w-[26px]" : "h-[38px] w-[38px]";
  const muted = skillNode.state === "locked" || skillNode.state === "ready";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-visible text-center",
        nodeSizeClass,
      )}
    >
      <Handle className="!opacity-0" position={Position.Top} type="source" />
      <Handle className="!opacity-0" position={Position.Bottom} type="target" />
      <button
        type="button"
        aria-label={`${skillNode.title}，${label}，进度 ${progress}%`}
        className={cn(
          "nodrag nowheel group relative flex h-full w-full shrink-0 items-center rounded-full transition duration-300",
          isCompact
            ? "justify-center"
            : "justify-start gap-3 border border-black/[0.06] bg-white/80 px-3.5 text-left shadow-[0_14px_32px_-30px_rgba(15,23,42,0.34)] backdrop-blur",
          active ? "scale-[1.12]" : planningHighlighted ? "scale-[1.08]" : "hover:scale-[1.06]",
        )}
        style={{ color: tone.metal, opacity: tone.opacity }}
      >
        <span
          className={cn("relative flex shrink-0 items-center justify-center", stationSizeClass)}
        >
          <span
            aria-hidden
            className="absolute rounded-full transition-opacity duration-300"
            style={{
              background: tone.halo,
              inset: emphasized ? "-12px" : "-8px",
              opacity: emphasized ? 1 : 0,
            }}
          />
          {planningHighlighted ? (
            <span
              aria-hidden
              className="absolute -inset-1 rounded-full border border-slate-900/20"
            />
          ) : null}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border bg-white transition duration-300"
            style={{
              borderColor: planningHighlighted ? "rgba(51,65,85,0.46)" : tone.edge,
              boxShadow: emphasized
                ? `0 0 0 6px ${tone.glow}, 0 14px 28px -24px rgba(15,23,42,0.32)`
                : `0 10px 24px -24px rgba(15,23,42,0.28)`,
            }}
          />
          <SkillStationMark color={tone.metal} muted={muted} progress={progress} />
        </span>
        {!isCompact ? (
          <span className="relative z-10 flex min-w-0 flex-col">
            <span
              className={cn(
                "line-clamp-2 text-sm font-semibold leading-snug tracking-normal",
                active ? "text-[var(--color-text)]" : tone.text,
              )}
            >
              {skillNode.title}
            </span>
            <span className="mt-0.5 text-[10px] tracking-normal text-[var(--color-text-tertiary)]">
              {progress}% · {label}
            </span>
          </span>
        ) : null}
      </button>
      {isCompact ? (
        <div
          className={cn(
            "pointer-events-none absolute top-full left-1/2 mt-2 w-28 -translate-x-1/2 text-center text-[11px] leading-5",
          )}
        >
          <div className={cn("line-clamp-2 font-semibold tracking-normal", tone.text)}>
            {skillNode.title}
          </div>
        </div>
      ) : null}
      <div className="sr-only">
        {label}，进度 {progress}%
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
  const [skillPath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.38,
  });
  const careerMidY =
    targetY < sourceY
      ? sourceY - Math.max(68, (sourceY - targetY) * 0.5)
      : sourceY + Math.max(68, (targetY - sourceY) * 0.5);
  const careerPath = `M ${sourceX},${sourceY} C ${sourceX},${careerMidY} ${targetX},${careerMidY} ${targetX},${targetY}`;
  const path = data?.kind === "career" ? careerPath : skillPath;

  return (
    <>
      <BaseEdge
        id={`${id}:shadow`}
        interactionWidth={22}
        path={path}
        style={{
          stroke: "rgba(15,23,42,0.08)",
          strokeLinecap: "round",
          strokeWidth: data?.kind === "career" ? 9 : 7,
        }}
      />
      <BaseEdge
        id={id}
        interactionWidth={22}
        path={path}
        style={{
          filter: data?.active ? "drop-shadow(0 0 7px rgba(37,99,235,0.18))" : undefined,
          opacity: data?.active ? 1 : tone.opacity,
          stroke: tone.edge,
          strokeDasharray: tone.dash,
          strokeLinecap: "round",
          strokeWidth: data?.active ? 4.8 : data?.kind === "career" ? 3.6 : 2.8,
        }}
      />
    </>
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
  const canvasHeight = hasFutureCareers ? metrics.canvasHeight : metrics.currentOnlyCanvasHeight;
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
        padding: metrics.fitPadding,
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [elements.signature, flowReadyVersion, metrics.fitPadding]);

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden border border-black/6 bg-[var(--color-panel-soft)]",
        isCompact ? "rounded-[1.6rem]" : "rounded-[2.6rem]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)",
          backgroundSize: isCompact ? "36px 36px" : "64px 64px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-16 bottom-20 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-black/10 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,rgba(255,255,255,0.6),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-[42%] -translate-x-1/2 border-x border-black/[0.035]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(120deg, transparent 0 48%, rgba(15,23,42,0.18) 48% 48.5%, transparent 48.5% 100%)",
          backgroundSize: isCompact ? "130px 130px" : "220px 220px",
        }}
      />
      {!isCompact ? (
        <div className="pointer-events-none absolute inset-x-6 top-5 z-20 flex items-center justify-between text-[10px] font-medium tracking-normal text-[var(--color-text-tertiary)]">
          <span>{hasFutureCareers ? "职业方向" : "当前路线"}</span>
          <span>能力站点</span>
        </div>
      ) : null}

      <div className="relative z-10 h-full min-w-0 w-full" style={{ height: canvasHeight }}>
        <ReactFlow<CareerFlowNode, CareerFlowEdge>
          className="h-full w-full"
          colorMode="light"
          edges={elements.edges}
          edgeTypes={EDGE_TYPES}
          edgesFocusable={!isCompact}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ padding: metrics.fitPadding }}
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
