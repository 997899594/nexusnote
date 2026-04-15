import { z } from "zod";

export const composerVisibleNodeSchema: z.ZodType<ComposerVisibleNode> = z.lazy(() =>
  z.object({
    anchorRef: z.string().trim().min(1),
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    children: z.array(composerVisibleNodeSchema),
  }),
);

export interface ComposerVisibleNode {
  anchorRef: string;
  title: string;
  summary: string;
  children: ComposerVisibleNode[];
}

export const composerTreeSchema = z.object({
  matchPreviousDirectionKey: z.string().trim().min(1).optional(),
  keySeed: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  whyThisDirection: z.string().trim().min(1),
  supportingNodeRefs: z.array(z.string().trim().min(1)).min(1),
  tree: z.array(composerVisibleNodeSchema).min(1),
});

export const treeComposerOutputSchema = z.object({
  recommendedDirectionHint: z.string().trim().min(1).nullable(),
  trees: z.array(composerTreeSchema).min(1).max(5),
});

export type TreeComposerOutput = z.infer<typeof treeComposerOutputSchema>;

export interface PreviousDirectionIdentity {
  directionKey: string;
  supportingNodeRefs: string[];
}

const composeGraphNodeSchema = z.object({
  id: z.string().trim().min(1),
  canonicalLabel: z.string().trim().min(1),
  summary: z.string().nullable(),
  progress: z.number().min(0).max(100),
  state: z.string().trim().min(1),
  courseCount: z.number().int().nonnegative(),
  chapterCount: z.number().int().nonnegative(),
  evidenceScore: z.number().min(0).max(100),
});

const composeGraphEdgeSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  confidence: z.number().min(0).max(1).default(0.5),
});

const composeGraphSchema = z.object({
  nodes: z.array(composeGraphNodeSchema),
  prerequisiteEdges: z.array(composeGraphEdgeSchema).default([]),
});

const composePreferenceSchema = z
  .object({
    selectedDirectionKey: z.string().nullable().optional(),
    preferenceVersion: z.number().int().nonnegative().optional(),
  })
  .passthrough();

const composePreviousSummarySchema = z
  .object({
    trees: z
      .array(
        z.object({
          directionKey: z.string().trim().min(1),
          supportingNodeRefs: z.array(z.string().trim().min(1)).default([]),
        }),
      )
      .default([]),
  })
  .nullable()
  .optional();

type ComposeGraphNode = z.infer<typeof composeGraphNodeSchema>;
type ComposeGraphEdge = z.infer<typeof composeGraphEdgeSchema>;
type ComposeGraph = z.infer<typeof composeGraphSchema>;
type ComposePreference = z.infer<typeof composePreferenceSchema>;
type ComposePreviousSummary = NonNullable<z.infer<typeof composePreviousSummarySchema>>;

interface CandidateBundle {
  seedId: string;
  nodeIds: string[];
  supportingNodeRefs: string[];
  matchPreviousDirectionKey?: string;
  score: number;
}

interface DirectionSemantic {
  keySeed: string;
  title: string;
  labelParts: string[];
}

