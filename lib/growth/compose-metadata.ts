import { generateText, Output } from "ai";
import { z } from "zod";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import {
  type ComposeGraph,
  type ComposerVisibleNode,
  collectComposerAnchorRefs,
  normalizeText,
} from "@/lib/growth/compose-shared";
import {
  GROWTH_COMPOSE_METADATA_MODEL_LABEL,
  GROWTH_DIRECTION_METADATA_AI_TIMEOUT_MS,
} from "@/lib/growth/constants";
import {
  buildGrowthComposeMetadataPrompt,
  GROWTH_COMPOSE_METADATA_SYSTEM_PROMPT,
} from "@/lib/growth/prompts";

const nodeMetadataSchema = z.object({
  anchorRef: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
});

const directionMetadataOutputSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  whyThisDirection: z.string().trim().min(1),
  nodeLabels: z.array(nodeMetadataSchema).default([]),
});

export interface GrowthDirectionMetadata {
  keySeed: string;
  title: string;
  summary: string;
  whyThisDirection: string;
  nodeLabels: Array<{
    anchorRef: string;
    title: string;
    summary: string;
  }>;
}

function buildTreeRows(
  nodes: ComposerVisibleNode[],
  parentAnchorRef: string | null = null,
  depth = 0,
): Array<{
  anchorRef: string;
  parentAnchorRef: string | null;
  depth: number;
}> {
  return nodes.flatMap((node) => [
    {
      anchorRef: node.anchorRef,
      parentAnchorRef,
      depth,
    },
    ...buildTreeRows(node.children, node.anchorRef, depth + 1),
  ]);
}

function validateMetadataOutput(params: {
  output: unknown;
  requestedDirection: {
    keySeed: string;
    tree: ComposerVisibleNode[];
  };
}): GrowthDirectionMetadata {
  const parsed = directionMetadataOutputSchema.parse(params.output);

  const normalizedTitle = normalizeText(parsed.title);
  if (!normalizedTitle) {
    throw new Error(
      `Growth compose metadata returned empty title for ${params.requestedDirection.keySeed}`,
    );
  }

  const allowedAnchorRefs = new Set(collectComposerAnchorRefs(params.requestedDirection.tree));
  const seenAnchorRefs = new Set<string>();

  for (const nodeLabel of parsed.nodeLabels) {
    if (!allowedAnchorRefs.has(nodeLabel.anchorRef)) {
      throw new Error(
        `Growth compose metadata returned unknown node label anchorRef ${nodeLabel.anchorRef} for ${params.requestedDirection.keySeed}`,
      );
    }
    if (seenAnchorRefs.has(nodeLabel.anchorRef)) {
      throw new Error(
        `Growth compose metadata returned duplicate node label anchorRef ${nodeLabel.anchorRef} for ${params.requestedDirection.keySeed}`,
      );
    }
    seenAnchorRefs.add(nodeLabel.anchorRef);
  }

  return {
    ...parsed,
    keySeed: params.requestedDirection.keySeed,
  };
}

function assertDistinctMetadataTitles(metadata: GrowthDirectionMetadata[]) {
  const seenTitles = new Set<string>();

  for (const direction of metadata) {
    const normalizedTitle = normalizeText(direction.title);
    if (seenTitles.has(normalizedTitle)) {
      throw new Error(`Growth compose metadata returned duplicate title: ${direction.title}`);
    }
    seenTitles.add(normalizedTitle);
  }
}

function sumUsage(
  results: Array<{
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
  }>,
) {
  const inputTokens = results.reduce((sum, result) => sum + (result.usage?.inputTokens ?? 0), 0);
  const outputTokens = results.reduce((sum, result) => sum + (result.usage?.outputTokens ?? 0), 0);
  const totalTokens = results.reduce((sum, result) => {
    const usage = result.usage;
    return sum + (usage?.totalTokens ?? (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0));
  }, 0);

  return {
    inputTokens,
    outputTokens,
    totalTokens: totalTokens || inputTokens + outputTokens,
  };
}

export async function composeGrowthDirectionMetadata(params: {
  userId: string;
  graph: ComposeGraph;
  directions: Array<{
    keySeed: string;
    matchPreviousDirectionKey?: string;
    supportingNodeRefs: string[];
    tree: ComposerVisibleNode[];
  }>;
  recordUsage?: boolean;
}): Promise<GrowthDirectionMetadata[]> {
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "growth:compose:metadata",
    intent: "growth-compose-metadata",
    workflow: "growth",
    modelPolicy: "section-draft",
    promptVersion: "growth-compose-metadata@v1",
    userId: params.userId,
    metadata: {
      directionCount: params.directions.length,
      nodeCount: params.graph.nodes.length,
    },
  });

  try {
    const graphNodeMap = new Map(params.graph.nodes.map((node) => [node.id, node]));
    const results = await Promise.all(
      params.directions.map(async (direction) => {
        const result = await generateText({
          model: getPlainModelForPolicy("section-draft"),
          output: Output.object({ schema: directionMetadataOutputSchema }),
          system: GROWTH_COMPOSE_METADATA_SYSTEM_PROMPT,
          prompt: buildGrowthComposeMetadataPrompt({
            direction: {
              keySeed: direction.keySeed,
              matchPreviousDirectionKey: direction.matchPreviousDirectionKey,
              supportingNodeRefs: direction.supportingNodeRefs,
              nodes: buildTreeRows(direction.tree).map((row) => {
                const graphNode = graphNodeMap.get(row.anchorRef);
                return {
                  anchorRef: row.anchorRef,
                  parentAnchorRef: row.parentAnchorRef,
                  depth: row.depth,
                  canonicalLabel: graphNode?.canonicalLabel ?? row.anchorRef,
                  summary: graphNode?.summary ?? null,
                  progress: graphNode?.progress ?? 0,
                  state: graphNode?.state ?? "ready",
                  evidenceScore: graphNode?.evidenceScore ?? 0,
                };
              }),
            },
          }),
          ...buildGenerationSettingsForPolicy("section-draft", {
            temperature: 0.15,
          }),
          timeout: GROWTH_DIRECTION_METADATA_AI_TIMEOUT_MS,
        });

        return {
          usage: result.usage,
          metadata: validateMetadataOutput({
            output: result.output,
            requestedDirection: direction,
          }),
        };
      }),
    );

    const validated = results.map((result) => result.metadata);
    assertDistinctMetadataTitles(validated);

    if (params.recordUsage !== false) {
      await recordAIUsage({
        ...telemetry,
        usage: sumUsage(results),
        durationMs: Date.now() - startedAt,
        success: true,
        metadata: {
          ...telemetry.metadata,
          model: GROWTH_COMPOSE_METADATA_MODEL_LABEL,
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
          model: GROWTH_COMPOSE_METADATA_MODEL_LABEL,
        },
      });
    }
    throw error;
  }
}
