/**
 * Mind Map UI Component with ReactFlow
 *
 * 使用 @xyflow/react 渲染交互式思维导图
 * 支持拖拽、缩放、自动布局
 */
"use client";

import {
  Background,
  ConnectionLineType,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { Maximize2, Minimize2, Network } from "lucide-react";

// ============================================
// Types
// ============================================

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
  color?: string;
}

interface MindMapViewProps {
  topic: string;
  nodes: MindMapNode[];
  layout?: "radial" | "tree" | "mindmap";
}

// ============================================
// Layout Utilities
// ============================================

const NODE_COLORS = [
  { bg: "bg-violet-100", border: "border-violet-400", text: "text-violet-800" },
  { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-800" },
  { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-800" },
  { bg: "bg-amber-100", border: "border-amber-400", text: "text-amber-800" },
  { bg: "bg-rose-100", border: "border-rose-400", text: "text-rose-800" },
];

const EDGE_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#f43f5e"];

function convertToFlowNodes(
  data: MindMapNode[],
  layout: "radial" | "tree" | "mindmap",
  parentId: string | null = null,
  depth: number = 0,
  index: number = 0,
  _totalSiblings: number = 1,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const HORIZONTAL_SPACING = 280;
  const VERTICAL_SPACING = 100;
  const RADIAL_RADIUS = 200;

  data.forEach((item, idx) => {
    let x: number, y: number;
    const totalItems = data.length;
    const colorIndex = depth % NODE_COLORS.length;

    if (layout === "radial" && parentId === null) {
      // 中心节点
      x = 400;
      y = 300;
    } else if (layout === "radial") {
      // 径向布局
      const angle = (2 * Math.PI * idx) / totalItems - Math.PI / 2;
      const radius = RADIAL_RADIUS * depth;
      x = 400 + radius * Math.cos(angle);
      y = 300 + radius * Math.sin(angle);
    } else if (layout === "tree") {
      // 树状布局
      x = depth * HORIZONTAL_SPACING + 50;
      y = index * VERTICAL_SPACING + idx * VERTICAL_SPACING * 2 + 50;
    } else {
      // mindmap 布局（水平展开）
      const side = depth % 2 === 0 ? 1 : -1;
      x = 400 + (depth === 0 ? 0 : depth * HORIZONTAL_SPACING * 0.8 * side);
      y = 300 + (idx - totalItems / 2) * VERTICAL_SPACING * 0.8;
    }

    const nodeId = item.id || `node-${depth}-${idx}`;
    const color = NODE_COLORS[colorIndex];

    nodes.push({
      id: nodeId,
      data: {
        label: item.label,
        depth,
        colorClass: color,
      },
      position: { x, y },
      type: "mindMapNode",
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    if (parentId) {
      edges.push({
        id: `edge-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: "smoothstep",
        animated: depth === 1,
        style: {
          stroke: EDGE_COLORS[colorIndex],
          strokeWidth: Math.max(3 - depth, 1),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: EDGE_COLORS[colorIndex],
        },
      });
    }

    if (item.children && item.children.length > 0) {
      const childResult = convertToFlowNodes(
        item.children,
        layout,
        nodeId,
        depth + 1,
        idx,
        data.length,
      );
      nodes.push(...childResult.nodes);
      edges.push(...childResult.edges);
    }
  });

  return { nodes, edges };
}

// ============================================
// Custom Node Component
// ============================================

function MindMapNodeComponent({
  data,
}: {
  data: { label: string; depth: number; colorClass: (typeof NODE_COLORS)[0] };
}) {
  const { label, depth, colorClass } = data;
  const isRoot = depth === 0;

  return (
    <div
      className={`
        px-4 py-2 rounded-xl border-2 shadow-sm
        ${colorClass.bg} ${colorClass.border} ${colorClass.text}
        ${isRoot ? "font-bold text-sm min-w-[120px]" : "text-xs"}
        text-center whitespace-nowrap
        hover:shadow-md transition-shadow
      `}
    >
      {label}
    </div>
  );
}

const nodeTypes = {
  mindMapNode: MindMapNodeComponent,
};

// ============================================
// Main Component
// ============================================

export function MindMapView({ topic, nodes: inputNodes, layout = "mindmap" }: MindMapViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 转换数据为 ReactFlow 格式
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    // 创建根节点
    const rootNode: MindMapNode = {
      id: "root",
      label: topic,
      children: inputNodes,
    };
    return convertToFlowNodes([rootNode], layout);
  }, [topic, inputNodes, layout]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 更新节点当输入变化
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
      className="my-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
            <Network className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{topic}</h3>
            <p className="text-[10px] text-muted-foreground">
              {inputNodes.length} 个主要分支 · 双击节点聚焦
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title={isExpanded ? "收起" : "展开"}
        >
          {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Mind Map Canvas */}
      <motion.div
        animate={{ height: isExpanded ? 500 : 300 }}
        className="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls position="bottom-right" showInteractive={false} />
          {isExpanded && <MiniMap nodeColor="#8b5cf6" />}
        </ReactFlow>
      </motion.div>

      {/* Tips */}
      <p className="text-[10px] text-center text-muted-foreground mt-2">
        💡 拖拽节点 · 滚轮缩放 · 点击展开按钮查看全图
      </p>
    </motion.div>
  );
}
