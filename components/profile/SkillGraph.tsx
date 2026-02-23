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

  const getColor = () => {
    switch (data.category) {
      case "frontend":
        return "bg-blue-100 border-blue-300 text-blue-700";
      case "backend":
        return "bg-emerald-100 border-emerald-300 text-emerald-700";
      case "ml":
        return "bg-purple-100 border-purple-300 text-purple-700";
      case "design":
        return "bg-pink-100 border-pink-300 text-pink-700";
      case "softskill":
        return "bg-amber-100 border-amber-300 text-amber-700";
      default:
        return "bg-zinc-100 border-zinc-300 text-zinc-700";
    }
  };

  const colorClass = getColor();

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-xl border-2 shadow-sm transition-all min-w-[140px]",
        colorClass,
        selected && "ring-2 ring-offset-2 ring-[var(--color-accent)]",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <IconComponent className="w-4 h-4 flex-shrink-0" />
        <span className="font-semibold text-sm truncate">{data.name}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="opacity-75">
          Lv.{data.level}
        </span>
        {data.description && (
          <span className="opacity-60 truncate max-w-[80px]" title={data.description}>
            {data.description}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-current opacity-70 transition-all"
          style={{ width: `${(data.level / 5) * 100}%` }}
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
              if (node.type === "suggestedNode") return "#f4f4f5";
              const data = node.data;
              switch (data.category as string) {
                case "frontend": return "#dbeafe";
                case "backend": return "#d1fae5";
                case "ml": return "#f3e8ff";
                case "design": return "#fce7f3";
                case "softskill": return "#fef3c7";
                default: return "#f4f4f5";
              }
            }}
            className="!bg-white !border-zinc-200"
          />
        </ReactFlow>
      </div>

      <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50/50">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-600">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-200 border border-blue-300" />
            <span>前端</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300" />
            <span>后端</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-purple-200 border border-purple-300" />
            <span>机器学习</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-pink-200 border border-pink-300" />
            <span>设计</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-200 border border-amber-300" />
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

// Helper functions for applying changes
function applyNodeChanges(changes: NodeChange[], nodes: Node[]): Node[] {
  const result: Node[] = [];
  for (const node of nodes) {
    const change = changes.find((c) => "id" in c && c.id === node.id);
    if (!change) {
      result.push(node);
      continue;
    }
    if (change.type === "remove") {
      continue;
    }
    if (change.type === "position" && "position" in change && change.position) {
      result.push({ ...node, position: change.position });
    } else {
      result.push(node);
    }
  }
  return result;
}

function applyEdgeChanges(changes: EdgeChange[], edges: Edge[]): Edge[] {
  const result: Edge[] = [];
  for (const edge of edges) {
    const change = changes.find((c) => "id" in c && c.id === edge.id);
    if (!change) {
      result.push(edge);
      continue;
    }
    if (change.type === "remove") {
      continue;
    }
    result.push(edge);
  }
  return result;
}
