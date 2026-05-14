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
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerDevelopmentGraph, CareerRoleNode } from "@/lib/growth/career-development-graph";
import type { GrowthNodeState, VisibleSkillTreeNode } from "@/lib/growth/types";
import { cn } from "@/lib/utils";

export const CAREER_TREE_BLACK_GOLD_VARS = {
  "--color-text": "#f2e5cd",
  "--color-text-secondary": "rgba(242,229,205,0.74)",
  "--color-text-tertiary": "rgba(242,229,205,0.5)",
  "--color-text-muted": "rgba(191,139,59,0.76)",
  "--color-hover": "rgba(239,205,135,0.08)",
  "--career-tree-ash": "#070605",
  "--career-tree-ink": "#0b0907",
  "--career-tree-gold": "#d8ac58",
  "--career-tree-bronze": "#8f632e",
  "--career-tree-line": "rgba(216,172,88,0.5)",
} as CSSProperties;

type CareerTreeGraphVariant = "full" | "compact";

interface CareerTreeGraphProps {
  graph: CareerDevelopmentGraph;
  activeNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  onSelectCareer?: (directionKey: string) => void;
  variant?: CareerTreeGraphVariant;
  maxDepth?: number;
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
}

interface CareerRoleNodeData extends Record<string, unknown> {
  role: CareerRoleNode;
  roleKind: "current" | "future";
  variant: CareerTreeGraphVariant;
}

interface CareerBranchEdgeData extends Record<string, unknown> {
  state: GrowthNodeState | "role";
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
const OCTAGON_CLIP_PATH =
  "polygon(50% 0%, 82% 12%, 100% 50%, 82% 88%, 50% 100%, 18% 88%, 0% 50%, 18% 12%)";

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, progress));
}

