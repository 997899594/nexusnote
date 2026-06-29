"use client";

import {
  BaseEdge,
  type Edge,
  type EdgeProps,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ELK, ElkNode, ElkPoint } from "elkjs";
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

interface FlowNodeDimensions {
  width: number;
  height: number;
}

interface CareerLayoutMetrics {
  canvasHeight: string;
  fitPadding: number;
  minZoom: number;
  maxZoom: number;
  nodeGap: number;
  layerGap: number;
  edgeNodeGap: number;
  paddingX: number;
  paddingY: number;
  currentRole: FlowNodeDimensions;
  futureRole: FlowNodeDimensions;
  skill: FlowNodeDimensions;
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

interface CareerSkillLayoutNodeSpec {
  id: string;
  type: "careerSkill";
  skillNode: VisibleSkillTreeNode;
  width: number;
  height: number;
}

interface CareerRoleLayoutNodeSpec {
  id: string;
  type: "careerRole";
  role: CareerRoleNode;
  roleKind: "current" | "future";
  width: number;
  height: number;
}

type CareerLayoutNodeSpec = CareerSkillLayoutNodeSpec | CareerRoleLayoutNodeSpec;

interface CareerLayoutEdgeSpec {
  id: string;
  source: string;
  target: string;
  kind: "skill" | "career";
  state: CareerNodeState | "role";
  relatedNodeIds: string[];
  activeByDefault?: boolean;
}

interface CareerLayoutModel {
  signature: string;
  variant: CareerTreeGraphVariant;
  metrics: CareerLayoutMetrics;
  elkGraph: ElkNode;
  nodeSpecs: CareerLayoutNodeSpec[];
  edgeSpecs: CareerLayoutEdgeSpec[];
}

interface PositionedCareerLayout {
  modelSignature: string;
  signature: string;
  nodePositions: Map<string, ElkPoint>;
}

const CURRENT_CAREER_NODE_ID = "__current-career";
const FUTURE_CAREER_NODE_PREFIX = "__future-career:";
const TOP_LEFT_NODE_ORIGIN: [number, number] = [0, 0];
const FLOW_PRO_OPTIONS = { hideAttribution: true };

let elkEnginePromise: Promise<ELK> | null = null;

function getElkEngine(): Promise<ELK> {
  elkEnginePromise ??= import("elkjs/lib/elk.bundled.js").then(
    ({ default: ElkConstructor }) =>
      new ElkConstructor({
        algorithms: ["layered"],
      }),
  );

  return elkEnginePromise;
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, progress));
}

function getStateLabel(state: CareerNodeState): string {
  switch (state) {
    case "mastered":
      return "已掌握";
    case "in_progress":
      return "进行中";
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
        bg: "rgba(255,255,255,0.96)",
        border: "rgba(15,23,42,0.18)",
        edge: "rgba(15,23,42,0.6)",
        text: "text-[var(--color-text)]",
        muted: "text-[var(--color-text-tertiary)]",
        opacity: 1,
        dash: undefined,
      };
    case "mastered":
      return {
        accent: "#15803d",
        bg: "rgba(255,255,255,0.96)",
        border: "rgba(15,23,42,0.11)",
        edge: "rgba(71,85,105,0.58)",
        text: "text-[var(--color-text)]",
        muted: "text-[var(--color-text-tertiary)]",
        opacity: 1,
        dash: undefined,
      };
    case "in_progress":
      return {
        accent: "#2563eb",
        bg: "rgba(255,255,255,0.96)",
        border: "rgba(15,23,42,0.11)",
        edge: "rgba(71,85,105,0.58)",
        text: "text-[var(--color-text)]",
        muted: "text-[var(--color-text-tertiary)]",
        opacity: 1,
        dash: undefined,
      };
    case "ready":
      return {
        accent: "#64748b",
        bg: "rgba(255,255,255,0.94)",
        border: "rgba(15,23,42,0.1)",
        edge: "rgba(100,116,139,0.48)",
        text: "text-[var(--color-text-secondary)]",
        muted: "text-[var(--color-text-tertiary)]",
        opacity: 0.88,
        dash: undefined,
      };
    case "locked":
      return {
        accent: "#94a3b8",
        bg: "rgba(255,255,255,0.84)",
        border: "rgba(15,23,42,0.09)",
        edge: "rgba(148,163,184,0.4)",
        text: "text-[var(--color-text-tertiary)]",
        muted: "text-[var(--color-text-muted)]",
        opacity: 0.66,
        dash: "5 7",
      };
  }
}

