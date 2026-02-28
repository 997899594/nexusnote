/**
 * MindMapResult - 思维导图展示组件
 *
 * 使用 ReactFlow 渲染思维导图
 */

"use client";

import {
  Background,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MapIcon } from "lucide-react";
import type { MindMapNode, MindMapOutput } from "./types";

interface MindMapResultProps {
  output: MindMapOutput;
}

function convertToNodesAndEdges(
  nodeData: MindMapNode,
  parentId: string | null = null,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const currentNode: Node = {
    id: nodeData.id,
    position: parentId ? { x: 0, y: 0 } : { x: 250, y: 150 },
    data: { label: nodeData.label },
    type: parentId ? "default" : "input",
    style: parentId
      ? {
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "12px",
        }
      : {
          background: "#6366f1",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "10px 16px",
          fontSize: "14px",
          fontWeight: 600,
        },
  };

  nodes.push(currentNode);

  if (parentId) {
    edges.push({
      id: `${parentId}-${nodeData.id}`,
      source: parentId,
      target: nodeData.id,
      type: "smoothstep",
      style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
    });
  }

  if (nodeData.children && nodeData.children.length > 0) {
    const childCount = nodeData.children.length;
    const spacingY = 120;
    const startY = -(childCount - 1) * (spacingY / 2);

    nodeData.children.forEach((child, index) => {
      const childData = convertToNodesAndEdges(child, nodeData.id);
      nodes.push(...childData.nodes);
      edges.push(...childData.edges);

      const nodeIndex = nodes.findIndex((n) => n.id === child.id);
      if (nodeIndex !== -1) {
        nodes[nodeIndex].position = {
          x: currentNode.position.x + 180,
          y: currentNode.position.y + startY + index * spacingY,
        };
      }
    });
  }

  return { nodes, edges };
}

export function MindMapResult({ output }: MindMapResultProps) {
  const isValid = output.success && output.mindMap;
  const mindMapData = output.mindMap;

  const initialElements =
    isValid && mindMapData ? convertToNodesAndEdges(mindMapData.nodes) : { nodes: [], edges: [] };

  const [nodes, , onNodesChange] = useNodesState(initialElements.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initialElements.edges);

  if (!isValid) {
    return (
      <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-sm text-red-600">{output.error || "思维导图生成失败"}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <MapIcon className="w-4 h-4 text-zinc-500" />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {mindMapData?.topic}
        </span>
        <span className="text-xs text-zinc-400 ml-auto">{mindMapData?.layout}</span>
      </div>

      <div className="h-[300px] bg-white dark:bg-zinc-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}