const MAX_TREE_COUNT = 5;
const MAX_BUNDLE_NODES = 6;
const MAX_BFS_DEPTH = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug || "direction";
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLabelIdentity(value: string): string {
  return normalizeText(value)
    .replace(/\b(and|for|the|with|to|of|in|on)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccardOverlap(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function buildNodeScore(node: ComposeGraphNode, preferredNodeIds: Set<string>): number {
  const stateBoost =
    node.state === "mastered"
      ? 10
      : node.state === "in_progress"
        ? 12
        : node.state === "ready"
          ? 6
          : 2;
  const preferenceBoost = preferredNodeIds.has(node.id) ? 18 : 0;

  return (
    node.progress * 0.45 +
    node.evidenceScore * 0.35 +
    Math.min(10, node.courseCount * 3) +
    Math.min(8, node.chapterCount * 2) +
    stateBoost +
    preferenceBoost
  );
}

function buildPreferredNodeIds(
  preference: ComposePreference,
  previousSummary: ComposePreviousSummary,
): Set<string> {
  if (!preference.selectedDirectionKey) {
    return new Set<string>();
  }

  const preferredTree = previousSummary.trees.find(
    (tree) => tree.directionKey === preference.selectedDirectionKey,
  );

  return new Set(preferredTree?.supportingNodeRefs ?? []);
}

function buildUndirectedAdjacency(edges: ComposeGraphEdge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    const fromNeighbors = adjacency.get(edge.from) ?? new Set<string>();
    fromNeighbors.add(edge.to);
    adjacency.set(edge.from, fromNeighbors);

    const toNeighbors = adjacency.get(edge.to) ?? new Set<string>();
    toNeighbors.add(edge.from);
    adjacency.set(edge.to, toNeighbors);
  }

  return adjacency;
}

function sortNodeIdsByScore(
  nodeIds: Iterable<string>,
  scoreByNodeId: Map<string, number>,
): string[] {
  return [...nodeIds].sort(
    (left, right) => (scoreByNodeId.get(right) ?? 0) - (scoreByNodeId.get(left) ?? 0),
  );
}

function collectBundleNodeIds(params: {
  seedId: string;
  adjacency: Map<string, Set<string>>;
  scoreByNodeId: Map<string, number>;
}): string[] {
  const visited = new Set<string>([params.seedId]);
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: params.seedId, depth: 0 }];

  while (queue.length > 0 && visited.size < MAX_BUNDLE_NODES) {
    const current = queue.shift();
    if (!current || current.depth >= MAX_BFS_DEPTH) {
      continue;
    }

    const neighbors = sortNodeIdsByScore(
      params.adjacency.get(current.nodeId) ?? [],
      params.scoreByNodeId,
    );

    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) {
        continue;
      }

      visited.add(neighborId);
      queue.push({ nodeId: neighborId, depth: current.depth + 1 });

      if (visited.size >= MAX_BUNDLE_NODES) {
        break;
      }
    }
  }

  return sortNodeIdsByScore(visited, params.scoreByNodeId);
}

function findBestPreviousDirection(
  supportingNodeRefs: string[],
  previousDirections: PreviousDirectionIdentity[],
): string | undefined {
  const rankedMatches = previousDirections
    .map((previous) => ({
      directionKey: previous.directionKey,
      overlap: jaccardOverlap(supportingNodeRefs, previous.supportingNodeRefs),
    }))
    .sort((left, right) => right.overlap - left.overlap);

  return (rankedMatches[0]?.overlap ?? 0) >= 0.45 ? rankedMatches[0]?.directionKey : undefined;
}

function deriveTargetTreeCount(
  nodes: ComposeGraphNode[],
  scoreByNodeId: Map<string, number>,
): number {
  const strongNodes = nodes.filter(
    (node) =>
      (scoreByNodeId.get(node.id) ?? 0) >= 55 || node.progress >= 45 || node.evidenceScore >= 50,
  ).length;

  if (nodes.length <= 2 || strongNodes <= 1) {
    return 1;
  }

  if (strongNodes <= 3) {
    return 2;
  }

  if (strongNodes <= 5) {
    return 3;
  }

  if (strongNodes <= 7) {
    return 4;
  }

  return MAX_TREE_COUNT;
}

