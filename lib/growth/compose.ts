import { z } from "zod";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core";
import { buildDeterministicGrowthTree } from "@/lib/growth/compose-layout";
import {
  composeGrowthDirectionMetadata,
  type GrowthDirectionMetadata,
} from "@/lib/growth/compose-metadata";
import { planGrowthDirections } from "@/lib/growth/compose-planner";
import {
  type ComposeDirectionSignal,
  type ComposeGraph,
  type ComposePreviousSummary,
  type ComposerVisibleNode,
  collectComposerAnchorRefs,
  composeGraphSchema,
  composePreferenceSchema,
  composePreviousSummarySchema,
  composerVisibleNodeSchema,
  jaccardOverlap,
  normalizeText,
  type PreviousDirectionIdentity,
  slugify,
  sortComposeGraph,
  sortPreviousSummary,
} from "@/lib/growth/compose-shared";
import { GROWTH_COMPOSE_MODEL_LABEL } from "@/lib/growth/constants";

export { composerVisibleNodeSchema };
export type { ComposerVisibleNode, PreviousDirectionIdentity };

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
  recommendedDirectionHint: z.string().trim().min(1),
  trees: z.array(composerTreeSchema).min(1).max(5),
});

export type TreeComposerOutput = z.infer<typeof treeComposerOutputSchema>;

function ensureUniqueNormalizedValues(values: string[], label: string) {
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) {
      throw new Error(`Growth compose returned empty normalized ${label}`);
    }
    if (seen.has(normalized)) {
      throw new Error(`Growth compose returned duplicate ${label}: ${value}`);
    }
    seen.add(normalized);
  }
}

function ensureUniqueValues(values: string[], label: string) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Growth compose returned duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function validateComposerTree(params: {
  tree: z.infer<typeof composerTreeSchema>;
  graphNodeIds: Set<string>;
  previousDirectionKeys: Set<string>;
}) {
  ensureUniqueValues(
    params.tree.supportingNodeRefs,
    `supportingNodeRefs for ${params.tree.keySeed}`,
  );

  for (const nodeRef of params.tree.supportingNodeRefs) {
    if (!params.graphNodeIds.has(nodeRef)) {
      throw new Error(`Growth compose returned unknown supporting node ref: ${nodeRef}`);
    }
  }

  if (
    params.tree.matchPreviousDirectionKey &&
    !params.previousDirectionKeys.has(params.tree.matchPreviousDirectionKey)
  ) {
    throw new Error(
      `Growth compose returned unknown previous direction match: ${params.tree.matchPreviousDirectionKey}`,
    );
  }

  const anchorRefs = collectComposerAnchorRefs(params.tree.tree);
  ensureUniqueValues(anchorRefs, `anchor refs for ${params.tree.keySeed}`);

  if (anchorRefs.length === 0) {
    throw new Error(`Growth compose returned empty visible tree for ${params.tree.keySeed}`);
  }

  const supportingRefSet = new Set(params.tree.supportingNodeRefs);
  for (const anchorRef of anchorRefs) {
    if (!params.graphNodeIds.has(anchorRef)) {
      throw new Error(`Growth compose returned unknown anchor ref: ${anchorRef}`);
    }
    if (!supportingRefSet.has(anchorRef)) {
      throw new Error(
        `Growth compose tree ${params.tree.keySeed} used anchorRef outside supportingNodeRefs: ${anchorRef}`,
      );
    }
  }
}

