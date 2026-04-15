import type { VisibleTreeMetrics } from "@/lib/growth/projection-types";
import type {
  CandidateCareerTree,
  CareerTreeSnapshot,
  VisibleSkillTreeNode,
} from "@/lib/growth/types";

export interface FocusNodeReference {
  id?: string | null;
  anchorRef?: string | null;
}

export function flattenVisibleNodes(nodes: VisibleSkillTreeNode[]): VisibleSkillTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenVisibleNodes(node.children)]);
}

export function getTreeByDirectionKey(
  snapshot: CareerTreeSnapshot,
  directionKey: string | null | undefined,
): CandidateCareerTree | null {
  if (!directionKey) {
    return null;
  }

  return snapshot.trees.find((tree) => tree.directionKey === directionKey) ?? null;
}

export function getCurrentGrowthTree(snapshot: CareerTreeSnapshot): CandidateCareerTree | null {
  return (
    getTreeByDirectionKey(snapshot, snapshot.selectedDirectionKey) ??
    getTreeByDirectionKey(snapshot, snapshot.recommendedDirectionKey) ??
    snapshot.trees[0] ??
    null
  );
}

export function countVisibleTreeMetrics(nodes: VisibleSkillTreeNode[]): VisibleTreeMetrics {
  const flattened = flattenVisibleNodes(nodes);
  if (flattened.length === 0) {
    return {
      total: 0,
      mastered: 0,
      inProgress: 0,
      ready: 0,
      locked: 0,
      averageProgress: 0,
    };
  }

  let mastered = 0;
  let inProgress = 0;
  let ready = 0;
  let locked = 0;
  let progressSum = 0;

  for (const node of flattened) {
    progressSum += node.progress;
    switch (node.state) {
      case "mastered":
        mastered += 1;
        break;
      case "in_progress":
        inProgress += 1;
        break;
      case "ready":
        ready += 1;
        break;
      case "locked":
        locked += 1;
        break;
    }
  }

  return {
    total: flattened.length,
    mastered,
    inProgress,
    ready,
    locked,
    averageProgress: Math.round(progressSum / flattened.length),
  };
}

export function findNodeById(
  nodes: VisibleSkillTreeNode[],
  nodeId: string | null | undefined,
): VisibleSkillTreeNode | null {
  if (!nodeId) {
    return null;
  }

  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    const child = findNodeById(node.children, nodeId);
    if (child) {
      return child;
    }
  }

  return null;
}

export function findNodeByAnchorRef(
  nodes: VisibleSkillTreeNode[],
  anchorRef: string | null | undefined,
): VisibleSkillTreeNode | null {
  if (!anchorRef) {
    return null;
  }

  for (const node of nodes) {
    if (node.anchorRef === anchorRef) {
      return node;
    }

    const child = findNodeByAnchorRef(node.children, anchorRef);
    if (child) {
      return child;
    }
  }

  return null;
}

export function resolveProjectedFocusNode(
  nodes: VisibleSkillTreeNode[],
  reference: FocusNodeReference | null | undefined,
): VisibleSkillTreeNode | null {
  if (!reference) {
    return null;
  }

  return (
    findNodeById(nodes, reference.id ?? null) ??
    findNodeByAnchorRef(nodes, reference.anchorRef ?? null)
  );
}

export function findDefaultFocusNode(nodes: VisibleSkillTreeNode[]): VisibleSkillTreeNode | null {
  const flattened = flattenVisibleNodes(nodes);
  return (
    flattened.find((node) => node.state === "in_progress") ??
    flattened.find((node) => node.state === "ready") ??
    flattened[0] ??
    null
  );
}