function getLayoutMetrics(variant: CareerTreeGraphVariant): CareerLayoutMetrics {
  if (variant === "compact") {
    return {
      canvasHeight: "26rem",
      fitPadding: 0.1,
      minZoom: 0.12,
      maxZoom: 1.08,
      nodeGap: 16,
      layerGap: 48,
      edgeNodeGap: 10,
      paddingX: 28,
      paddingY: 28,
      currentRole: { width: 220, height: 58 },
      futureRole: { width: 196, height: 54 },
      skill: { width: 230, height: 72 },
    };
  }

  return {
    canvasHeight: "32rem",
    fitPadding: 0.11,
    minZoom: 0.16,
    maxZoom: 1.12,
    nodeGap: 28,
    layerGap: 72,
    edgeNodeGap: 16,
    paddingX: 56,
    paddingY: 38,
    currentRole: { width: 286, height: 70 },
    futureRole: { width: 248, height: 64 },
    skill: { width: 300, height: 82 },
  };
}

function getFutureCareerNodeId(roleKey: string): string {
  return `${FUTURE_CAREER_NODE_PREFIX}${roleKey}`;
}

function buildSkillSignature(nodes: VisibleSkillTreeNode[], maxDepth: number | undefined): string {
  function visit(node: VisibleSkillTreeNode, depth: number): string {
    if (maxDepth != null && depth >= maxDepth) {
      return node.id;
    }

    return `${node.id}(${node.children.map((child) => visit(child, depth + 1)).join(",")})`;
  }

  return nodes.map((node) => visit(node, 0)).join("|");
}

function buildCareerLayoutModel(params: {
  graph: CareerDevelopmentGraph;
  variant: CareerTreeGraphVariant;
  maxDepth?: number;
}): CareerLayoutModel {
  const metrics = getLayoutMetrics(params.variant);
  const nodeSpecs: CareerLayoutNodeSpec[] = [];
  const edgeSpecs: CareerLayoutEdgeSpec[] = [];

  for (const role of params.graph.futureCareers) {
    const nodeId = getFutureCareerNodeId(role.key);
    nodeSpecs.push({
      id: nodeId,
      type: "careerRole",
      role,
      roleKind: "future",
      width: metrics.futureRole.width,
      height: metrics.futureRole.height,
    });
    edgeSpecs.push({
      id: `career-future:${nodeId}:${CURRENT_CAREER_NODE_ID}`,
      source: nodeId,
      target: CURRENT_CAREER_NODE_ID,
      kind: "career",
      state: "role",
      relatedNodeIds: [role.key, nodeId, CURRENT_CAREER_NODE_ID],
      activeByDefault: role.isSelected || role.isRecommended,
    });
  }

  nodeSpecs.push({
    id: CURRENT_CAREER_NODE_ID,
    type: "careerRole",
    role: params.graph.currentCareer,
    roleKind: "current",
    width: metrics.currentRole.width,
    height: metrics.currentRole.height,
  });

  function visitSkill(node: VisibleSkillTreeNode, depth: number, parentId: string | null) {
    nodeSpecs.push({
      id: node.id,
      type: "careerSkill",
      skillNode: node,
      width: metrics.skill.width,
      height: metrics.skill.height,
    });

    edgeSpecs.push({
      id: parentId
        ? `skill:${parentId}:${node.id}`
        : `career-root:${CURRENT_CAREER_NODE_ID}:${node.id}`,
      source: parentId ?? CURRENT_CAREER_NODE_ID,
      target: node.id,
      kind: parentId ? "skill" : "career",
      state: parentId ? node.state : "role",
      relatedNodeIds: parentId ? [parentId, node.id] : [CURRENT_CAREER_NODE_ID, node.id],
    });

    if (params.maxDepth != null && depth >= params.maxDepth) {
      return;
    }

    for (const child of node.children) {
      visitSkill(child, depth + 1, node.id);
    }
  }

  for (const root of params.graph.skillRoots) {
    visitSkill(root, 0, null);
  }

  const elkGraph: ElkNode = {
    id: "career-tree",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": String(metrics.nodeGap),
      "elk.spacing.edgeNode": String(metrics.edgeNodeGap),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(metrics.layerGap),
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.cycleBreaking.strategy": "GREEDY",
      "elk.padding": `[top=${metrics.paddingY},left=${metrics.paddingX},bottom=${metrics.paddingY},right=${metrics.paddingX}]`,
    },
    children: nodeSpecs.map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height,
    })),
    edges: edgeSpecs.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  return {
    signature: [
      params.variant,
      params.maxDepth ?? "all",
      params.graph.currentCareer.key,
      params.graph.futureCareers.map((role) => role.key).join(","),
      buildSkillSignature(params.graph.skillRoots, params.maxDepth),
    ].join("::"),
    variant: params.variant,
    metrics,
    elkGraph,
    nodeSpecs,
    edgeSpecs,
  };
}

