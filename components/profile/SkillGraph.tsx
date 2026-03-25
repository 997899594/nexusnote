"use client";

/**
 * SkillGraph - 技能图可视化组件
 *
 * 使用 @xyflow/react 展示用户的技能及其关系
 */

import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  type Edge,
  type EdgeChange,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
} from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import * as LucideIcons from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

export interface SkillNodeData {
  id: string;
  name: string;
  slug: string;
  category: string;
  domain: string;
  description: string | null;
  icon: string | null;
  isSystem: boolean;
  level: number;
  confidence: number;
  unlockedAt: Date | null;
}

export interface SkillEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  strength: number;
  confidence: number;
}

interface SkillGraphResponse {
  nodes: Array<Node<{ [key: string]: unknown }>>;
  edges: Array<Edge<{ [key: string]: unknown }>>;
}

// ============================================
// Custom Node Components
// ============================================

interface MasteryNodeProps {
  data: SkillNodeData;
  selected?: boolean;
}

/** Level-based style: border width, opacity, glow, and label color */
function getLevelStyle(level: number, borderColor: string) {
  const clamped = Math.max(1, Math.min(5, level));
  const styles: Record<
    number,
    { borderWidth: number; borderOpacity: number; glow: string; labelColor: string }
  > = {
    1: { borderWidth: 2, borderOpacity: 0.6, glow: "none", labelColor: "var(--skill-level-1)" },
    2: { borderWidth: 2, borderOpacity: 0.8, glow: "none", labelColor: "var(--skill-level-2)" },
    3: {
      borderWidth: 3,
      borderOpacity: 1,
      glow: `0 0 8px color-mix(in oklch, ${borderColor} 30%, transparent)`,
      labelColor: "var(--skill-level-3)",
    },
    4: {
      borderWidth: 3,
      borderOpacity: 1,
      glow: `0 0 14px color-mix(in oklch, ${borderColor} 40%, transparent)`,
      labelColor: "var(--skill-level-4)",
    },
    5: {
      borderWidth: 4,
      borderOpacity: 1,
      glow: "none", // Handled by CSS animation class
      labelColor: "var(--skill-level-5)",
    },
  };
  return styles[clamped];
}

function getCategoryColors(category: string) {
  switch (category) {
    case "frontend":
      return {
        bg: "var(--skill-frontend-bg)",
        border: "var(--skill-frontend-border)",
        text: "var(--skill-frontend-text)",
      };
    case "backend":
      return {
        bg: "var(--skill-backend-bg)",
        border: "var(--skill-backend-border)",
        text: "var(--skill-backend-text)",
      };
    case "ml":
      return {
        bg: "var(--skill-ml-bg)",
        border: "var(--skill-ml-border)",
        text: "var(--skill-ml-text)",
      };
    case "design":
      return {
        bg: "var(--skill-design-bg)",
        border: "var(--skill-design-border)",
        text: "var(--skill-design-text)",
      };
    case "softskill":
      return {
        bg: "var(--skill-softskill-bg)",
        border: "var(--skill-softskill-border)",
        text: "var(--skill-softskill-text)",
      };
    default:
      return {
        bg: "var(--skill-default-bg)",
        border: "var(--skill-default-border)",
        text: "var(--skill-default-text)",
      };
  }
}