function validateTreeComposerOutput(params: {
  output: unknown;
  graph: ComposeGraph;
  previousSummary: ComposePreviousSummary;
}): TreeComposerOutput {
  const parsed = treeComposerOutputSchema.parse(params.output);
  const graphNodeIds = new Set(params.graph.nodes.map((node) => node.id));
  const previousDirectionKeys = new Set(
    params.previousSummary.trees.map((tree) => tree.directionKey),
  );

  ensureUniqueNormalizedValues(
    parsed.trees.map((tree) => tree.title),
    "direction titles",
  );
  ensureUniqueNormalizedValues(
    parsed.trees.map((tree) => tree.keySeed),
    "direction key seeds",
  );

  for (const tree of parsed.trees) {
    validateComposerTree({
      tree,
      graphNodeIds,
      previousDirectionKeys,
    });
  }

  const validHints = new Set(
    parsed.trees.flatMap((tree) =>
      [tree.keySeed, tree.matchPreviousDirectionKey].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    ),
  );

  if (!validHints.has(parsed.recommendedDirectionHint)) {
    throw new Error(
      `Growth compose returned invalid recommendedDirectionHint: ${parsed.recommendedDirectionHint}`,
    );
  }

  return parsed;
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

function sortPreferenceSignals(signals: ComposeDirectionSignal[]): ComposeDirectionSignal[] {
  return [...signals].sort((left, right) => {
    if (right.selectionCount !== left.selectionCount) {
      return right.selectionCount - left.selectionCount;
    }
    const latestCompare = right.latestSelectedAt.localeCompare(left.latestSelectedAt, "en");
    if (latestCompare !== 0) {
      return latestCompare;
    }
    return left.directionKey.localeCompare(right.directionKey, "en");
  });
}

function collectTreeIdentityKeys(tree: {
  directionKey: string;
  keySeed?: string;
  matchPreviousDirectionKey?: string;
}): string[] {
  return [tree.directionKey, tree.matchPreviousDirectionKey, tree.keySeed].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function computePreferenceBiasScore(params: {
  tree: {
    directionKey: string;
    keySeed?: string;
    matchPreviousDirectionKey?: string;
  };
  preference: z.infer<typeof composePreferenceSchema>;
  rankedSignals: ComposeDirectionSignal[];
}): number {
  const identityKeys = new Set(collectTreeIdentityKeys(params.tree));
  let score = 0;

  if (
    params.preference.selectedDirectionKey &&
    identityKeys.has(params.preference.selectedDirectionKey)
  ) {
    score += 1_000;
  }

  const matchedSignalIndex = params.rankedSignals.findIndex((signal) =>
    identityKeys.has(signal.directionKey),
  );
  if (matchedSignalIndex === -1) {
    return score;
  }

  const matchedSignal = params.rankedSignals[matchedSignalIndex];
  const rankBonus = Math.max(0, params.rankedSignals.length - matchedSignalIndex) * 10;
  return score + matchedSignal.selectionCount * 100 + rankBonus;
}

export function sortResolvedTreesByPreference(params: {
  trees: Array<z.infer<typeof composerTreeSchema> & { directionKey: string }>;
  preference: unknown;
}): Array<z.infer<typeof composerTreeSchema> & { directionKey: string }> {
  const preference = composePreferenceSchema.parse(params.preference ?? {});
  const rankedSignals = sortPreferenceSignals(preference.directionSignals ?? []);

  return [...params.trees]
    .map((tree, index) => ({
      tree,
      index,
      preferenceScore: computePreferenceBiasScore({
        tree,
        preference,
        rankedSignals,
      }),
    }))
    .sort((left, right) => {
      if (right.preferenceScore !== left.preferenceScore) {
        return right.preferenceScore - left.preferenceScore;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.tree);
}

function flattenTreeNodes(nodes: ComposerVisibleNode[]): ComposerVisibleNode[] {
  return nodes.flatMap((node) => [node, ...flattenTreeNodes(node.children)]);
}

function computeDirectionConfidence(params: {
  graph: ComposeGraph;
  supportingNodeRefs: string[];
}): number {
  const supportingNodes = params.supportingNodeRefs
    .map((nodeId) => params.graph.nodes.find((node) => node.id === nodeId))
    .filter((node): node is ComposeGraph["nodes"][number] => !!node);

  if (supportingNodes.length === 0) {
    return 0;
  }

  const averageProgress =
    supportingNodes.reduce((sum, node) => sum + node.progress, 0) / supportingNodes.length;
  const averageEvidence =
    supportingNodes.reduce((sum, node) => sum + node.evidenceScore, 0) / supportingNodes.length;
  const momentumNodes = supportingNodes.filter(
    (node) => node.state === "mastered" || node.state === "in_progress",
  ).length;

  const confidence =
    (averageProgress / 100) * 0.45 +
    (averageEvidence / 100) * 0.35 +
    Math.min(0.1, supportingNodes.length * 0.03) +
    Math.min(0.1, momentumNodes * 0.03);

  return Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100;
}

function applyDirectionMetadata(params: {
  tree: ComposerVisibleNode[];
  metadata: GrowthDirectionMetadata;
}): ComposerVisibleNode[] {
  const labelMap = new Map(params.metadata.nodeLabels.map((label) => [label.anchorRef, label]));

  const applyNode = (node: ComposerVisibleNode): ComposerVisibleNode => {
    const label = labelMap.get(node.anchorRef);
    return {
      anchorRef: node.anchorRef,
      title: label?.title ?? node.title,
      summary: label?.summary ?? node.summary,
      children: node.children.map(applyNode),
    };
  };

  return params.tree.map(applyNode);
}

export async function composeGrowthTrees(params: {
  userId: string;
  graph: unknown;
  preference: unknown;
  previousSummary: unknown;
  recordUsage?: boolean;
}): Promise<TreeComposerOutput> {
  const graph = sortComposeGraph(composeGraphSchema.parse(params.graph));
  const preference = composePreferenceSchema.parse(params.preference ?? {});
  const previousSummary = sortPreviousSummary(
    composePreviousSummarySchema.parse(params.previousSummary) ?? {
      trees: [],
    },
  );
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "growth:compose",
    intent: "growth-compose",
    workflow: "growth",
    modelPolicy: "interactive-fast",
    promptVersion: "growth-compose@v4",
    userId: params.userId,
    metadata: {
      nodeCount: graph.nodes.length,
      edgeCount: graph.prerequisiteEdges.length,
      previousTreeCount: previousSummary.trees.length,
      selectedDirectionKey: preference.selectedDirectionKey ?? null,
      preferenceVersion: preference.preferenceVersion ?? 0,
      selectionCount: preference.selectionCount ?? 0,
      preferenceSignalCount: preference.directionSignals?.length ?? 0,
      strategy: "planner-deterministic-layout-metadata",
    },
  });

  try {
    const planned = await planGrowthDirections({
      userId: params.userId,
      graph,
      preference,
      previousSummary,
      recordUsage: params.recordUsage,
    });

    const deterministicDirections = planned.directions.map((direction) => ({
      ...direction,
      tree: buildDeterministicGrowthTree({
        graph,
        supportingNodeRefs: direction.supportingNodeRefs,
      }),
      confidence: computeDirectionConfidence({
        graph,
        supportingNodeRefs: direction.supportingNodeRefs,
      }),
    }));

    const metadata = await composeGrowthDirectionMetadata({
      userId: params.userId,
      graph,
      directions: deterministicDirections.map((direction) => ({
        keySeed: direction.keySeed,
        matchPreviousDirectionKey: direction.matchPreviousDirectionKey,
        supportingNodeRefs: direction.supportingNodeRefs,
        tree: direction.tree,
      })),
      recordUsage: params.recordUsage,
    });
    const metadataByKeySeed = new Map(metadata.map((direction) => [direction.keySeed, direction]));

    const output = {
      recommendedDirectionHint:
        deterministicDirections[planned.recommendedDirectionIndex]?.matchPreviousDirectionKey ??
        deterministicDirections[planned.recommendedDirectionIndex]?.keySeed ??
        deterministicDirections[0]?.keySeed ??
        "direction",
      trees: deterministicDirections.map((direction) => {
        const directionMetadata = metadataByKeySeed.get(direction.keySeed);
        if (!directionMetadata) {
          throw new Error(`Missing metadata for growth direction ${direction.keySeed}`);
        }

        const tree = applyDirectionMetadata({
          tree: direction.tree,
          metadata: directionMetadata,
        });

        if (flattenTreeNodes(tree).length === 0) {
          throw new Error(`Growth compose built an empty tree for ${direction.keySeed}`);
        }

        return {
          matchPreviousDirectionKey: direction.matchPreviousDirectionKey,
          keySeed: direction.keySeed,
          title: directionMetadata.title,
          summary: directionMetadata.summary,
          confidence: direction.confidence,
          whyThisDirection: directionMetadata.whyThisDirection,
          supportingNodeRefs: direction.supportingNodeRefs,
          tree,
        };
      }),
    };

    const validated = validateTreeComposerOutput({
      output,
      graph,
      previousSummary,
    });

    if (params.recordUsage !== false) {
      await recordAIUsage({
        ...telemetry,
        durationMs: Date.now() - startedAt,
        success: true,
        metadata: {
          ...telemetry.metadata,
          model: GROWTH_COMPOSE_MODEL_LABEL,
          treeCount: validated.trees.length,
          recommendedDirectionHint: validated.recommendedDirectionHint,
        },
      });
    }

    return validated;
  } catch (error) {
    if (params.recordUsage !== false) {
      await recordAIUsage({
        ...telemetry,
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: getErrorMessage(error),
        metadata: {
          ...telemetry.metadata,
          model: GROWTH_COMPOSE_MODEL_LABEL,
        },
      });
    }
    throw error;
  }
}