function shiftLayoutIntoViewport(params: {
  modelSignature: string;
  layoutedGraph: ElkNode;
  model: CareerLayoutModel;
}): PositionedCareerLayout {
  const childById = new Map(
    (params.layoutedGraph.children ?? []).map((child) => [child.id, child]),
  );
  const rawNodePositions = new Map<string, ElkPoint>();
  const points: ElkPoint[] = [];

  for (const spec of params.model.nodeSpecs) {
    const child = childById.get(spec.id);
    const point = { x: child?.x ?? 0, y: child?.y ?? 0 };
    rawNodePositions.set(spec.id, point);
  }

  const layerByY = new Map<number, CareerLayoutNodeSpec[]>();
  for (const spec of params.model.nodeSpecs) {
    const position = rawNodePositions.get(spec.id);
    if (!position) {
      continue;
    }

    const layerKey = Math.round(position.y / 8) * 8;
    layerByY.set(layerKey, [...(layerByY.get(layerKey) ?? []), spec]);
  }

  const spineOffset = params.model.variant === "compact" ? 26 : 44;
  for (const specs of layerByY.values()) {
    if (specs.length !== 1) {
      continue;
    }

    const [spec] = specs;
    const position = rawNodePositions.get(spec.id);
    if (!position) {
      continue;
    }

    if (spec.type === "careerRole" && spec.roleKind === "future") {
      position.x -= spineOffset;
    }

    if (spec.type === "careerSkill") {
      position.x += spineOffset;
    }
  }

  points.push(...rawNodePositions.values());

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const shiftX = Number.isFinite(minX) && minX < 24 ? 24 - minX : 0;
  const shiftY = Number.isFinite(minY) && minY < 20 ? 20 - minY : 0;
  const nodePositions = new Map<string, ElkPoint>();

  for (const [id, point] of rawNodePositions) {
    nodePositions.set(id, {
      x: point.x + shiftX,
      y: point.y + shiftY,
    });
  }

  return {
    modelSignature: params.modelSignature,
    signature: params.model.nodeSpecs
      .map((node) => {
        const position = nodePositions.get(node.id);
        return `${node.id}:${Math.round(position?.x ?? 0)}:${Math.round(position?.y ?? 0)}`;
      })
      .join("|"),
    nodePositions,
  };
}

function isPlanningHighlighted(
  ids: string[],
  planningHighlightNodeIds: Set<string>,
  activeNodeId?: string | null,
): boolean {
  return ids.some((id) => planningHighlightNodeIds.has(id) || id === activeNodeId);
}

