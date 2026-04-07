"use client";

import {
  Background,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  Panel,
  Position,
  ReactFlow,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Compass,
  Cpu,
  Database,
  Lock,
  Orbit,
  Rocket,
  Sparkles,
  TargetIcon,
  Target,
  Wrench,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import type {
  GoldenPathDomainSnapshot,
  GoldenPathLinkedCourse,
  GoldenPathNodeSnapshot,
  GoldenPathRouteSnapshot,
  GoldenPathSkillState,
  GoldenPathSnapshot,
} from "@/lib/golden-path/types";
import { cn } from "@/lib/utils";

type FlowNodeKind = "route" | "domain" | "skill";

type FlowNodeData = Record<string, unknown> & {
  kind: FlowNodeKind;
  label: string;
  description?: string;
  progress?: number;
  state?: GoldenPathSkillState;
  recommended?: boolean;
  systemMain?: boolean;
  meta?: string;
};

interface GoldenPathExplorerProps {
  snapshot: GoldenPathSnapshot;
  selectedPathId?: string;
}

function getDomainIcon(domainId: string) {
  switch (domainId) {
    case "product":
      return Brain;
    case "frontend":
      return Orbit;
    case "backend":
      return Wrench;
    case "ai-systems":
      return Cpu;
    case "data":
      return Database;
    case "automation":
      return Rocket;
    case "growth":
      return TargetIcon;
    case "delivery":
      return Waypoints;
    default:
      return Compass;
  }
}

function getRouteStageLabel(route: GoldenPathRouteSnapshot): string {
  if (route.masteredCount >= 4 || route.progress >= 68) {
    return "主线成型";
  }

  if (route.inProgressCount >= 3 || route.progress >= 36) {
    return "正在点亮";
  }

  return "刚开始收敛";
}

function getStateLabel(state: GoldenPathSkillState): string {
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

function getStateTone(state: GoldenPathSkillState): string {
  switch (state) {
    case "mastered":
      return "border-[#e0bc63]/80 bg-[#231a0c] text-[#f7dfaa] shadow-[0_0_0_1px_rgba(224,188,99,0.18),0_18px_36px_-28px_rgba(224,188,99,0.48)]";
    case "in_progress":
      return "border-[#b88942]/60 bg-[#1f1911] text-[#edd4a6] shadow-[0_0_0_1px_rgba(184,137,66,0.14),0_12px_28px_-24px_rgba(184,137,66,0.36)]";
    case "ready":
      return "border-[#5e5646]/70 bg-[#171512] text-[#e5ddce]";
    case "locked":
      return "border-white/10 bg-white/[0.04] text-white/45";
  }
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "最近";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatChapterProgress(completedSections: number, totalSections: number): string {
  if (totalSections <= 0) {
    return "待生成内容";
  }

  return `${completedSections}/${totalSections} 节`;
}

function sortSkills(left: GoldenPathNodeSnapshot, right: GoldenPathNodeSnapshot): number {
  const statePriority = {
    in_progress: 0,
    ready: 1,
    mastered: 2,
    locked: 3,
  } as const;

  return (
    statePriority[left.state] - statePriority[right.state] ||
    right.importance - left.importance ||
    right.progressScore - left.progressScore
  );
}

function getSkillRelatedLearning(
  skill: GoldenPathNodeSnapshot,
  linkedLearning: GoldenPathLinkedCourse[],
): Array<
  GoldenPathLinkedCourse & {
    relatedChapters: GoldenPathLinkedCourse["matchedChapters"];
  }
> {
  return linkedLearning
    .filter((course) => skill.linkedCourseIds.includes(course.courseId))
    .map((course) => ({
      ...course,
      relatedChapters: course.matchedChapters.filter(
        (chapter) =>
          skill.linkedChapterKeys.includes(chapter.key) ||
          chapter.matchedSkills.includes(skill.name),
      ),
    }))
    .sort((left, right) => {
      const leftScore =
        left.relatedChapters.length * 18 + left.progressPercent + left.matchedSkills.length * 6;
      const rightScore =
        right.relatedChapters.length * 18 + right.progressPercent + right.matchedSkills.length * 6;
      return rightScore - leftScore;
    })
    .slice(0, 3);
}

function buildRouteReason(route: GoldenPathRouteSnapshot): string {
  const topCourse = route.linkedLearning[0];
  if (topCourse && topCourse.matchedSkills.length > 0) {
    return `最近课程更集中在 ${topCourse.matchedSkills.slice(0, 3).join(" · ")}`;
  }

  return `当前证据更偏向 ${route.domains
    .slice(0, 2)
    .map((domain) => domain.name)
    .join(" / ")}`;
}

function chooseDomainIdForSkill(
  route: GoldenPathRouteSnapshot,
  skill: GoldenPathNodeSnapshot,
): string | null {
  for (const domainId of route.domainIds) {
    if (skill.domainIds.includes(domainId)) {
      return domainId;
    }
  }

  return skill.domainIds[0] ?? null;
}

function buildTreeElements(
  route: GoldenPathRouteSnapshot,
  options: { isSystemMain: boolean },
): {
  nodes: Array<Node<FlowNodeData>>;
  edges: Array<Edge>;
  defaultSelectedNodeId: string;
} {
  const nodes: Array<Node<FlowNodeData>> = [];
  const edges: Array<Edge> = [];

  const routeNodeId = `route:${route.id}`;
  const routeSkillIds = new Set(route.domains.flatMap((domain) => domain.nodes.map((node) => node.id)));
  const recommendedSkillId = route.nextActions[0]?.id;
  const defaultSelectedNodeId = recommendedSkillId ? `skill:${recommendedSkillId}` : routeNodeId;

  nodes.push({
    id: routeNodeId,
    type: "destinyRoute",
    position: { x: 0, y: 0 },
    data: {
      kind: "route",
      label: route.name,
      description: route.tagline,
      progress: route.progress,
      meta: `匹配度 ${route.fitScore}%`,
      systemMain: options.isSystemMain,
    },
    draggable: false,
    selectable: true,
  });

  const leftDomainIndexes = route.domains
    .map((_, index) => index)
    .filter((index) => index % 2 === 0);
  const rightDomainIndexes = route.domains
    .map((_, index) => index)
    .filter((index) => index % 2 === 1);

  const groupedSkills = new Map<string, GoldenPathNodeSnapshot[]>();
  for (const domain of route.domains) {
    groupedSkills.set(domain.id, []);
  }

  const uniqueRouteSkills = [
    ...new Map(
      route.domains.flatMap((domain) => domain.nodes).map((skill) => [skill.id, skill]),
    ).values(),
  ];

  for (const skill of uniqueRouteSkills) {
    const domainId = chooseDomainIdForSkill(route, skill);
    if (!domainId) {
      continue;
    }
    groupedSkills.set(domainId, [...(groupedSkills.get(domainId) ?? []), skill]);
  }

  route.domains.forEach((domain, domainIndex) => {
    const isLeftBranch = domainIndex % 2 === 0;
    const sideIndex = isLeftBranch
      ? leftDomainIndexes.indexOf(domainIndex)
      : rightDomainIndexes.indexOf(domainIndex);
    const domainOffsetX = 250 + sideIndex * 32;
    const domainX = isLeftBranch ? -domainOffsetX : domainOffsetX;
    const domainY = 220 + sideIndex * 170 + (isLeftBranch ? 0 : 52);
    const domainNodeId = `domain:${domain.id}`;

    nodes.push({
      id: domainNodeId,
      type: "destinyDomain",
      position: { x: domainX, y: domainY },
      data: {
        kind: "domain",
        label: domain.name,
        description: domain.description,
        progress: domain.progress,
        meta: `${domain.masteredCount} 已掌握 · ${domain.inProgressCount} 推进中`,
      },
      draggable: false,
      selectable: true,
    });

    edges.push({
      id: `${routeNodeId}-${domainNodeId}`,
      source: routeNodeId,
      target: domainNodeId,
      type: "smoothstep",
      style: {
        stroke: "rgba(224,188,99,0.48)",
        strokeWidth: 2,
      },
    });

    const skills = [...(groupedSkills.get(domain.id) ?? [])].sort(sortSkills);
    const outwardBase = isLeftBranch ? -190 : 190;
    const outwardStep = isLeftBranch ? -88 : 88;
    const rowGap = 96;

    skills.forEach((skill, skillIndex) => {
      const branchDepth = Math.floor(skillIndex / 2);
      const branchRow = skillIndex % 2;
      const skillX = domainX + outwardBase + branchDepth * outwardStep;
      const verticalBias = branchRow === 0 ? -18 : 56;
      const skillY = domainY + 110 + branchDepth * rowGap + verticalBias;
      const skillNodeId = `skill:${skill.id}`;

      nodes.push({
        id: skillNodeId,
        type: "destinySkill",
        position: { x: skillX, y: skillY },
        data: {
          kind: "skill",
          label: skill.name,
          description: skill.description,
          progress: skill.progressScore,
          state: skill.state,
          recommended: skill.id === recommendedSkillId,
          meta: `${getStateLabel(skill.state)} · ${skill.progressScore}%`,
        },
        draggable: false,
        selectable: true,
      });

      edges.push({
        id: `${domainNodeId}-${skillNodeId}`,
        source: domainNodeId,
        target: skillNodeId,
        type: "smoothstep",
        style: {
          stroke:
            skill.state === "mastered"
              ? "rgba(224,188,99,0.42)"
              : skill.state === "in_progress"
                ? "rgba(184,137,66,0.36)"
                : "rgba(255,255,255,0.14)",
          strokeWidth: skill.id === recommendedSkillId ? 2.4 : 1.4,
        },
      });
    });
  });

  for (const skill of uniqueRouteSkills) {
    for (const prerequisiteId of skill.prerequisites ?? []) {
      if (!routeSkillIds.has(prerequisiteId)) {
        continue;
      }

      edges.push({
        id: `skill:${prerequisiteId}-skill:${skill.id}`,
        source: `skill:${prerequisiteId}`,
        target: `skill:${skill.id}`,
        type: "smoothstep",
        animated: skill.id === recommendedSkillId,
        style: {
          stroke: "rgba(231,199,114,0.28)",
          strokeWidth: 1.4,
          strokeDasharray: "5 5",
        },
      });
    }
  }

  return { nodes, edges, defaultSelectedNodeId };
}

function DestinyRouteNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div
      className={cn(
        "min-w-[280px] rounded-[30px] border border-[#e1bc63]/35 bg-[radial-gradient(circle_at_top_left,rgba(231,199,114,0.16),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(231,199,114,0.08),transparent_30%),linear-gradient(180deg,#19150f_0%,#151310_100%)] px-5 py-4 text-white shadow-[0_32px_70px_-42px_rgba(224,188,99,0.55)]",
        selected && "ring-2 ring-[#e1bc63]/50 ring-offset-2 ring-offset-transparent",
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-[#e1bc63]" />
      <div className="flex items-center justify-between gap-3">
        <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/45">
          {data.systemMain ? "系统推断主线" : "相关候选命途"}
        </div>
        <div className="rounded-full border border-[#e1bc63]/18 bg-[#e1bc63]/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#f4ddb0]">
          {data.systemMain ? "route core" : "candidate"}
        </div>
      </div>
      <div className="mt-2 text-xl font-semibold tracking-[-0.04em]">{data.label}</div>
      <div className="mt-2 text-sm leading-6 text-white/65">{data.description}</div>
      <div className="mt-4 flex items-center justify-between text-sm text-white/70">
        <span>{data.meta}</span>
        <span>{data.progress}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#a97a26_0%,#e1bc63_60%,#f4ddb0_100%)]"
          style={{ width: `${Math.max(10, Number(data.progress ?? 0))}%` }}
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-[#e1bc63]" />
    </div>
  );
}

function DestinyDomainNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div
      className={cn(
        "min-w-[176px] rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.38)] backdrop-blur-sm",
        selected && "ring-2 ring-white/20 ring-offset-2 ring-offset-transparent",
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-white/50" />
      <div className="text-xs font-semibold tracking-[0.03em] text-white">{data.label}</div>
      <div className="mt-1 text-[11px] leading-5 text-white/50">{data.description}</div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-white/60">
        <span>{data.meta}</span>
        <span>{data.progress}%</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.max(8, Number(data.progress ?? 0))}%` }} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-white/50" />
    </div>
  );
}

function DestinySkillNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div
      className={cn(
        "min-w-[156px] rounded-[20px] border px-3.5 py-3 text-left shadow-[0_16px_32px_-26px_rgba(15,23,42,0.42)] backdrop-blur-sm",
        data.state ? getStateTone(data.state) : "border-white/10 bg-white/[0.04] text-white/60",
        data.recommended && "ring-2 ring-[#e1bc63]/60 ring-offset-2 ring-offset-transparent",
        selected && "translate-y-[-1px]",
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-current opacity-50" />
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-current opacity-75" />
            <div className="text-sm font-medium leading-5">{data.label}</div>
          </div>
          <div className="mt-1 text-[11px] opacity-70">{data.meta}</div>
        </div>
        {data.recommended ? (
          <span className="rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] opacity-85">
            推荐
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/15">
        <div
          className="h-full rounded-full bg-current opacity-70"
          style={{ width: `${Math.max(8, data.progress ?? 0)}%` }}
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-current opacity-50" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  destinyRoute: DestinyRouteNode,
  destinyDomain: DestinyDomainNode,
  destinySkill: DestinySkillNode,
};

function RouteSignal({
  route,
  isSystemMain,
  isViewing,
  onSelect,
}: {
  route: GoldenPathRouteSnapshot;
  isSystemMain: boolean;
  isViewing: boolean;
  onSelect: () => void;
}) {
  const domainIcons = route.domainIds.slice(0, 3).map((domainId) => {
    const Icon = getDomainIcon(domainId);
    return <Icon key={domainId} className="h-3.5 w-3.5" />;
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-[24px] border px-4 py-4 text-left transition-all",
        isViewing
          ? "border-[#d3b162] bg-[radial-gradient(circle_at_top_left,rgba(224,188,99,0.16),transparent_32%),linear-gradient(180deg,#16120d_0%,#120f0b_100%)] text-white shadow-[0_24px_52px_-34px_rgba(224,188,99,0.42)]"
          : "border-white/10 bg-white/[0.04] text-white/72 hover:border-white/18 hover:bg-white/[0.06]",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
        {isSystemMain ? (
          <span className="rounded-full border border-[#d3b162]/25 bg-[#d3b162]/12 px-2 py-0.5 text-[#efd79d]">
            系统主线
          </span>
        ) : null}
        {isViewing ? (
          <span className="rounded-full border border-white/10 bg-white/[0.08] px-2 py-0.5 text-white/70">
            当前查看
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold tracking-[-0.03em]">{route.name}</div>
          <div className="mt-1 text-sm text-inherit/70">{buildRouteReason(route)}</div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-inherit/70">
            {domainIcons}
            <span>{getRouteStageLabel(route)}</span>
          </div>
        </div>
        <div className="text-right text-sm">
          <div>{route.fitScore}%</div>
          <div className="mt-1 text-inherit/55">进度 {route.progress}%</div>
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full",
            isViewing
              ? "bg-[linear-gradient(90deg,#9a6e24_0%,#d3b162_60%,#f0dca8_100%)]"
              : "bg-white/35",
          )}
          style={{ width: `${Math.max(8, route.progress)}%` }}
        />
      </div>
    </button>
  );
}

export function GoldenPathExplorer({ snapshot, selectedPathId }: GoldenPathExplorerProps) {
  const router = useRouter();
  const initialRoute =
    snapshot.routes.find((route) => route.id === selectedPathId) ??
    snapshot.routes.find((route) => route.id === snapshot.mainRouteId) ??
    snapshot.routes[0];

  const [viewingRouteId, setViewingRouteId] = useState(initialRoute?.id ?? "");
  const selectedRoute =
    snapshot.routes.find((route) => route.id === viewingRouteId) ??
    snapshot.routes.find((route) => route.id === snapshot.mainRouteId) ??
    snapshot.routes[0];

  const { nodes: baseNodes, edges, defaultSelectedNodeId } = useMemo(() => {
    if (!selectedRoute) {
      return {
        nodes: [] as Array<Node<FlowNodeData>>,
        edges: [] as Array<Edge>,
        defaultSelectedNodeId: "",
      };
    }
    return buildTreeElements(selectedRoute, {
      isSystemMain: selectedRoute.id === snapshot.mainRouteId,
    });
  }, [selectedRoute, snapshot.mainRouteId]);

  const [activeNodeId, setActiveNodeId] = useState(defaultSelectedNodeId);

  useEffect(() => {
    if (!selectedRoute) {
      return;
    }
    setViewingRouteId(selectedRoute.id);
    setActiveNodeId(defaultSelectedNodeId);
  }, [selectedRoute?.id, defaultSelectedNodeId]);

  const nodes = useMemo(
    () =>
      baseNodes.map((node) => ({
        ...node,
        selected: node.id === activeNodeId,
      })),
    [baseNodes, activeNodeId],
  );

  const activeSkill = useMemo(() => {
    if (!selectedRoute || !activeNodeId.startsWith("skill:")) {
      return null;
    }
    const skillId = activeNodeId.replace("skill:", "");
    return selectedRoute.domains.flatMap((domain) => domain.nodes).find((node) => node.id === skillId) ?? null;
  }, [activeNodeId, selectedRoute]);

  const activeDomain = useMemo(() => {
    if (!selectedRoute || !activeNodeId.startsWith("domain:")) {
      return null;
    }
    const domainId = activeNodeId.replace("domain:", "");
    return selectedRoute.domains.find((domain) => domain.id === domainId) ?? null;
  }, [activeNodeId, selectedRoute]);

  const relatedLearning = activeSkill
    ? getSkillRelatedLearning(activeSkill, selectedRoute?.linkedLearning ?? [])
    : [];
  const nextMove = selectedRoute?.nextActions[0] ?? null;
  const nextMoveLearning = nextMove
    ? getSkillRelatedLearning(nextMove, selectedRoute?.linkedLearning ?? [])
    : [];
  const nextMoveCourse = nextMoveLearning[0];
  const nextMoveChapter = nextMoveCourse?.relatedChapters[0];

  if (!selectedRoute) {
    return (
      <section className="ui-surface-card rounded-[32px] p-8">
        <p className="text-[var(--color-text-secondary)]">黄金之路暂时还没有可展示的数据。</p>
      </section>
    );
  }

  return (
    <div className="space-y-6 md:space-y-7">
      <section className="overflow-hidden rounded-[34px] border border-[#2a2419] bg-[radial-gradient(circle_at_top_left,rgba(231,199,114,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_18%),linear-gradient(180deg,#0f0d0a_0%,#14110d_52%,#17130f_100%)] p-5 text-white shadow-[0_36px_90px_-46px_rgba(15,23,42,0.56)] md:p-7">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-white/55">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e1bc63]" />
                黄金之路
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
                系统推断的职业命途
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
                这四条路线来自你当前课程、章节映射与学习进度的综合投影。系统主线会自动更新，你也可以切换查看其他候选命途。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">系统主线</div>
                <div className="mt-2 text-lg font-semibold text-white">{snapshot.routes.find((route) => route.id === snapshot.mainRouteId)?.name ?? selectedRoute.name}</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">当前查看</div>
                <div className="mt-2 text-lg font-semibold text-white">{selectedRoute.name}</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">主线进度</div>
                <div className="mt-2 text-lg font-semibold text-white">{selectedRoute.progress}%</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-4">
            {snapshot.routes.map((route) => (
              <RouteSignal
                key={route.id}
                route={route}
                isSystemMain={route.id === snapshot.mainRouteId}
                isViewing={route.id === selectedRoute.id}
                onSelect={() => {
                  setViewingRouteId(route.id);
                  startTransition(() => {
                    router.replace(`/golden-path?path=${route.id}`, { scroll: false });
                  });
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.86fr]">
        <div className="overflow-hidden rounded-[34px] border border-[#2a2419] bg-[linear-gradient(180deg,#110f0d_0%,#15120f_100%)] shadow-[0_28px_70px_-42px_rgba(15,23,42,0.54)]">
          <div className="border-b border-white/8 px-5 py-4 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
                  <Waypoints className="h-4 w-4" />
                  Destiny Tree
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                  {selectedRoute.name}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
                  {selectedRoute.tagline}
                </p>
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white/62">
                匹配度 {selectedRoute.fitScore}% · {selectedRoute.domains.length} 个能力域
              </div>
            </div>
          </div>

          <div className="relative h-[760px] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(231,199,114,0.08),transparent_30%)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(231,199,114,0.12),transparent_18%),radial-gradient(circle_at_82%_22%,rgba(255,255,255,0.05),transparent_12%),radial-gradient(circle_at_70%_74%,rgba(231,199,114,0.08),transparent_18%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(0,0,0,0.22),transparent)]" />
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.45}
              maxZoom={1.2}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              panOnDrag
              zoomOnScroll
              proOptions={{ hideAttribution: true }}
              onNodeClick={(_, node) => setActiveNodeId(node.id)}
              className="bg-transparent"
            >
              <Background color="rgba(255,255,255,0.06)" gap={28} size={1.1} />
              <Panel position="top-right">
                <div className="rounded-[18px] border border-white/10 bg-black/28 px-3 py-2 text-[11px] text-white/58 backdrop-blur-sm">
                  <div className="flex items-center gap-2 uppercase tracking-[0.16em]">
                    <span className="h-2 w-2 rounded-full bg-[#e1bc63]" />
                    命途图例
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#e0bc63]/30 bg-[#231a0c] px-2 py-0.5 text-[#f7dfaa]">
                      已掌握
                    </span>
                    <span className="rounded-full border border-[#b88942]/30 bg-[#1f1911] px-2 py-0.5 text-[#edd4a6]">
                      学习中
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-white/65">
                      可开始 / 待解锁
                    </span>
                  </div>
                </div>
              </Panel>
              <Panel position="bottom-left">
                <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45 backdrop-blur-sm">
                  当前推荐节点：{nextMove?.name ?? "暂无"}
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </div>

        <div className="space-y-6">
          <motion.section
            key={activeNodeId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[30px] border border-black/6 bg-white shadow-[0_24px_56px_-40px_rgba(15,23,42,0.18)]"
          >
            <div className="border-b border-black/6 bg-[linear-gradient(180deg,#fbf7ee_0%,#f8f4e8_100%)] px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#8b6a24]">
                <Compass className="h-4 w-4" />
                Node Inspector
              </div>
              {activeSkill ? (
                <>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                    {activeSkill.name}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                    {activeSkill.description}
                  </p>
                </>
              ) : activeDomain ? (
                <>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                    {activeDomain.name}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                    {activeDomain.description}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                    {selectedRoute.name}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                    {selectedRoute.description}
                  </p>
                </>
              )}
            </div>

            <div className="space-y-5 px-5 py-5">
              {activeSkill ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#f6f4ee] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        当前状态
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                        {getStateLabel(activeSkill.state)}
                      </div>
                      <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        进度 {activeSkill.progressScore}% · 掌握 {activeSkill.masteryScore}%
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#f6f7f9] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        证据沉淀
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                        {activeSkill.evidence.courseCount} 门课 · {activeSkill.evidence.chapterCount} 章
                      </div>
                      <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        完成信号 {activeSkill.evidence.masterySignals} 次
                      </div>
                    </div>
                  </div>

                  {(activeSkill.prerequisites?.length ?? 0) > 0 ? (
                    <div>
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        <Lock className="h-4 w-4" />
                        前置关系
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeSkill.prerequisites?.map((prerequisiteId) => {
                          const prerequisite = selectedRoute.domains
                            .flatMap((domain) => domain.nodes)
                            .find((skill) => skill.id === prerequisiteId);

                          if (!prerequisite) {
                            return null;
                          }

                          return (
                            <button
                              key={prerequisite.id}
                              type="button"
                              onClick={() => setActiveNodeId(`skill:${prerequisite.id}`)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                prerequisite.state === "mastered"
                                  ? "border-[#d5b56a]/45 bg-[#f7f1df] text-[#7d6221]"
                                  : "border-black/8 bg-[#f6f7f9] text-[var(--color-text-secondary)] hover:bg-[#f1f3f6]",
                              )}
                            >
                              {prerequisite.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      <Target className="h-4 w-4" />
                      相关学习入口
                    </div>
                    <div className="mt-3 space-y-3">
                      {relatedLearning.length > 0 ? (
                        relatedLearning.map((course) => (
                          <div key={`${activeSkill.id}:${course.courseId}`} className="rounded-[22px] border border-black/6 bg-[#fafaf9] p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <Link
                                  href={`/learn/${course.courseId}`}
                                  className="text-sm font-semibold text-[var(--color-text)] transition-colors hover:text-[#8b6a24]"
                                >
                                  {course.title}
                                </Link>
                                <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                                  进度 {course.progressPercent}% · {formatDate(course.updatedAt)}
                                </div>
                              </div>
                              <Link
                                href={`/learn/${course.courseId}`}
                                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[0.72rem] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[#fcfbf8] hover:text-[var(--color-text)]"
                              >
                                进入课程
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </div>

                            {course.relatedChapters.length > 0 ? (
                              <div className="mt-3 space-y-2 border-t border-black/6 pt-3">
                                {course.relatedChapters.map((chapter) => (
                                  <Link
                                    key={chapter.key}
                                    href={`/learn/${course.courseId}?chapter=${chapter.chapterIndex}`}
                                    className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 transition-colors hover:bg-[#fffdf9]"
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium text-[var(--color-text)]">
                                        第 {chapter.chapterIndex} 章 · {chapter.title}
                                      </div>
                                      <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                        {chapter.matchedSkills.join(" · ")}
                                      </div>
                                    </div>
                                    <span className="rounded-full border border-black/8 bg-[#faf8f2] px-2.5 py-1 text-[0.72rem] text-[var(--color-text-secondary)]">
                                      {formatChapterProgress(chapter.completedSections, chapter.totalSections)}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[22px] border border-dashed border-black/10 p-4 text-sm text-[var(--color-text-secondary)]">
                          当前还没有足够强的课程证据与这个节点绑定，继续学习后这里会更准确。
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : activeDomain ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#f6f4ee] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        能力域进度
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                        {activeDomain.progress}%
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[#f6f7f9] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        节点分布
                      </div>
                      <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        已掌握 {activeDomain.masteredCount} · 推进中 {activeDomain.inProgressCount} · 可开始 {activeDomain.readyCount}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...activeDomain.nodes].sort(sortSkills).map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => setActiveNodeId(`skill:${skill.id}`)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition-colors",
                          skill.state === "mastered"
                            ? "border-[#d5b56a]/45 bg-[#f7f1df] text-[#7d6221]"
                            : skill.state === "in_progress"
                              ? "border-[#d9c49d]/45 bg-[#f5efe2] text-[#7d6124]"
                              : "border-black/8 bg-[#f6f7f9] text-[var(--color-text-secondary)] hover:bg-[#f1f3f6]",
                        )}
                      >
                        {skill.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#f6f4ee] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        路线进度
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                        {selectedRoute.progress}%
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[#f6f7f9] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        路线匹配度
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                        {selectedRoute.fitScore}%
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoute.outcomes.map((outcome) => (
                      <span
                        key={outcome}
                        className="rounded-full border border-black/8 bg-[#f6f7f9] px-3 py-1.5 text-sm text-[var(--color-text-secondary)]"
                      >
                        {outcome}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.section>

          <section className="overflow-hidden rounded-[30px] border border-[#20180e] bg-[linear-gradient(180deg,#15110d_0%,#17120e_100%)] text-white shadow-[0_26px_64px_-42px_rgba(15,23,42,0.46)]">
            <div className="border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
                <Sparkles className="h-4 w-4" />
                Next Move
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                {nextMove?.name ?? "继续沉淀主线"}
              </h3>
              <p className="mt-2 text-sm leading-7 text-white/62">
                {nextMove?.description ?? "继续推进课程与章节后，系统会自动更新最值得点亮的节点。"}
              </p>
            </div>

            <div className="space-y-4 px-5 py-5">
              {nextMove ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white/72">
                      {getStateLabel(nextMove.state)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-white/72">
                      当前进度 {nextMove.progressScore}%
                    </span>
                  </div>

                  {nextMoveCourse ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                        最相关学习入口
                      </div>
                      <div className="mt-2 text-base font-semibold text-white">
                        {nextMoveCourse.title}
                      </div>
                      <div className="mt-1 text-sm text-white/60">
                        进度 {nextMoveCourse.progressPercent}% · 最近更新 {formatDate(nextMoveCourse.updatedAt)}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/learn/${nextMoveCourse.courseId}`}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#16120d] transition-transform hover:-translate-y-0.5"
                        >
                          进入课程
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        {nextMoveChapter ? (
                          <Link
                            href={`/learn/${nextMoveCourse.courseId}?chapter=${nextMoveChapter.chapterIndex}`}
                            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.08]"
                          >
                            第 {nextMoveChapter.chapterIndex} 章 · {nextMoveChapter.title}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-white/10 p-4 text-sm text-white/58">
                      当前还没有足够明确的课程证据和这个推荐节点绑定，继续推进学习后系统会自动收敛。
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/10 p-4 text-sm text-white/58">
                  当前数据还不足以给出明确的下一步动作。
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
