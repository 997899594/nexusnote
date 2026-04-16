import type { ComposeGraph, ComposerVisibleNode } from "@/lib/growth/compose-shared";

function compareNodeIds(
  leftId: string,
  rightId: string,
  nodeMap: Map<string, ComposeGraph["nodes"][number]>,
): number {
  const left = nodeMap.get(leftId);
  const right = nodeMap.get(rightId);

  if (!left || !right) {
    return leftId.localeCompare(rightId, "en");
  }

  if (right.progress !== left.progress) {
    return right.progress - left.progress;
  }

  if (right.evidenceScore !== left.evidenceScore) {
    return right.evidenceScore - left.evidenceScore;
  }

  if (right.courseCount !== left.courseCount) {
    return right.courseCount - left.courseCount;
  }

  return left.canonicalLabel.localeCompare(right.canonicalLabel, "zh-Hans-CN");
}

function buildDefaultNodeSummary(node: ComposeGraph["nodes"][number]): string {
  return node.summary?.trim() || `${node.canonicalLabel} 是这条方向上的关键能力节点。`;
}

function createsCycle(
  selectedParents: Map<string, string>,
  parentId: string,
  childId: string,
): boolean {
  let current: string | undefined = parentId;

  while (current) {
    if (current === childId) {
      return true;
    }
    current = selectedParents.get(current);
  }

  return false;
}

export function buildDeterministicGrowthTree(params: {
  graph: ComposeGraph;
  supportingNodeRefs: string[];
}): ComposerVisibleNode[] {
  const nodeMap = new Map(params.graph.nodes.map((node) => [node.id, node]));
  const supportSet = new Set(params.supportingNodeRefs.filter((nodeId) => nodeMap.has(nodeId)));

  if (supportSet.size === 0) {
    throw new Error("Cannot build deterministic growth tree without supporting nodes.");
  }

  const selectedParents = new Map<string, string>();
  const incomingEdgesByTarget = new Map<string, ComposeGraph["prerequisiteEdges"]>();

  for (const edge of params.graph.prerequisiteEdges) {
    if (!supportSet.has(edge.from) || !supportSet.has(edge.to) || edge.from === edge.to) {
      continue;
    }

    const existing = incomingEdgesByTarget.get(edge.to) ?? [];
    existing.push(edge);
    incomingEdgesByTarget.set(edge.to, existing);
  }

  const sortedNodeIds = [...supportSet].sort((left, right) => compareNodeIds(left, right, nodeMap));

  for (const nodeId of sortedNodeIds) {
    const candidateEdges = [...(incomingEdgesByTarget.get(nodeId) ?? [])].sort((left, right) => {
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }
      return compareNodeIds(left.from, right.from, nodeMap);
    });

    for (const edge of candidateEdges) {
      if (createsCycle(selectedParents, edge.from, nodeId)) {
        continue;
      }

      selectedParents.set(nodeId, edge.from);
      break;
    }
  }

  const childrenByParent = new Map<string, string[]>();
  for (const [childId, parentId] of selectedParents.entries()) {
    const existing = childrenByParent.get(parentId) ?? [];
    existing.push(childId);
    childrenByParent.set(parentId, existing);
  }

  const roots = sortedNodeIds.filter((nodeId) => !selectedParents.has(nodeId));

  const buildNode = (nodeId: string): ComposerVisibleNode => {
    const node = nodeMap.get(nodeId);
    if (!node) {
      throw new Error(`Missing supporting node ${nodeId} while building growth tree.`);
    }

    const childIds = [...(childrenByParent.get(nodeId) ?? [])].sort((left, right) =>
      compareNodeIds(left, right, nodeMap),
    );

    return {
      anchorRef: node.id,
      title: node.canonicalLabel,
      summary: buildDefaultNodeSummary(node),
      children: childIds.map(buildNode),
    };
  };

  return roots.map(buildNode);
}