function buildFlowElements(params: {
  model: CareerLayoutModel;
  layout: PositionedCareerLayout | null;
  activeNodeId?: string | null;
  planningHighlightNodeIds?: string[];
}): { nodes: CareerFlowNode[]; edges: CareerFlowEdge[]; signature: string } | null {
  if (!params.layout || params.layout.modelSignature !== params.model.signature) {
    return null;
  }

  const planningHighlightNodeIds = new Set(params.planningHighlightNodeIds ?? []);
  const nodes = params.model.nodeSpecs.map<CareerFlowNode>((spec) => {
    const position = params.layout?.nodePositions.get(spec.id) ?? { x: 0, y: 0 };

    if (spec.type === "careerSkill") {
      const active = spec.skillNode.id === params.activeNodeId;
      const planningHighlighted = planningHighlightNodeIds.has(spec.skillNode.id);

      return {
        id: spec.id,
        type: "careerSkill",
        position,
        initialWidth: spec.width,
        initialHeight: spec.height,
        style: {
          height: spec.height,
          width: spec.width,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          skillNode: spec.skillNode,
          variant: params.model.variant,
          active,
          planningHighlighted,
        },
        selectable: false,
        draggable: false,
        zIndex: active || planningHighlighted ? 5 : 2,
      };
    }

    const relatedIds = [
      spec.role.key,
      spec.id,
      spec.roleKind === "current" ? CURRENT_CAREER_NODE_ID : getFutureCareerNodeId(spec.role.key),
    ];
    const planningHighlighted = isPlanningHighlighted(
      relatedIds,
      planningHighlightNodeIds,
      params.activeNodeId,
    );

    return {
      id: spec.id,
      type: "careerRole",
      position,
      initialWidth: spec.width,
      initialHeight: spec.height,
      style: {
        height: spec.height,
        width: spec.width,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        role: spec.role,
        roleKind: spec.roleKind,
        variant: params.model.variant,
        planningHighlighted,
      },
      selectable: false,
      draggable: false,
      zIndex: spec.roleKind === "current" ? 4 : 3,
    };
  });

  const edges = params.model.edgeSpecs.map<CareerFlowEdge>((spec) => ({
    id: spec.id,
    source: spec.source,
    target: spec.target,
    type: "careerBranch",
    data: {
      state: spec.state,
      kind: spec.kind,
      active:
        Boolean(spec.activeByDefault) ||
        isPlanningHighlighted(spec.relatedNodeIds, planningHighlightNodeIds, params.activeNodeId),
    },
    selectable: false,
    focusable: false,
    reconnectable: false,
  }));

  return {
    nodes,
    edges,
    signature: `${params.layout.signature}:${params.activeNodeId ?? "none"}:${[
      ...planningHighlightNodeIds,
    ].join(",")}`,
  };
}

function formatRoleMeta(role: CareerRoleNode): string {
  return `${role.visibleNodeCount} 能力`;
}

function getRoleLabel(role: CareerRoleNode, roleKind: CareerRoleNodeData["roleKind"]): string {
  if (roleKind === "current") {
    return "当前职业";
  }

  if (role.source === "candidate_tree") {
    return "可发展方向";
  }

  return role.horizon === "next" ? "下一阶段" : "长期方向";
}

function HiddenFlowHandles() {
  return (
    <>
      <Handle
        className="!h-0 !w-0 !border-0 !bg-transparent !opacity-0"
        position={Position.Top}
        type="target"
      />
      <Handle
        className="!h-0 !w-0 !border-0 !bg-transparent !opacity-0"
        position={Position.Bottom}
        type="source"
      />
    </>
  );
}

function CareerRoleNodeView({ data }: NodeProps<CareerRoleFlowNode>) {
  const isCompact = data.variant === "compact";
  const isCurrent = data.roleKind === "current";
  const roleLabel = getRoleLabel(data.role, data.roleKind);
  const metaLabel = formatRoleMeta(data.role);
  const statusLabel = data.role.isSelected ? "已选" : data.role.isRecommended ? "推荐" : "";

  return (
    <div className="relative h-full w-full">
      <HiddenFlowHandles />
      <div
        className={cn(
          "flex h-full w-full items-center gap-3 overflow-hidden rounded-[18px] border px-4 text-left transition-colors",
          isCurrent
            ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_42px_-30px_rgba(15,23,42,0.72)]"
            : "border-black/[0.08] bg-white text-[var(--color-text)] shadow-[0_14px_34px_-30px_rgba(15,23,42,0.28)]",
          data.planningHighlighted && "ring-2 ring-slate-900/12",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            isCurrent ? "bg-white" : "bg-slate-950",
          )}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block whitespace-normal font-semibold leading-tight tracking-[-0.03em]",
              isCompact ? "line-clamp-2 text-xs" : "line-clamp-2 text-[0.92rem]",
            )}
          >
            {data.role.title}
          </span>
          <span
            className={cn(
              "mt-1 block truncate text-[0.625rem] leading-none",
              isCurrent ? "text-white/62" : "text-[var(--color-text-tertiary)]",
            )}
          >
            {statusLabel ? `${statusLabel} · ` : ""}
            {isCompact ? roleLabel : `${roleLabel} · ${metaLabel}`}
          </span>
        </span>
      </div>
    </div>
  );
}

