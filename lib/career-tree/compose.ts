import { z } from "zod";
import type { CandidateCareerTree, VisibleSkillTreeNode } from "@/lib/career-tree/types";

export const composerVisibleNodeSchema: z.ZodType<ComposerVisibleNode> = z.lazy(() =>
  z.object({
    anchorRef: z.string(),
    title: z.string(),
    summary: z.string(),
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
  matchPreviousDirectionKey: z.string().optional(),
  keySeed: z.string().min(1),
  title: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  whyThisDirection: z.string(),
  supportingNodeRefs: z.array(z.string()).default([]),
  tree: z.array(composerVisibleNodeSchema),
});

export const treeComposerOutputSchema = z.object({
  recommendedDirectionHint: z.string().nullable().optional(),
  trees: z.array(composerTreeSchema),
});

export type TreeComposerOutput = z.infer<typeof treeComposerOutputSchema>;

export interface PreviousDirectionIdentity {
  directionKey: string;
  supportingNodeRefs: string[];
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug || "career-direction";
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

export function buildVisibleTreeNodeIds(
  directionKey: string,
  nodes: ComposerVisibleNode[],
  pathPrefix = "0",
): VisibleSkillTreeNode[] {
  return nodes.map((node, index) => {
    const pathIndex = `${pathPrefix}-${index}`;
    return {
      id: `${directionKey}:${node.anchorRef}:${pathIndex}`,
      anchorRef: node.anchorRef,
      title: node.title,
      summary: node.summary,
      progress: 0,
      state: "ready",
      children: buildVisibleTreeNodeIds(directionKey, node.children, pathIndex),
    };
  });
}

export function createPendingCandidateTree(directionKey: string): CandidateCareerTree {
  return {
    directionKey,
    title: "职业树生成中",
    summary: "系统正在整理当前证据。",
    confidence: 0,
    whyThisDirection: "",
    supportingCourses: [],
    supportingChapters: [],
    tree: [],
  };
}
