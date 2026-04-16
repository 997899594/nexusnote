import { z } from "zod";

export interface ComposerVisibleNode {
  anchorRef: string;
  title: string;
  summary: string;
  children: ComposerVisibleNode[];
}

export const composerVisibleNodeSchema: z.ZodType<ComposerVisibleNode> = z.lazy(() =>
  z.object({
    anchorRef: z.string().trim().min(1),
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    children: z.array(composerVisibleNodeSchema),
  }),
);

export interface PreviousDirectionIdentity {
  directionKey: string;
  supportingNodeRefs: string[];
}

export interface ComposeDirectionSignal {
  directionKey: string;
  selectionCount: number;
  latestSelectedAt: string;
}

export const composeGraphNodeSchema = z.object({
  id: z.string().trim().min(1),
  canonicalLabel: z.string().trim().min(1),
  summary: z.string().nullable(),
  progress: z.number().min(0).max(100),
  state: z.string().trim().min(1),
  courseCount: z.number().int().nonnegative(),
  chapterCount: z.number().int().nonnegative(),
  evidenceScore: z.number().min(0).max(100),
});

export const composeGraphEdgeSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const composeGraphSchema = z.object({
  nodes: z.array(composeGraphNodeSchema),
  prerequisiteEdges: z.array(composeGraphEdgeSchema).default([]),
});

export const composePreferenceSchema = z
  .object({
    selectedDirectionKey: z.string().nullable().optional(),
    preferenceVersion: z.number().int().nonnegative().optional(),
    selectionCount: z.number().int().nonnegative().optional(),
    directionSignals: z
      .array(
        z.object({
          directionKey: z.string().trim().min(1),
          selectionCount: z.number().int().positive(),
          latestSelectedAt: z.string().trim().min(1),
        }),
      )
      .default([]),
  })
  .passthrough();

export const composePreviousSummarySchema = z
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

export type ComposeGraph = z.infer<typeof composeGraphSchema>;
export type ComposePreviousSummary = NonNullable<z.infer<typeof composePreviousSummarySchema>>;
export type ComposePreference = z.infer<typeof composePreferenceSchema>;

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug || "direction";
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function jaccardOverlap(left: string[], right: string[]): number {
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

export function collectComposerAnchorRefs(nodes: ComposerVisibleNode[]): string[] {
  return nodes.flatMap((node) => [node.anchorRef, ...collectComposerAnchorRefs(node.children)]);
}

export function sortComposeGraph(graph: ComposeGraph): ComposeGraph {
  return {
    nodes: [...graph.nodes].sort((left, right) => {
      if (right.evidenceScore !== left.evidenceScore) {
        return right.evidenceScore - left.evidenceScore;
      }
      if (right.progress !== left.progress) {
        return right.progress - left.progress;
      }
      return left.canonicalLabel.localeCompare(right.canonicalLabel, "zh-Hans-CN");
    }),
    prerequisiteEdges: [...graph.prerequisiteEdges].sort((left, right) => {
      const leftKey = `${left.from}:${left.to}:${left.confidence}`;
      const rightKey = `${right.from}:${right.to}:${right.confidence}`;
      return leftKey.localeCompare(rightKey, "en");
    }),
  };
}

export function sortPreviousSummary(
  previousSummary: ComposePreviousSummary,
): ComposePreviousSummary {
  return {
    trees: [...previousSummary.trees]
      .map((tree) => ({
        directionKey: tree.directionKey,
        supportingNodeRefs: [...tree.supportingNodeRefs].sort((left, right) =>
          left.localeCompare(right, "en"),
        ),
      }))
      .sort((left, right) => left.directionKey.localeCompare(right.directionKey, "en")),
  };
}