function CareerSkillNode({ data }: NodeProps<CareerSkillFlowNode>) {
  const { skillNode, active, planningHighlighted, variant } = data;
  const tone = getStateTone(skillNode.state);
  const progress = clampProgress(skillNode.progress);
  const isCompact = variant === "compact";
  const label = getStateLabel(skillNode.state);

  return (
    <div className="relative h-full w-full">
      <HiddenFlowHandles />
      <div
        className={cn(
          "group flex h-full w-full flex-col justify-between overflow-hidden rounded-[18px] border bg-white px-3.5 py-3 text-left transition duration-200",
          active || planningHighlighted
            ? "border-slate-950/22 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.5)] ring-2 ring-slate-950/10"
            : "shadow-[0_10px_24px_-24px_rgba(15,23,42,0.3)]",
          skillNode.state === "locked" && "border-dashed",
        )}
        style={{
          background: tone.bg,
          borderColor: active || planningHighlighted ? undefined : tone.border,
          opacity: tone.opacity,
        }}
      >
        <div className="flex min-w-0 items-start gap-2">
          <span
            aria-hidden
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: tone.accent }}
          />
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "line-clamp-2 whitespace-normal font-semibold leading-snug tracking-[-0.025em]",
                isCompact ? "text-[0.78rem]" : "text-[0.92rem]",
                active ? "text-[var(--color-text)]" : tone.text,
              )}
            >
              {skillNode.title}
            </div>
            {!isCompact ? (
              <div className={cn("mt-1.5 text-[0.625rem] leading-none", tone.muted)}>{label}</div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/80">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: tone.accent,
              }}
            />
          </div>
          <span className={cn("shrink-0 text-[0.625rem] tabular-nums", tone.muted)}>
            {progress}
          </span>
        </div>

        <div className="sr-only">
          {label}，进度 {progress}%
        </div>
      </div>
    </div>
  );
}

function getLaneSide(edgeId: string, kind: CareerBranchEdgeData["kind"] | undefined): number {
  if (edgeId.startsWith("career-future:")) {
    return -1;
  }

  if (kind === "skill") {
    return edgeId.length % 2 === 0 ? 1 : -1;
  }

  return 1;
}