function getStateLabel(state: GrowthNodeState): string {
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

function getStateTone(state: GrowthNodeState | "role") {
  switch (state) {
    case "role":
      return {
        edge: "rgba(232,184,88,0.82)",
        glow: "rgba(232,184,88,0.44)",
        halo: "rgba(255,222,145,0.22)",
        metal: "#efd287",
        text: "text-[#f0dca7]",
        opacity: 1,
        dash: undefined,
      };
    case "mastered":
      return {
        edge: "rgba(230,184,92,0.82)",
        glow: "rgba(230,184,92,0.46)",
        halo: "rgba(255,222,145,0.2)",
        metal: "#efd287",
        text: "text-[#f0dca7]",
        opacity: 1,
        dash: undefined,
      };
    case "in_progress":
      return {
        edge: "rgba(205,147,63,0.76)",
        glow: "rgba(205,147,63,0.34)",
        halo: "rgba(214,154,69,0.16)",
        metal: "#d8a24f",
        text: "text-[#e6c38a]",
        opacity: 0.94,
        dash: undefined,
      };
    case "ready":
      return {
        edge: "rgba(141,101,50,0.62)",
        glow: "rgba(141,101,50,0.2)",
        halo: "rgba(141,101,50,0.1)",
        metal: "#a7793b",
        text: "text-[#cdb894]",
        opacity: 0.86,
        dash: "8 10",
      };
    case "locked":
      return {
        edge: "rgba(87,75,60,0.48)",
        glow: "rgba(87,75,60,0.14)",
        halo: "rgba(87,75,60,0.08)",
        metal: "#6f6557",
        text: "text-[#928777]",
        opacity: 0.66,
        dash: "4 12",
      };
  }
}

function getLayoutMetrics(variant: CareerTreeGraphVariant) {
  if (variant === "compact") {
    return {
      skillSiblingGap: 96,
      skillDepthGap: 82,
      futureY: 72,
      futureTierGap: 76,
      currentY: 236,
      currentOnlyY: 148,
      skillBaseY: 520,
      currentOnlySkillBaseY: 420,
      canvasHeight: "18rem",
      currentOnlyCanvasHeight: "18rem",
      fitPadding: 0.14,
      minZoom: 0.34,
      maxZoom: 1.2,
    };
  }

  return {
    skillSiblingGap: 184,
    skillDepthGap: 166,
    futureY: 112,
    futureTierGap: 138,
    currentY: 414,
    currentOnlyY: 238,
    skillBaseY: 900,
    currentOnlySkillBaseY: 650,
    canvasHeight: "58rem",
    currentOnlyCanvasHeight: "43rem",
    fitPadding: 0.16,
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
  const horizontalGap = compact ? 128 : 310;
  const outerGap = compact ? 178 : 460;

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
}): { nodes: CareerFlowNode[]; edges: CareerFlowEdge[]; signature: string } {
  const metrics = getLayoutMetrics(params.variant);
  const skillDepth = getVisibleSkillDepth(params.graph.skillRoots, params.maxDepth);
  const hasFutureCareers = params.graph.futureCareers.length > 0;
  const currentCareerY = hasFutureCareers ? metrics.currentY : metrics.currentOnlyY;
  const careerToSkillClearance = params.variant === "compact" ? 96 : 260;
  const skillBaseY = Math.max(
    hasFutureCareers ? metrics.skillBaseY : metrics.currentOnlySkillBaseY,
    currentCareerY + careerToSkillClearance + skillDepth * metrics.skillDepthGap,
  );
  const root = hierarchy(buildSkillLayoutRoot(params.graph.skillRoots, params.maxDepth));
  const layout = tree<SkillLayoutNode>()
    .nodeSize([metrics.skillSiblingGap, metrics.skillDepthGap])
    .separation((left, right) => (left.parent === right.parent ? 1.18 : 1.46));
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
          y: skillBaseY - layoutNode.depth * metrics.skillDepthGap,
        },
        data: {
          skillNode,
          variant: params.variant,
          active: skillNode.id === params.activeNodeId,
        },
        selectable: false,
        draggable: false,
        zIndex: skillNode.id === params.activeNodeId ? 3 : 2,
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
      const active = parent.id === params.activeNodeId || child.id === params.activeNodeId;

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
        active: node.id === params.activeNodeId,
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
      active: role.isSelected || role.isRecommended,
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

function getRuneSeed(node: VisibleSkillTreeNode): number {
  const source = node.anchorRef || node.id || node.title;
  return Array.from(source).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function CareerRune({ node }: { node: VisibleSkillTreeNode }) {
  const seed = getRuneSeed(node);
  const skew = seed % 9;
  const tilt = seed % 2 === 0 ? 1 : -1;

  return (
    <svg aria-hidden className="h-[54%] w-[54%]" viewBox="0 0 64 64">
      <title>能力符印</title>
      <path
        d={`M32 ${12 + skew * 0.4} L32 ${52 - skew * 0.35}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d={`M18 ${25 + skew * 0.45} L32 ${16 + skew * 0.35} L46 ${25 + skew * 0.2}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path
        d={`M20 ${39 - skew * 0.25} C27 ${34 + tilt * 2}, 37 ${
          34 - tilt * 2
        }, 44 ${39 + skew * 0.25}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <circle cx="32" cy="32" fill="currentColor" r="3.5" />
    </svg>
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
  const nodeSizeClass = isCompact
    ? isFuture
      ? "h-[44px] w-[44px]"
      : "h-[58px] w-[58px]"
    : isFuture
      ? "h-[68px] w-[68px] sm:h-[76px] sm:w-[76px]"
      : "h-[98px] w-[98px] sm:h-[116px] sm:w-[116px]";
  const labelWidthClass = isCompact ? "w-32" : isFuture ? "w-52" : "w-44 sm:w-56 md:w-72";
  const statusLabel = data.role.isSelected ? "已选" : data.role.isRecommended ? "推荐" : "";
  const roleLabel = isFuture
    ? data.role.horizon === "next"
      ? "下一阶职业"
      : "可发展职业"
    : "当前职业";
  const signalLabel = formatRoleSignal(data.role);
  const labelPositionClass = isFuture
    ? "bottom-full mb-3"
    : "top-full mt-4 min-[520px]:top-1/2 min-[520px]:left-full min-[520px]:mt-0 min-[520px]:ml-3 min-[520px]:translate-x-0 min-[520px]:-translate-y-1/2 min-[520px]:text-left";

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
        className={cn(
          "nodrag nowheel group relative isolate flex h-full w-full items-center justify-center rounded-full text-[#f8e4b4] transition duration-300",
          isFuture ? "cursor-pointer hover:scale-[1.03]" : "cursor-default",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute rounded-full bg-[#d8ac58]/22 blur-2xl transition-opacity duration-300",
            isFuture ? "-inset-5 opacity-55 group-hover:opacity-85" : "-inset-9",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full border bg-[radial-gradient(circle_at_36%_28%,rgba(255,226,156,0.2),rgba(12,9,6,0.96)_58%,rgba(0,0,0,0.98))] shadow-[inset_0_0_22px_rgba(255,231,171,0.08)] transition duration-300",
            isFuture
              ? "border-[#9c7238]/80 shadow-[0_0_24px_rgba(216,172,88,0.18),inset_0_0_20px_rgba(255,231,171,0.08)] group-hover:border-[#e7bd64]/86"
              : "border-[#e7bd64]/85 shadow-[0_0_46px_rgba(216,172,88,0.36),inset_0_0_28px_rgba(255,231,171,0.1)]",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-[9px] rounded-full border border-[#f1ce76]/22",
            isCompact && "inset-[6px]",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-[10px] rotate-45 border border-[#d8ac58]/42",
            isCompact && "inset-[7px]",
          )}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[#e6bd68]">
          <span
            className={cn(
              "rounded-full bg-[#d8ac58] shadow-[0_0_16px_rgba(216,172,88,0.8)]",
              isFuture ? "h-1.5 w-1.5" : "h-2.5 w-2.5",
              isCompact && "h-1.5 w-1.5",
            )}
          />
        </span>
      </button>

      <div
        className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 text-center leading-none",
          labelWidthClass,
          labelPositionClass,
          isCompact && "sr-only",
        )}
      >
        <span
          className={cn(
            "block text-[9px] uppercase tracking-[0.26em] text-[#b98a43]",
            isFuture ? "text-[#a9824e]" : "text-[#d8ac58]",
          )}
        >
          {roleLabel}
        </span>
        <span className="mt-1.5 block">
          <span
            className={cn(
              "block max-w-full whitespace-normal font-display font-semibold leading-tight tracking-[-0.055em]",
              isFuture ? "text-[15px]" : "text-[1.2rem] sm:text-[1.5rem] md:text-[1.65rem]",
            )}
          >
            {data.role.title}
          </span>
          <span className="mt-1.5 block text-[10px] tracking-[0.08em] text-[#c6b38f]/72">
            {statusLabel ? `${statusLabel} · ` : ""}
            {signalLabel}
          </span>
        </span>
      </div>
    </div>
  );
}

function CareerSkillNode({ data }: NodeProps<CareerSkillFlowNode>) {
  const { skillNode, active, variant } = data;
  const tone = getStateTone(skillNode.state);
  const progress = clampProgress(skillNode.progress);
  const isCompact = variant === "compact";
  const label = getStateLabel(skillNode.state);
  const nodeSizeClass = isCompact
    ? "h-[58px] w-[58px]"
    : "h-[82px] w-[82px] sm:h-[98px] sm:w-[98px]";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-visible text-center",
        nodeSizeClass,
      )}
    >
      <Handle className="!opacity-0" position={Position.Top} type="source" />
      <Handle className="!opacity-0" position={Position.Bottom} type="target" />
      <div
        className={cn(
          "relative flex h-full w-full shrink-0 items-center justify-center transition duration-300",
          active ? "scale-110" : "hover:scale-105",
        )}
        style={{ color: tone.metal, opacity: tone.opacity }}
      >
        <span
          aria-hidden
          className="absolute -inset-5 rounded-full blur-2xl transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle, ${tone.halo}, transparent 66%)`,
            opacity: active ? 1 : 0.72,
          }}
        />
        <span
          aria-hidden
          className="absolute inset-0 rotate-45 rounded-[1.35rem] border bg-[linear-gradient(145deg,rgba(49,35,20,0.92),rgba(8,7,6,0.98)_62%,rgba(108,72,30,0.38))] shadow-[inset_0_0_18px_rgba(255,222,145,0.06)]"
          style={{
            borderColor: tone.edge,
            boxShadow: active
              ? `0 0 34px ${tone.glow}, inset 0 0 24px rgba(255,227,161,0.1)`
              : `0 0 18px ${tone.glow}, inset 0 0 18px rgba(255,227,161,0.06)`,
          }}
        />
        <span
          aria-hidden
          className="absolute inset-[8px] border bg-[radial-gradient(circle_at_35%_28%,rgba(255,226,156,0.14),rgba(18,13,9,0.95)_58%,rgba(3,3,3,1))]"
          style={{ borderColor: "rgba(235,196,116,0.34)", clipPath: OCTAGON_CLIP_PATH }}
        />
        <svg aria-hidden className="absolute inset-[5px] -rotate-90" viewBox="0 0 100 100">
          <title>能力进度</title>
          <circle
            cx="50"
            cy="50"
            fill="none"
            r="45"
            stroke="rgba(242,229,205,0.08)"
            strokeWidth="3"
          />
          <circle
            cx="50"
            cy="50"
            fill="none"
            r="45"
            stroke={tone.metal}
            strokeDasharray={`${progress * 2.827} 282.7`}
            strokeLinecap="round"
            strokeWidth="3.5"
          />
        </svg>
        <span className="relative z-10 flex h-full w-full items-center justify-center">
          <CareerRune node={skillNode} />
        </span>
      </div>
      <div
        className={cn(
          "pointer-events-none absolute top-full left-1/2 mt-3 -translate-x-1/2 text-center leading-5",
          isCompact ? "w-28 text-[11px]" : "w-32 sm:w-44",
        )}
      >
        <div
          className={cn(
            "line-clamp-2 font-semibold tracking-[-0.04em]",
            isCompact ? "text-[11px]" : "text-sm",
            active ? "text-[#f7e6bd]" : tone.text,
          )}
        >
          {skillNode.title}
        </div>
        {!isCompact ? (
          <div className="mt-0.5 text-[10px] tracking-[0.18em] text-[#8f7449]/80">
            {progress}% · {label}
          </div>
        ) : null}
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
          stroke: "rgba(0,0,0,0.82)",
          strokeLinecap: "round",
          strokeWidth: data?.kind === "career" ? 13 : 10,
        }}
      />
      <BaseEdge
        id={id}
        interactionWidth={22}
        path={path}
        style={{
          filter: data?.active ? "drop-shadow(0 0 10px rgba(216,172,88,0.48))" : undefined,
          opacity: data?.active ? 1 : tone.opacity,
          stroke: tone.edge,
          strokeDasharray: tone.dash,
          strokeLinecap: "round",
          strokeWidth: data?.active ? 5.4 : data?.kind === "career" ? 4 : 3.3,
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
  className,
}: CareerTreeGraphProps) {
  const instanceRef = useRef<ReactFlowInstance<CareerFlowNode, CareerFlowEdge> | null>(null);
  const [flowReadyVersion, setFlowReadyVersion] = useState(0);
  const isCompact = variant === "compact";
  const metrics = getLayoutMetrics(variant);
  const hasFutureCareers = graph.futureCareers.length > 0;
  const canvasHeight = hasFutureCareers ? metrics.canvasHeight : metrics.currentOnlyCanvasHeight;
  const elements = useMemo(
    () => buildFlowElements({ graph, activeNodeId, variant, maxDepth }),
    [activeNodeId, graph, maxDepth, variant],
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
        "relative min-w-0 overflow-hidden border border-[#3a2713] bg-[radial-gradient(circle_at_50%_8%,rgba(202,143,49,0.2),transparent_34%),radial-gradient(circle_at_20%_18%,rgba(95,61,26,0.2),transparent_30%),radial-gradient(circle_at_50%_86%,rgba(113,73,26,0.18),transparent_36%),linear-gradient(180deg,#090705_0%,#050403_100%)]",
        isCompact ? "rounded-[1.6rem]" : "rounded-[2.6rem]",
        className,
      )}
      style={CAREER_TREE_BLACK_GOLD_VARS}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.24]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(224,170,80,0.22) 0 1px, transparent 1.5px), radial-gradient(circle at 74% 42%, rgba(224,170,80,0.12) 0 1px, transparent 1.8px)",
          backgroundSize: "38px 46px, 62px 58px",
          maskImage: "radial-gradient(circle at center, black 12%, transparent 82%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(229,178,87,0.2),transparent_68%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-16 bottom-20 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#d8ac58]/30 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[8%] bottom-8 h-28 bg-[radial-gradient(ellipse_at_bottom,rgba(154,103,38,0.2),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(214,169,91,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(214,169,91,0.1) 1px, transparent 1px)",
          backgroundSize: isCompact ? "34px 34px" : "56px 56px",
          maskImage: "radial-gradient(circle at 50% 42%, black 0%, transparent 74%)",
        }}
      />
      {!isCompact ? (
        <div className="pointer-events-none absolute inset-x-6 top-5 z-20 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-[#a4773d]/80">
          <span>{hasFutureCareers ? "未来职业" : "当前主树"}</span>
          <span>能力根系</span>
        </div>
      ) : null}

      <div className="relative z-10 h-full min-w-0 w-full" style={{ height: canvasHeight }}>
        <ReactFlow<CareerFlowNode, CareerFlowEdge>
          className="h-full w-full"
          colorMode="dark"
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
