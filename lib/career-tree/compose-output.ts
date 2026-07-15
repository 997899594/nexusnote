import { z } from "zod";
import { MAX_CAREER_TREES } from "@/lib/career-tree/constants";
import { logCareerTreePipelineEvent } from "@/lib/career-tree/pipeline-log";
import type { CareerTreeSnapshot, VisibleSkillTreeNode } from "@/lib/career-tree/types";

export interface ComposerVisibleNode {
  anchorRef: string;
  title: string;
  summary: string;
  children: ComposerVisibleNode[];
}

interface ComposerOutputRepairStats {
  droppedAnchorRefs: number;
  droppedDuplicateAnchorRefs: number;
  droppedRoleSupportingRefs: number;
  droppedRoles: number;
  droppedSupportingRefs: number;
  droppedTrees: number;
  normalizedEmptyMatchKeys: number;
  normalizedRecommendedDirectionHint: boolean;
  renamedDuplicateKeySeeds: number;
  unknownPreviousDirectionKeys: number;
}

const composerVisibleNodeSchema: z.ZodType<ComposerVisibleNode> = z.lazy(() =>
  z.object({
    anchorRef: z.string(),
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    children: z.array(composerVisibleNodeSchema).default([]),
  }),
);

const composerTreeSchema = z.object({
  matchPreviousDirectionKey: z.string().nullable().optional(),
  keySeed: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  whyThisDirection: z.string().trim().min(1),
  supportingNodeRefs: z.array(z.string()).default([]),
  progressionRoles: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        title: z.string().trim().min(1),
        summary: z.string().trim().min(1),
        horizon: z.enum(["next", "later"]),
        confidence: z.number().min(0).max(1),
        supportingNodeRefs: z.array(z.string()).default([]),
      }),
    )
    .max(3)
    .default([]),
  tree: z.array(composerVisibleNodeSchema).default([]),
});

export const treeComposerOutputSchema = z.object({
  recommendedDirectionHint: z.string().nullable().optional(),
  trees: z.array(composerTreeSchema).min(1).max(MAX_CAREER_TREES),
});

export type TreeComposerOutput = z.infer<typeof treeComposerOutputSchema>;
export type ResolvedComposerTree = z.infer<typeof composerTreeSchema> & { directionKey: string };
export type ResolvedComposerProgressionRole = ResolvedComposerTree["progressionRoles"][number];

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return slug || "direction";
}

function collectAnchorRefs(nodes: ComposerVisibleNode[]): string[] {
  return nodes.flatMap((node) => [node.anchorRef, ...collectAnchorRefs(node.children)]);
}

export function collectVisibleAnchorRefs(nodes: VisibleSkillTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.anchorRef, ...collectVisibleAnchorRefs(node.children)]);
}