function buildCandidateBundles(params: {
  graph: ComposeGraph;
  scoreByNodeId: Map<string, number>;
  previousDirections: PreviousDirectionIdentity[];
  preferredNodeIds: Set<string>;
}): CandidateBundle[] {
  const adjacency = buildUndirectedAdjacency(params.graph.prerequisiteEdges);
  const rankedNodeIds = [...params.graph.nodes]
    .sort(
      (left, right) =>
        (params.scoreByNodeId.get(right.id) ?? 0) - (params.scoreByNodeId.get(left.id) ?? 0),
    )
    .map((node) => node.id);

  const targetCount = Math.min(
    deriveTargetTreeCount(params.graph.nodes, params.scoreByNodeId),
    MAX_TREE_COUNT,
  );
  const bundles: CandidateBundle[] = [];

  for (const seedId of rankedNodeIds) {
    const nodeIds = collectBundleNodeIds({
      seedId,
      adjacency,
      scoreByNodeId: params.scoreByNodeId,
    });
    const supportingNodeRefs = [...nodeIds];

    if (
      bundles.some((bundle) => jaccardOverlap(bundle.supportingNodeRefs, supportingNodeRefs) >= 0.7)
    ) {
      continue;
    }

    const score =
      nodeIds
        .slice(0, 3)
        .reduce((sum, nodeId) => sum + (params.scoreByNodeId.get(nodeId) ?? 0), 0) /
      Math.min(nodeIds.length, 3);

    bundles.push({
      seedId,
      nodeIds,
      supportingNodeRefs,
      matchPreviousDirectionKey: findBestPreviousDirection(
        supportingNodeRefs,
        params.previousDirections,
      ),
      score,
    });

    if (bundles.length >= targetCount) {
      break;
    }
  }

  if (bundles.length === 0 && rankedNodeIds[0]) {
    bundles.push({
      seedId: rankedNodeIds[0],
      nodeIds: [rankedNodeIds[0]],
      supportingNodeRefs: [rankedNodeIds[0]],
      matchPreviousDirectionKey: findBestPreviousDirection(
        [rankedNodeIds[0]],
        params.previousDirections,
      ),
      score: params.scoreByNodeId.get(rankedNodeIds[0]) ?? 0,
    });
  }

  const selectedDirectionKey =
    [...params.preferredNodeIds].length > 0
      ? params.previousDirections.find((direction) =>
          direction.supportingNodeRefs.some((nodeId) => params.preferredNodeIds.has(nodeId)),
        )?.directionKey
      : null;

  return bundles
    .sort((left, right) => {
      const leftScore =
        left.score +
        (left.matchPreviousDirectionKey && left.matchPreviousDirectionKey === selectedDirectionKey
          ? 12
          : 0);
      const rightScore =
        right.score +
        (right.matchPreviousDirectionKey && right.matchPreviousDirectionKey === selectedDirectionKey
          ? 12
          : 0);
      return rightScore - leftScore;
    })
    .slice(0, targetCount);
}

function collectSemanticLabels(seedNode: ComposeGraphNode, nodes: ComposeGraphNode[]): string[] {
  const orderedLabels = [seedNode.canonicalLabel, ...nodes.map((node) => node.canonicalLabel)];
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const label of orderedLabels) {
    const trimmed = label.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeLabelIdentity(trimmed);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    labels.push(trimmed);
  }

  return labels;
}

function buildSemanticTitle(labelParts: string[]): string {
  if (labelParts.length <= 1) {
    return labelParts[0] ?? "Direction";
  }

  return `${labelParts[0]} · ${labelParts[1]}`;
}

function buildSemanticKeySeed(labelParts: string[]): string {
  return slugify(labelParts.slice(0, 2).join(" "));
}

function inferDirectionSemantic(
  seedNode: ComposeGraphNode,
  nodes: ComposeGraphNode[],
): DirectionSemantic {
  const labelParts = collectSemanticLabels(seedNode, nodes);

  return {
    keySeed: buildSemanticKeySeed(labelParts),
    title: buildSemanticTitle(labelParts),
    labelParts,
  };
}

function ensureDistinctTreeSemantics(
  trees: Array<
    z.infer<typeof composerTreeSchema> & {
      semanticLabelParts: string[];
    }
  >,
): z.infer<typeof composerTreeSchema>[] {
  const usedTitles = new Set<string>();
  const usedKeySeeds = new Set<string>();

  return trees.map((tree) => {
    const { semanticLabelParts: _semanticLabelParts, ...treeWithoutSemanticParts } = tree;
    let title = tree.title;
    let keySeed = tree.keySeed;
    let extraIndex = 2;

    while (
      usedTitles.has(title.toLocaleLowerCase("zh-CN")) ||
      usedKeySeeds.has(keySeed.toLocaleLowerCase("zh-CN"))
    ) {
      const extraLabel = tree.semanticLabelParts[extraIndex];

      if (extraLabel) {
        title = `${tree.title} · ${extraLabel}`;
        keySeed = slugify(`${tree.keySeed} ${extraLabel}`);
        extraIndex += 1;
        continue;
      }

      title = `${tree.title} (${extraIndex - 1})`;
      keySeed = `${tree.keySeed}-${extraIndex - 1}`;
      extraIndex += 1;
    }

    usedTitles.add(title.toLocaleLowerCase("zh-CN"));
    usedKeySeeds.add(keySeed.toLocaleLowerCase("zh-CN"));

    return {
      ...treeWithoutSemanticParts,
      title,
      keySeed,
    };
  });
}