function MasteryNode({ data, selected }: MasteryNodeProps) {
  const IconComponent = useMemo(() => {
    if (data.icon && data.icon in LucideIcons) {
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: dynamic icon lookup by name
      return LucideIcons[data.icon as keyof typeof LucideIcons] as React.ComponentType<{
        className?: string;
      }>;
    }
    return LucideIcons.Lightbulb;
  }, [data.icon]);

  const colors = getCategoryColors(data.category);
  const levelStyle = getLevelStyle(data.level, colors.border);

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-xl shadow-sm transition-all min-w-[140px]",
        selected && "ring-2 ring-offset-2 ring-[#111827]/20",
        data.level >= 5 && "skill-pulse-glow",
      )}
      style={{
        backgroundColor: colors.bg,
        borderStyle: "solid",
        borderWidth: `${levelStyle.borderWidth}px`,
        borderColor: colors.border,
        opacity: levelStyle.borderOpacity,
        color: colors.text,
        boxShadow: levelStyle.glow !== "none" ? levelStyle.glow : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <IconComponent className="w-4 h-4 flex-shrink-0" style={{ color: colors.text }} />
        <span className="font-semibold text-sm truncate">{data.name}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold" style={{ color: levelStyle.labelColor }}>
          Lv.{data.level}
        </span>
        {data.description && (
          <span className="truncate max-w-[80px] opacity-75" title={data.description}>
            {data.description}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
        <div
          className="h-full transition-all"
          style={{
            width: `${(data.level / 5) * 100}%`,
            backgroundColor: colors.text,
            opacity: 0.5 + data.level * 0.1,
          }}
        />
      </div>
    </div>
  );
}

interface SuggestedNodeProps {
  data: SkillNodeData;
  selected?: boolean;
}

function SuggestedNode({ data, selected }: SuggestedNodeProps) {
  const router = useRouter();
  const IconComponent = useMemo(() => {
    if (data.icon && data.icon in LucideIcons) {
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: dynamic icon lookup by name
      return LucideIcons[data.icon as keyof typeof LucideIcons] as React.ComponentType<{
        className?: string;
      }>;
    }
    return LucideIcons.Lightbulb;
  }, [data.icon]);

  return (
    <button
      type="button"
      onClick={() => router.push(`/?topic=${encodeURIComponent(data.name)}`)}
      className={cn(
        "min-w-[120px] rounded-2xl border border-dashed border-zinc-300 bg-white/80 px-3 py-2.5 text-left shadow-[0_12px_28px_-24px_rgba(15,23,42,0.14)] transition-all",
        "hover:border-zinc-400 hover:bg-white hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)]",
        "cursor-pointer",
        selected && "ring-2 ring-offset-2 ring-[#111827]/20",
      )}
    >
      <div className="flex items-center gap-2">
        <IconComponent className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
        <span className="font-medium text-xs text-zinc-600 truncate">{data.name}</span>
      </div>
      <div className="mt-0.5 text-[10px] font-medium text-zinc-500">
        {data.description ? `下一步: ${data.description}` : "推荐学习"}
      </div>
    </button>
  );
}

const nodeTypes: NodeTypes = {
  masteryNode: MasteryNode,
  suggestedNode: SuggestedNode,
};

// ============================================
// Main Component
// ============================================

interface SkillGraphProps {
  userId?: string;
  className?: string;
  onDiscover?: () => void;
}

export function SkillGraph({ userId: _userId, className, onDiscover }: SkillGraphProps) {
  const [graphData, setGraphData] = useState<SkillGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const onNodesChange: OnNodesChange = (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  const onEdgesChange: OnEdgesChange = (changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  };

  const fetchGraphData = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/skills/graph?includeUnlocked=true&maxDepth=2", { signal });
      if (!response.ok) {
        throw new Error("Failed to fetch skill graph");
      }
      const data: SkillGraphResponse = await response.json();
      setGraphData(data);
      setNodes(data.nodes);
      setEdges(data.edges);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[SkillGraph] Failed to fetch graph data:", err);
      setError("加载技能图失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async () => {
    try {
      const response = await fetch("/api/skills/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      if (!response.ok) {
        throw new Error("Failed to discover skills");
      }
      await fetchGraphData();
      onDiscover?.();
    } catch (err) {
      console.error("[SkillGraph] Failed to discover skills:", err);
      setError("发现技能失败");
    }
  };

  const hasFetched = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchGraphData is intentionally not wrapped in useCallback; we only want to fetch on mount
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const controller = new AbortController();
    fetchGraphData(controller.signal);
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    if (!graphData) return null;
    const masteryNodes = graphData.nodes.filter((n) => n.type === "masteryNode");
    const suggestedNodes = graphData.nodes.filter((n) => n.type === "suggestedNode");
    const avgLevel =
      masteryNodes.length > 0
        ? masteryNodes.reduce((sum, n) => {
            const level = (n.data.level as number) || 0;
            return sum + level;
          }, 0) / masteryNodes.length
        : 0;
    return {
      totalSkills: graphData.nodes.length,
      masteredSkills: masteryNodes.length,
      suggestedSkills: suggestedNodes.length,
      avgLevel: Math.round(avgLevel * 10) / 10,
    };
  }, [graphData]);

  if (loading) {
    return (
      <div className={cn("ui-surface-card rounded-2xl p-6", className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-800">技能图谱</h3>
        </div>
        <div className="flex items-center justify-center h-[300px] text-zinc-400">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-500 rounded-full animate-spin mx-auto mb-3" />
            <p>加载技能图中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !graphData || graphData.nodes.length === 0) {
    return (
      <div className={cn("ui-surface-card rounded-2xl p-6", className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-800">技能图谱</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[300px] text-zinc-400">
          <LucideIcons.Network className="w-12 h-12 mb-3 opacity-50" />
          <p className="mb-4">{error || "还没有技能数据"}</p>
          <button
            type="button"
            onClick={handleDiscover}
            className="ui-primary-button flex items-center gap-2 rounded-xl px-4 py-2 text-white transition-opacity hover:opacity-95"
          >
            <LucideIcons.Wand2 className="w-4 h-4" />
            发现我的技能
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("ui-surface-card overflow-hidden rounded-2xl", className)}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-800">技能图谱</h3>
            {stats && (
              <p className="text-sm text-zinc-500 mt-0.5">
                已掌握 {stats.masteredSkills} 个技能 · 平均等级 Lv.{stats.avgLevel}
                {stats.suggestedSkills > 0 && ` · 推荐 ${stats.suggestedSkills} 个技能`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleDiscover}
            className="ui-surface-soft flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-[#eceff3]"
          >
            <LucideIcons.RefreshCw className="w-3.5 h-3.5" />
            重新发现
          </button>
        </div>
      </div>

      <div className="h-[350px] bg-[linear-gradient(180deg,rgba(248,249,251,0.95),rgba(255,255,255,1))]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={1.5}
          defaultEdgeOptions={{
            animated: false,
            style: { stroke: "var(--color-neutral-300)", strokeWidth: 2 },
          }}
        >
          <Background color="var(--color-neutral-200)" gap={16} />
          <Controls className="!bg-white !border-zinc-200 [&>button]:!bg-[#f6f7f9] [&>button]:!border-zinc-200 [&>button]:hover:!bg-[#eef1f5] [&>button]:text-zinc-600" />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === "suggestedNode") return "var(--skill-default-border)";
              const data = node.data;
              // Use border color (more saturated) and level affects which color we pick
              const level = (data.level as number) || 1;
              // Higher level → use text color (darkest), lower → use bg color (lightest)
              const variant = level >= 4 ? "text" : level >= 2 ? "border" : "bg";
              const category = data.category as string;
              const key = `--skill-${["frontend", "backend", "ml", "design", "softskill"].includes(category) ? category : "default"}-${variant}`;
              return `var(${key})`;
            }}
            className="!bg-white !border-zinc-200"
          />
        </ReactFlow>
      </div>

      <div className="bg-[#f6f7f9] px-6 py-3">
        {/* Category legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-600">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{
                backgroundColor: "var(--skill-frontend-bg)",
                borderColor: "var(--skill-frontend-border)",
                borderWidth: "1px",
                borderStyle: "solid",
              }}
            />
            <span>前端</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{
                backgroundColor: "var(--skill-backend-bg)",
                borderColor: "var(--skill-backend-border)",
                borderWidth: "1px",
                borderStyle: "solid",
              }}
            />
            <span>后端</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{
                backgroundColor: "var(--skill-ml-bg)",
                borderColor: "var(--skill-ml-border)",
                borderWidth: "1px",
                borderStyle: "solid",
              }}
            />
            <span>机器学习</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{
                backgroundColor: "var(--skill-design-bg)",
                borderColor: "var(--skill-design-border)",
                borderWidth: "1px",
                borderStyle: "solid",
              }}
            />
            <span>设计</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{
                backgroundColor: "var(--skill-softskill-bg)",
                borderColor: "var(--skill-softskill-border)",
                borderWidth: "1px",
                borderStyle: "solid",
              }}
            />
            <span>软技能</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-zinc-400">
            <div className="w-8 h-[1px] border-t border-dashed border-zinc-300" />
            <span>推荐方向</span>
          </div>
        </div>
        {/* Level legend */}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-400">
          <span>等级:</span>
          {[1, 2, 3, 4, 5].map((lv) => (
            <div key={lv} className="flex items-center gap-1">
              <div
                className={cn("w-3 h-3 rounded", lv === 5 && "skill-pulse-glow")}
                style={{
                  borderStyle: "solid",
                  borderWidth: `${lv >= 3 ? (lv >= 5 ? 2 : 1.5) : 1}px`,
                  borderColor: "var(--skill-default-border)",
                  backgroundColor: "var(--skill-default-bg)",
                  boxShadow:
                    lv === 3
                      ? "0 0 4px oklch(0.7 0.1 250 / 0.3)"
                      : lv === 4
                        ? "0 0 6px oklch(0.65 0.15 250 / 0.4)"
                        : "none",
                }}
              />
              <span style={{ color: `var(--skill-level-${lv})` }}>Lv.{lv}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