function ensureUniqueValues(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Career compose returned duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function createRepairStats(): ComposerOutputRepairStats {
  return {
    droppedAnchorRefs: 0,
    droppedDuplicateAnchorRefs: 0,
    droppedRoleSupportingRefs: 0,
    droppedRoles: 0,
    droppedSupportingRefs: 0,
    droppedTrees: 0,
    normalizedEmptyMatchKeys: 0,
    normalizedRecommendedDirectionHint: false,
    renamedDuplicateKeySeeds: 0,
    unknownPreviousDirectionKeys: 0,
  };
}

function didRepair(stats: ComposerOutputRepairStats): boolean {
  return Object.entries(stats).some(([, value]) => value !== 0 && value !== false);
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  return value?.trim() || undefined;
}

function normalizeKnownNodeRefs(
  refs: string[],
  nodeIds: Set<string>,
  stats: ComposerOutputRepairStats,
): string[] {
  const knownRefs: string[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const normalizedRef = ref.trim();
    if (!normalizedRef || !nodeIds.has(normalizedRef)) {
      stats.droppedSupportingRefs += 1;
      continue;
    }
    if (!seen.has(normalizedRef)) {
      seen.add(normalizedRef);
      knownRefs.push(normalizedRef);
    }
  }
  return knownRefs;
}

function sanitizeVisibleNodes(params: {
  nodes: ComposerVisibleNode[];
  nodeIds: Set<string>;
  stats: ComposerOutputRepairStats;
  seenAnchorRefs: Set<string>;
}): ComposerVisibleNode[] {
  return params.nodes.flatMap((node) => {
    const anchorRef = node.anchorRef.trim();
    if (!anchorRef || !params.nodeIds.has(anchorRef)) {
      params.stats.droppedAnchorRefs += 1;
      return sanitizeVisibleNodes({ ...params, nodes: node.children });
    }
    if (params.seenAnchorRefs.has(anchorRef)) {
      params.stats.droppedDuplicateAnchorRefs += 1;
      return sanitizeVisibleNodes({ ...params, nodes: node.children });
    }
    params.seenAnchorRefs.add(anchorRef);
    return {
      ...node,
      anchorRef,
      children: sanitizeVisibleNodes({ ...params, nodes: node.children }),
    };
  });
}

function sanitizeProgressionRoles(params: {
  roles: TreeComposerOutput["trees"][number]["progressionRoles"];
  anchorRefSet: Set<string>;
  stats: ComposerOutputRepairStats;
}): TreeComposerOutput["trees"][number]["progressionRoles"] {
  return params.roles.flatMap((role) => {
    const supportingNodeRefs = [
      ...new Set(role.supportingNodeRefs.map((ref) => ref.trim())),
    ].filter((ref) => {
      const known = params.anchorRefSet.has(ref);
      if (!known) params.stats.droppedRoleSupportingRefs += 1;
      return known;
    });
    if (supportingNodeRefs.length === 0) {
      params.stats.droppedRoles += 1;
      return [];
    }
    return { ...role, supportingNodeRefs };
  });
}

function normalizeDuplicateKeySeeds(
  trees: TreeComposerOutput["trees"],
  stats: ComposerOutputRepairStats,
): TreeComposerOutput["trees"] {
  const seen = new Set<string>();
  return trees.map((tree) => {
    if (!seen.has(tree.keySeed)) {
      seen.add(tree.keySeed);
      return tree;
    }
    let suffix = 2;
    let keySeed = `${tree.keySeed}-${suffix}`;
    while (seen.has(keySeed)) {
      suffix += 1;
      keySeed = `${tree.keySeed}-${suffix}`;
    }
    seen.add(keySeed);
    stats.renamedDuplicateKeySeeds += 1;
    return { ...tree, keySeed };
  });
}

function sanitizeSnapshotNodes(
  nodes: VisibleSkillTreeNode[],
  nodeIds: Set<string>,
): VisibleSkillTreeNode[] {
  return nodes.flatMap((node) => {
    const children = sanitizeSnapshotNodes(node.children, nodeIds);
    return nodeIds.has(node.anchorRef) ? [{ ...node, children }] : children;
  });
}

export function sanitizePreviousSnapshotForCompose(
  previousSnapshot: CareerTreeSnapshot | null,
  nodeIds: Set<string>,
): CareerTreeSnapshot | null {
  if (!previousSnapshot) return null;
  const trees = previousSnapshot.trees.flatMap((tree) => {
    const sanitizedTree = sanitizeSnapshotNodes(tree.tree, nodeIds);
    return sanitizedTree.length > 0 ? [{ ...tree, tree: sanitizedTree }] : [];
  });
  if (trees.length === 0) return null;
  const directionKeys = new Set(trees.map((tree) => tree.directionKey));
  return {
    ...previousSnapshot,
    recommendedDirectionKey: directionKeys.has(previousSnapshot.recommendedDirectionKey ?? "")
      ? previousSnapshot.recommendedDirectionKey
      : null,
    selectedDirectionKey: directionKeys.has(previousSnapshot.selectedDirectionKey ?? "")
      ? previousSnapshot.selectedDirectionKey
      : null,
    trees,
  };
}

export function validateComposerOutput(params: {
  output: TreeComposerOutput;
  nodeIds: Set<string>;
  previousDirectionKeys: Set<string>;
  userId: string;
  runId: string;
}): TreeComposerOutput {
  const stats = createRepairStats();
  const recommendedDirectionHint = normalizeOptional(params.output.recommendedDirectionHint);
  const trees = params.output.trees.flatMap((tree) => {
    const matchPreviousDirectionKey = normalizeOptional(tree.matchPreviousDirectionKey);
    if (tree.matchPreviousDirectionKey !== undefined && !matchPreviousDirectionKey) {
      stats.normalizedEmptyMatchKeys += 1;
    }
    const knownPreviousDirectionKey =
      matchPreviousDirectionKey && params.previousDirectionKeys.has(matchPreviousDirectionKey)
        ? matchPreviousDirectionKey
        : undefined;
    if (matchPreviousDirectionKey && !knownPreviousDirectionKey) {
      stats.unknownPreviousDirectionKeys += 1;
    }
    const treeNodes = sanitizeVisibleNodes({
      nodes: tree.tree,
      nodeIds: params.nodeIds,
      stats,
      seenAnchorRefs: new Set(),
    });
    const anchorRefs = collectAnchorRefs(treeNodes);
    const supportingNodeRefs = normalizeKnownNodeRefs(
      [...tree.supportingNodeRefs, ...anchorRefs],
      params.nodeIds,
      stats,
    );
    if (treeNodes.length === 0 || supportingNodeRefs.length === 0) {
      stats.droppedTrees += 1;
      return [];
    }
    return {
      ...tree,
      matchPreviousDirectionKey: knownPreviousDirectionKey,
      supportingNodeRefs,
      progressionRoles: sanitizeProgressionRoles({
        roles: tree.progressionRoles,
        anchorRefSet: new Set(anchorRefs),
        stats,
      }),
      tree: treeNodes,
    };
  });
  if (params.output.recommendedDirectionHint !== undefined && !recommendedDirectionHint) {
    stats.normalizedRecommendedDirectionHint = true;
  }
  const normalizedOutput: TreeComposerOutput = {
    recommendedDirectionHint: recommendedDirectionHint ?? null,
    trees: normalizeDuplicateKeySeeds(trees, stats),
  };
  if (normalizedOutput.trees.length === 0) {
    throw new Error("Career compose returned no trees with known graph node refs");
  }
  if (didRepair(stats)) {
    logCareerTreePipelineEvent("career_tree_compose_output_repaired", {
      stage: "compose",
      userId: params.userId,
      runId: params.runId,
      ...stats,
    });
  }
  ensureUniqueValues(
    normalizedOutput.trees.map((tree) => tree.keySeed),
    "keySeed",
  );
  for (const tree of normalizedOutput.trees) {
    const anchorRefs = collectAnchorRefs(tree.tree);
    tree.supportingNodeRefs = [...new Set([...tree.supportingNodeRefs, ...anchorRefs])];
    ensureUniqueValues(tree.supportingNodeRefs, `supporting refs for ${tree.keySeed}`);
    for (const nodeRef of tree.supportingNodeRefs) {
      if (!params.nodeIds.has(nodeRef)) {
        throw new Error(`Career compose returned unknown supporting node ref: ${nodeRef}`);
      }
    }
    ensureUniqueValues(anchorRefs, `anchor refs for ${tree.keySeed}`);
    const anchorRefSet = new Set(anchorRefs);
    for (const role of tree.progressionRoles) {
      for (const nodeRef of role.supportingNodeRefs) {
        if (!anchorRefSet.has(nodeRef)) {
          throw new Error(`Career compose role ${role.id} references hidden node outside tree`);
        }
      }
    }
  }
  return normalizedOutput;
}

export function resolveDirectionKeys(params: {
  trees: TreeComposerOutput["trees"];
  previousDirectionKeys: Set<string>;
}): ResolvedComposerTree[] {
  const usedKeys = new Set<string>();
  return params.trees.map((tree) => {
    const inheritedKey =
      tree.matchPreviousDirectionKey &&
      params.previousDirectionKeys.has(tree.matchPreviousDirectionKey)
        ? tree.matchPreviousDirectionKey
        : null;
    let directionKey = inheritedKey ?? slugify(tree.keySeed);
    let suffix = 2;
    while (usedKeys.has(directionKey)) {
      directionKey = `${slugify(tree.keySeed)}-${suffix}`;
      suffix += 1;
    }
    usedKeys.add(directionKey);
    return { ...tree, directionKey };
  });
}

export function sortTreesByPreference(params: {
  trees: ResolvedComposerTree[];
  selectedDirectionKey: string | null;
}): ResolvedComposerTree[] {
  return [...params.trees].sort((left, right) => {
    if (left.directionKey === params.selectedDirectionKey) return -1;
    if (right.directionKey === params.selectedDirectionKey) return 1;
    return 0;
  });
}

export function resolveRecommendedDirectionKey(params: {
  resolvedTrees: ResolvedComposerTree[];
  recommendedDirectionHint: string | null;
}): string | null {
  return (
    params.resolvedTrees.find(
      (tree) =>
        tree.keySeed === params.recommendedDirectionHint ||
        tree.matchPreviousDirectionKey === params.recommendedDirectionHint ||
        tree.directionKey === params.recommendedDirectionHint,
    )?.directionKey ??
    params.resolvedTrees[0]?.directionKey ??
    null
  );
}
