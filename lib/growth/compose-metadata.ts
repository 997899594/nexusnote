import { generateText, Output } from "ai";
import { z } from "zod";
import {
  createTelemetryContext,
  getErrorMessage,
  getJsonModelForPolicy,
  recordAIUsage,
} from "@/lib/ai/core";
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

const directionMetadataSchema = z.object({
  keySeed: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  whyThisDirection: z.string().trim().min(1),
  nodeLabels: z.array(nodeMetadataSchema).default([]),
});

const composeMetadataOutputSchema = z.object({
  directions: z.array(directionMetadataSchema).min(1).max(5),
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
  requestedDirections: Array<{
    keySeed: string;
    tree: ComposerVisibleNode[];
  }>;
}): GrowthDirectionMetadata[] {
  const parsed = composeMetadataOutputSchema.parse(params.output);
  const requestedDirectionMap = new Map(
    params.requestedDirections.map((direction) => [direction.keySeed, direction]),
  );

  if (parsed.directions.length !== params.requestedDirections.length) {
    throw new Error(
      `Growth compose metadata returned ${parsed.directions.length} directions for ${params.requestedDirections.length} requests`,
    );
  }

  const seenKeys = new Set<string>();
  const seenTitles = new Set<string>();

  return parsed.directions.map((direction) => {
    if (!requestedDirectionMap.has(direction.keySeed)) {
      throw new Error(
        `Growth compose metadata returned unknown direction keySeed: ${direction.keySeed}`,
      );
    }
    if (seenKeys.has(direction.keySeed)) {
      throw new Error(`Growth compose metadata returned duplicate keySeed: ${direction.keySeed}`);
    }
    seenKeys.add(direction.keySeed);

    const normalizedTitle = normalizeText(direction.title);
    if (!normalizedTitle) {
      throw new Error(`Growth compose metadata returned empty title for ${direction.keySeed}`);
    }
    if (seenTitles.has(normalizedTitle)) {
      throw new Error(`Growth compose metadata returned duplicate title: ${direction.title}`);
    }
    seenTitles.add(normalizedTitle);

    const requestedDirection = requestedDirectionMap.get(direction.keySeed);
    const allowedAnchorRefs = new Set(collectComposerAnchorRefs(requestedDirection?.tree ?? []));
    const seenAnchorRefs = new Set<string>();

    for (const nodeLabel of direction.nodeLabels) {
      if (!allowedAnchorRefs.has(nodeLabel.anchorRef)) {
        throw new Error(
          `Growth compose metadata returned unknown node label anchorRef ${nodeLabel.anchorRef} for ${direction.keySeed}`,
        );
      }
      if (seenAnchorRefs.has(nodeLabel.anchorRef)) {
        throw new Error(
          `Growth compose metadata returned duplicate node label anchorRef ${nodeLabel.anchorRef} for ${direction.keySeed}`,
        );
      }
      seenAnchorRefs.add(nodeLabel.anchorRef);
    }

    return direction;
  });
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
    modelPolicy: "interactive-fast",
    promptVersion: "growth-compose-metadata@v1",
    userId: params.userId,
    metadata: {
      directionCount: params.directions.length,
      nodeCount: params.graph.nodes.length,
    },
  });

  try {
    const result = await generateText({
      model: getJsonModelForPolicy("interactive-fast"),
      output: Output.object({ schema: composeMetadataOutputSchema }),
      system: GROWTH_COMPOSE_METADATA_SYSTEM_PROMPT,
      prompt: buildGrowthComposeMetadataPrompt({
        directions: params.directions.map((direction) => {
          const graphNodeMap = new Map(params.graph.nodes.map((node) => [node.id, node]));
          return {
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
          };
        }),
      }),
      temperature: 0.15,
      timeout: GROWTH_DIRECTION_METADATA_AI_TIMEOUT_MS,
    });

    const validated = validateMetadataOutput({
      output: result.output,
      requestedDirections: params.directions,
    });

    if (params.recordUsage !== false) {
      await recordAIUsage({
        ...telemetry,
        usage: result.usage,
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