function getRoundedHierarchyPath(points: ElkPoint[], radius = 11): string {
  const [start] = points;
  if (!start) {
    return "";
  }

  const commands = [`M ${start.x},${start.y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    if (!previous || !current || !next) {
      continue;
    }

    const previousDistance = Math.hypot(current.x - previous.x, current.y - previous.y);
    const nextDistance = Math.hypot(next.x - current.x, next.y - current.y);
    if (previousDistance === 0 || nextDistance === 0) {
      commands.push(`L ${current.x},${current.y}`);
      continue;
    }

    const cornerRadius = Math.min(radius, previousDistance / 2, nextDistance / 2);
    const before = {
      x: current.x - ((current.x - previous.x) / previousDistance) * cornerRadius,
      y: current.y - ((current.y - previous.y) / previousDistance) * cornerRadius,
    };
    const after = {
      x: current.x + ((next.x - current.x) / nextDistance) * cornerRadius,
      y: current.y + ((next.y - current.y) / nextDistance) * cornerRadius,
    };

    commands.push(`L ${before.x},${before.y}`);
    commands.push(`Q ${current.x},${current.y} ${after.x},${after.y}`);
  }

  const end = points[points.length - 1];
  if (end) {
    commands.push(`L ${end.x},${end.y}`);
  }

  return commands.join(" ");
}

function getStructuredConnectorPath(params: {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  kind: CareerBranchEdgeData["kind"] | undefined;
}): string {
  const verticalDistance = Math.abs(params.targetY - params.sourceY);
  const horizontalDistance = Math.abs(params.targetX - params.sourceX);
  const side = getLaneSide(params.id, params.kind);
  const stem = Math.min(34, Math.max(18, verticalDistance * 0.22));
  const branchY = params.sourceY + verticalDistance * 0.5;
  const laneX =
    horizontalDistance < 18
      ? params.sourceX + side * Math.min(52, Math.max(30, verticalDistance * 0.2))
      : params.targetX;

  return getRoundedHierarchyPath([
    { x: params.sourceX, y: params.sourceY },
    { x: params.sourceX, y: params.sourceY + stem },
    { x: laneX, y: params.sourceY + stem },
    { x: laneX, y: branchY },
    { x: params.targetX, y: branchY },
    { x: params.targetX, y: params.targetY },
  ]);
}

function CareerBranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<CareerFlowEdge>) {
  const tone = getStateTone(data?.state ?? "locked");
  const path = getStructuredConnectorPath({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    kind: data?.kind,
  });

  return (
    <>
      <BaseEdge
        id={id}
        interactionWidth={18}
        path={path}
        style={{
          opacity: data?.active ? 1 : tone.opacity,
          stroke: tone.edge,
          strokeDasharray: tone.dash,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeWidth: data?.active ? 2.4 : data?.kind === "career" ? 2 : 1.7,
        }}
      />
      <circle
        cx={targetX}
        cy={targetY}
        fill="white"
        r={data?.active ? 3.6 : 3}
        stroke={tone.edge}
        strokeWidth={1.7}
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
  const [positionedLayout, setPositionedLayout] = useState<PositionedCareerLayout | null>(null);
  const [layoutFailed, setLayoutFailed] = useState(false);
  const isCompact = variant === "compact";
  const layoutModel = useMemo(
    () => buildCareerLayoutModel({ graph, variant, maxDepth }),
    [graph, maxDepth, variant],
  );
  const elements = useMemo(
    () =>
      buildFlowElements({
        model: layoutModel,
        layout: positionedLayout,
        activeNodeId,
        planningHighlightNodeIds,
      }),
    [activeNodeId, layoutModel, planningHighlightNodeIds, positionedLayout],
  );

  useEffect(() => {
    let cancelled = false;
    setLayoutFailed(false);

    getElkEngine()
      .then((engine) => engine.layout(layoutModel.elkGraph))
      .then((layoutedGraph) => {
        if (cancelled) {
          return;
        }

        setPositionedLayout(
          shiftLayoutIntoViewport({
            modelSignature: layoutModel.signature,
            layoutedGraph,
            model: layoutModel,
          }),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPositionedLayout(null);
          setLayoutFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [layoutModel]);

  useEffect(() => {
    if (!elements?.signature || flowReadyVersion === 0) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      void instanceRef.current?.fitView({
        duration: 320,
        padding: layoutModel.metrics.fitPadding,
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [elements?.signature, flowReadyVersion, layoutModel.metrics.fitPadding]);

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden border border-black/[0.055] bg-white",
        isCompact ? "rounded-[24px]" : "rounded-[28px]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.38]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px)",
          backgroundSize: isCompact ? "28px 28px" : "36px 36px",
          maskImage: "linear-gradient(180deg, transparent, black 12%, black 88%, transparent)",
        }}
      />
      <div
        className="relative z-10 h-full min-w-0 w-full"
        style={{ height: layoutModel.metrics.canvasHeight }}
      >
        {elements ? (
          <ReactFlow<CareerFlowNode, CareerFlowEdge>
            className="h-full w-full"
            colorMode="light"
            edges={elements.edges}
            edgeTypes={EDGE_TYPES}
            edgesFocusable={!isCompact}
            elementsSelectable={false}
            fitView
            fitViewOptions={{ padding: layoutModel.metrics.fitPadding }}
            maxZoom={layoutModel.metrics.maxZoom}
            minZoom={layoutModel.metrics.minZoom}
            nodes={elements.nodes}
            nodesConnectable={false}
            nodesDraggable={false}
            nodesFocusable={!isCompact}
            nodeOrigin={TOP_LEFT_NODE_ORIGIN}
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
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs font-medium text-[var(--color-text-tertiary)]">
            {layoutFailed ? "职业树布局失败，请刷新后重试" : "正在整理职业路径"}
          </div>
        )}
      </div>
    </div>
  );
}