function formatNodeSummary(node: ComposeGraphNode): string {
  if (node.summary?.trim()) {
    return node.summary.trim();
  }

  const stateLabel =
    node.state === "mastered"
      ? "已掌握"
      : node.state === "in_progress"
        ? "学习中"
        : node.state === "ready"
          ? "可开始"
          : "待解锁";

  return `${stateLabel}，当前进度 ${Math.round(node.progress)}%。`;
}

function chooseParentByChild(params: {
  nodeIds: Set<string>;
  edges: ComposeGraphEdge[];
  scoreByNodeId: Map<string, number>;
}): Map<string, string> {
  const parentByChild = new Map<string, string>();
  const bestEdgeWeightByChild = new Map<string, number>();

  for (const edge of params.edges) {
    if (!params.nodeIds.has(edge.from) || !params.nodeIds.has(edge.to)) {
      continue;
    }

    const weight = edge.confidence * 100 + (params.scoreByNodeId.get(edge.from) ?? 0) * 0.1;
    const currentWeight = bestEdgeWeightByChild.get(edge.to) ?? -1;

    if (weight > currentWeight) {
      bestEdgeWeightByChild.set(edge.to, weight);
      parentByChild.set(edge.to, edge.from);
    }
  }

  return parentByChild;
}

function buildBundleTree(params: {
  bundle: CandidateBundle;
  graph: ComposeGraph;
  nodeById: Map<string, ComposeGraphNode>;
  scoreByNodeId: Map<string, number>;
}): ComposerVisibleNode[] {
  const bundleNodeIds = new Set(params.bundle.nodeIds);
  const parentByChild = chooseParentByChild({
    nodeIds: bundleNodeIds,
    edges: params.graph.prerequisiteEdges,
    scoreByNodeId: params.scoreByNodeId,
  });
  const childMap = new Map<string, string[]>();

  for (const [childId, parentId] of parentByChild.entries()) {
    const siblings = childMap.get(parentId) ?? [];
    siblings.push(childId);
    siblings.sort(
      (left, right) =>
        (params.scoreByNodeId.get(right) ?? 0) - (params.scoreByNodeId.get(left) ?? 0),
    );
    childMap.set(parentId, siblings);
  }

  const rootIds = params.bundle.nodeIds.filter((nodeId) => !parentByChild.has(nodeId));
  const orderedRootIds = rootIds.length > 0 ? rootIds : [params.bundle.seedId];
  const visited = new Set<string>();

  const buildNode = (nodeId: string): ComposerVisibleNode => {
    const node = params.nodeById.get(nodeId);
    if (!node) {
      throw new Error(`Missing growth node for ${nodeId}`);
    }

    visited.add(nodeId);
    const childIds = (childMap.get(nodeId) ?? []).filter((childId) => !visited.has(childId));

    return {
      anchorRef: node.id,
      title: node.canonicalLabel.trim(),
      summary: formatNodeSummary(node),
      children: childIds.map((childId) => buildNode(childId)),
    };
  };

  const roots = orderedRootIds.map((nodeId) => buildNode(nodeId));

  for (const nodeId of params.bundle.nodeIds) {
    if (!visited.has(nodeId)) {
      roots.push(buildNode(nodeId));
    }
  }

  return roots;
}

function buildDirectionSummary(nodes: ComposeGraphNode[], semantic: DirectionSemantic): string {
  const labels = nodes.slice(0, 3).map((node) => node.canonicalLabel.trim());
  return `围绕 ${labels.join("、")} 继续扩展，当前重心是 ${semantic.title}。`;
}

function buildDirectionReason(
  nodes: ComposeGraphNode[],
  semantic: DirectionSemantic,
  matchPreviousDirectionKey?: string,
): string {
  const primaryNode = nodes[0];
  const continuityText = matchPreviousDirectionKey ? "并保持了已有方向的连续性，" : "";
  return `${continuityText}当前最强信号来自 ${primaryNode.canonicalLabel}（进度 ${Math.round(primaryNode.progress)}%，证据 ${Math.round(primaryNode.evidenceScore)}%），适合继续组织为${semantic.title}。`;
}

