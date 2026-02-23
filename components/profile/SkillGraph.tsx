"use client";

/**
 * SkillGraph - 技能图可视化组件
 *
 * 使用 @xyflow/react 展示用户的技能及其关系
 */

import { useEffect, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import * as LucideIcons from "lucide-react";
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

function MasteryNode({ data, selected }: MasteryNodeProps) {
  const IconComponent = useMemo(() => {
    if (data.icon && data.icon in LucideIcons) {
      return LucideIcons[data.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>;
    }
    return LucideIcons.Lightbulb;
  }, [data.icon]);

  const getColors = () => {
    switch (data.category) {
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
  };

  const colors = getColors();

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-xl border-2 shadow-sm transition-all min-w-[140px]",
        selected && "ring-2 ring-offset-2 ring-[var(--color-accent)]",
      )}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <IconComponent className="w-4 h-4 flex-shrink-0" style={{ color: colors.text }} />
        <span className="font-semibold text-sm truncate">{data.name}</span>
      </div>
      <div className="flex items-center justify-between text-xs opacity-75">
        <span>
          Lv.{data.level}
        </span>
        {data.description && (
          <span className="truncate max-w-[80px]" title={data.description}>
            {data.description}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
        <div
          className="h-full opacity-70 transition-all"
          style={{
            width: `${(data.level / 5) * 100}%`,
            backgroundColor: colors.text,
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
  const IconComponent = useMemo(() => {
    if (data.icon && data.icon in LucideIcons) {
      return LucideIcons[data.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>;
    }
    return LucideIcons.Lightbulb;
  }, [data.icon]);

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border border-dashed shadow-sm transition-all min-w-[120px] bg-white/70 border-zinc-300",
        selected && "ring-2 ring-offset-2 ring-[var(--color-accent)]",
      )}
    >
      <div className="flex items-center gap-2">
        <IconComponent className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
        <span className="font-medium text-xs text-zinc-600 truncate">{data.name}</span>
      </div>
      <div className="text-[10px] text-zinc-400 mt-0.5">推荐学习</div>
    </div>
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

export function SkillGraph({ userId, className, onDiscover }: SkillGraphProps) {
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

  const fetchGraphData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/skills/graph?includeUnlocked=true&maxDepth=2");
      if (!response.ok) {
        throw new Error("Failed to fetch skill graph");
      }
      const data: SkillGraphResponse = await response.json();
      setGraphData(data);
      setNodes(data.nodes);
      setEdges(data.edges);
    } catch (err) {
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

  useEffect(() => {
    fetchGraphData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    if (!graphData) return null;
    const masteryNodes = graphData.nodes.filter((n) => n.type === "masteryNode");
    const suggestedNodes = graphData.nodes.filter((n) => n.type === "suggestedNode");
    const avgLevel = masteryNodes.length > 0
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
      <div className={cn("bg-white rounded-xl shadow-[var(--shadow-card)] p-6", className)}>
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
      <div className={cn("bg-white rounded-xl shadow-[var(--shadow-card)] p-6", className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-800">技能图谱</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[300px] text-zinc-400">
          <LucideIcons.Network className="w-12 h-12 mb-3 opacity-50" />
          <p className="mb-4">
            {error || "还没有技能数据"}
          </p>
          <button
            onClick={handleDiscover}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors flex items-center gap-2"
          >
            <LucideIcons.Wand2 className="w-4 h-4" />
            发现我的技能
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white rounded-xl shadow-[var(--shadow-card)] overflow-hidden", className)}>
      <div className="px-6 py-4 border-b border-zinc-100">
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
            onClick={handleDiscover}
            className="px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <LucideIcons.RefreshCw className="w-3.5 h-3.5" />
            重新发现
          </button>
        </div>
      </div>

      <div className="h-[350px] bg-gradient-to-br from-zinc-50 to-white">
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
          <Controls
            className="!bg-white !border-zinc-200 [&>button]:!bg-zinc-50 [&>button]:!border-zinc-200 [&>button]:hover:!bg-zinc-100 [&>button]:text-zinc-600"
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === "suggestedNode") return "var(--skill-default-bg)";
              const data = node.data;
              switch (data.category as string) {
                case "frontend": return "var(--skill-frontend-bg)";
                case "backend": return "var(--skill-backend-bg)";
                case "ml": return "var(--skill-ml-bg)";
                case "design": return "var(--skill-design-bg)";
                case "softskill": return "var(--skill-softskill-bg)";
                default: return "var(--skill-default-bg)";
              }
            }}
            className="!bg-white !border-zinc-200"
          />
        </ReactFlow>
      </div>

      <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50/50">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-600">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "var(--skill-frontend-bg)", borderColor: "var(--skill-frontend-border)", borderWidth: "1px", borderStyle: "solid" }} />
            <span>前端</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "var(--skill-backend-bg)", borderColor: "var(--skill-backend-border)", borderWidth: "1px", borderStyle: "solid" }} />
            <span>后端</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "var(--skill-ml-bg)", borderColor: "var(--skill-ml-border)", borderWidth: "1px", borderStyle: "solid" }} />
            <span>机器学习</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "var(--skill-design-bg)", borderColor: "var(--skill-design-border)", borderWidth: "1px", borderStyle: "solid" }} />
            <span>设计</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "var(--skill-softskill-bg)", borderColor: "var(--skill-softskill-border)", borderWidth: "1px", borderStyle: "solid" }} />
            <span>软技能</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-zinc-400">
            <div className="w-8 h-0.5 bg-zinc-300" />
            <span>虚线为推荐技能</span>
          </div>
        </div>
      </div>
    </div>
  );
}
