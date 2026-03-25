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
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          boxShadow: "0 12px 28px -24px rgba(15,23,42,0.16)",
          padding: "8px 12px",
          fontSize: "12px",
        }
      : {
          background: "#111827",
          color: "#ffffff",
          border: "none",
          borderRadius: "12px",
          boxShadow: "0 18px 36px -28px rgba(15,23,42,0.32)",
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
      style: { stroke: "var(--color-border)", strokeWidth: 1.5 },
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
      <div className="mt-2 rounded-2xl bg-[#f6f7f9] p-3">
        <p className="text-sm text-zinc-600">{output.error || "思维导图生成失败"}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-2xl bg-white shadow-[0_20px_46px_-34px_rgba(15,23,42,0.18)]">
      <div className="flex items-center gap-2 bg-[#f6f7f9] px-3 py-2">
        <MapIcon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
          {mindMapData?.topic}
        </span>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">
          {mindMapData?.layout}
        </span>
      </div>

      <div className="h-[300px] bg-white">
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