function buildTreeConfidence(bundleScore: number): number {
  return clamp(Number(((bundleScore - 20) / 80).toFixed(2)), 0.35, 0.95);
}

export function resolveDirectionKeys(params: {
  trees: z.infer<typeof composerTreeSchema>[];
  previousDirections: PreviousDirectionIdentity[];
}): Array<z.infer<typeof composerTreeSchema> & { directionKey: string }> {
  const usedKeys = new Set<string>();

  return params.trees.map((tree) => {
    const rankedMatches = params.previousDirections
      .map((previous) => ({
        directionKey: previous.directionKey,
        overlap: jaccardOverlap(tree.supportingNodeRefs, previous.supportingNodeRefs),
      }))
      .sort((left, right) => right.overlap - left.overlap);

    const bestMatch = rankedMatches[0];
    const shouldInherit = (bestMatch?.overlap ?? 0) >= 0.45;

    let baseKey = shouldInherit
      ? (bestMatch?.directionKey ?? slugify(tree.keySeed))
      : slugify(tree.keySeed);
    let suffix = 2;

    while (usedKeys.has(baseKey)) {
      baseKey = `${slugify(tree.keySeed)}-${suffix}`;
      suffix += 1;
    }

    usedKeys.add(baseKey);
    return {
      ...tree,
      directionKey: baseKey,
    };
  });
}

export async function composeGrowthTrees(params: {
  userId: string;
  graph: unknown;
  preference: unknown;
  previousSummary: unknown;
  recordUsage?: boolean;
}): Promise<TreeComposerOutput> {
  const graph = composeGraphSchema.parse(params.graph);
  const preference = composePreferenceSchema.parse(params.preference ?? {});
  const previousSummary = composePreviousSummarySchema.parse(params.previousSummary) ?? {
    trees: [],
  };
  const previousDirections = previousSummary.trees.map((tree) => ({
    directionKey: tree.directionKey,
    supportingNodeRefs: tree.supportingNodeRefs,
  }));
  const preferredNodeIds = buildPreferredNodeIds(preference, previousSummary);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const scoreByNodeId = new Map(
    graph.nodes.map((node) => [node.id, buildNodeScore(node, preferredNodeIds)]),
  );

  const bundles = buildCandidateBundles({
    graph,
    scoreByNodeId,
    previousDirections,
    preferredNodeIds,
  });

  const trees = ensureDistinctTreeSemantics(
    bundles.map((bundle) => {
      const bundleNodes = bundle.nodeIds
        .map((nodeId) => nodeById.get(nodeId))
        .filter((node): node is ComposeGraphNode => Boolean(node));
      const seedNode = nodeById.get(bundle.seedId);
      if (!seedNode) {
        throw new Error(`Missing growth seed node for ${bundle.seedId}`);
      }
      const semantic = inferDirectionSemantic(seedNode, bundleNodes);

      return {
        matchPreviousDirectionKey: bundle.matchPreviousDirectionKey,
        keySeed: semantic.keySeed,
        title: semantic.title,
        summary: buildDirectionSummary(bundleNodes, semantic),
        confidence: buildTreeConfidence(bundle.score),
        whyThisDirection: buildDirectionReason(
          bundleNodes,
          semantic,
          bundle.matchPreviousDirectionKey,
        ),
        supportingNodeRefs: bundle.supportingNodeRefs,
        semanticLabelParts: semantic.labelParts,
        tree: buildBundleTree({
          bundle,
          graph,
          nodeById,
          scoreByNodeId,
        }),
      };
    }),
  );

  const recommendedTree =
    trees.find((tree) => tree.matchPreviousDirectionKey === preference.selectedDirectionKey) ??
    trees[0] ??
    null;

  return treeComposerOutputSchema.parse({
    recommendedDirectionHint:
      recommendedTree?.matchPreviousDirectionKey ?? recommendedTree?.keySeed ?? null,
    trees,
  });
}
