import { generateText, Output } from "ai";
import { z } from "zod";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import {
  type ComposeGraph,
  type ComposePreference,
  type ComposePreviousSummary,
  normalizeText,
  slugify,
} from "@/lib/growth/compose-shared";
import {
  GROWTH_COMPOSE_PLANNER_MODEL_LABEL,
  GROWTH_DIRECTION_PLANNER_AI_TIMEOUT_MS,
} from "@/lib/growth/constants";
import { buildGrowthComposePrompt, GROWTH_COMPOSE_SYSTEM_PROMPT } from "@/lib/growth/prompts";

const plannerDirectionSchema = z.object({
  matchPreviousDirectionKey: z.string().trim().min(1).optional(),
  keySeed: z.string().trim().min(1),
  supportingNodeRefs: z.array(z.string().trim().min(1)).min(1),
});

const directionPlannerOutputSchema = z.object({
  recommendedDirectionIndex: z.number().int().nonnegative(),
  directions: z.array(plannerDirectionSchema).min(1).max(5),
});

export interface DirectionCountGuidance {
  min: number;
  max: number;
  signalStrength: "weak" | "mixed" | "strong";
}

export interface GrowthDirectionPlan {
  matchPreviousDirectionKey?: string;
  keySeed: string;
  supportingNodeRefs: string[];
}

export interface GrowthDirectionPlannerResult {
  recommendedDirectionIndex: number;
  directions: GrowthDirectionPlan[];
  guidance: DirectionCountGuidance;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

export function deriveDirectionCountGuidance(graph: ComposeGraph): DirectionCountGuidance {
  const strongNodes = graph.nodes.filter(
    (node) => node.progress >= 60 || node.evidenceScore >= 60,
  ).length;
  const activeNodes = graph.nodes.filter(
    (node) => node.progress >= 30 || node.evidenceScore >= 40,
  ).length;

  if (graph.nodes.length <= 2 || activeNodes <= 2) {
    return { min: 1, max: Math.min(2, graph.nodes.length), signalStrength: "weak" };
  }

  if (graph.nodes.length >= 6 && strongNodes >= 3) {
    return { min: 3, max: Math.min(5, graph.nodes.length), signalStrength: "strong" };
  }

  if (graph.nodes.length >= 4 && strongNodes >= 2) {
    return { min: 2, max: Math.min(4, graph.nodes.length), signalStrength: "strong" };
  }

  return { min: 1, max: Math.min(3, graph.nodes.length), signalStrength: "mixed" };
}

function validatePlannerOutput(params: {
  output: unknown;
  graph: ComposeGraph;
  previousSummary: ComposePreviousSummary;
  guidance: DirectionCountGuidance;
}): GrowthDirectionPlannerResult {
  const parsed = directionPlannerOutputSchema.parse(params.output);
  const graphNodeIds = new Set(params.graph.nodes.map((node) => node.id));
  const previousDirectionKeys = new Set(
    params.previousSummary.trees.map((tree) => tree.directionKey),
  );

  if (parsed.recommendedDirectionIndex >= parsed.directions.length) {
    throw new Error(
      `Growth compose planner returned out-of-range recommendedDirectionIndex: ${parsed.recommendedDirectionIndex}`,
    );
  }

  if (
    parsed.directions.length < params.guidance.min ||
    parsed.directions.length > params.guidance.max
  ) {
    throw new Error(
      `Growth compose planner returned ${parsed.directions.length} directions outside guidance ${params.guidance.min}-${params.guidance.max}`,
    );
  }

  const seenKeySeeds = new Set<string>();
  const seenSupportFingerprints = new Set<string>();

  const directions = parsed.directions.map((direction) => {
    const keySeed = slugify(direction.keySeed);
    const normalizedKeySeed = normalizeText(keySeed);
    if (!normalizedKeySeed) {
      throw new Error("Growth compose planner returned empty keySeed");
    }
    if (seenKeySeeds.has(normalizedKeySeed)) {
      throw new Error(`Growth compose planner returned duplicate keySeed: ${keySeed}`);
    }
    seenKeySeeds.add(normalizedKeySeed);

    if (
      direction.matchPreviousDirectionKey &&
      !previousDirectionKeys.has(direction.matchPreviousDirectionKey)
    ) {
      throw new Error(
        `Growth compose planner returned unknown previous direction match: ${direction.matchPreviousDirectionKey}`,
      );
    }

    const supportingNodeRefs = uniqueValues(direction.supportingNodeRefs);
    if (supportingNodeRefs.length === 0) {
      throw new Error(`Growth compose planner returned empty support set for ${keySeed}`);
    }

    for (const ref of supportingNodeRefs) {
      if (!graphNodeIds.has(ref)) {
        throw new Error(`Growth compose planner returned unknown supporting node ref: ${ref}`);
      }
    }

    const supportFingerprint = [...supportingNodeRefs]
      .sort((left, right) => left.localeCompare(right, "en"))
      .join("|");
    if (seenSupportFingerprints.has(supportFingerprint)) {
      throw new Error(`Growth compose planner returned duplicate support set for ${keySeed}`);
    }
    seenSupportFingerprints.add(supportFingerprint);

    return {
      keySeed,
      supportingNodeRefs,
      matchPreviousDirectionKey: direction.matchPreviousDirectionKey,
    };
  });

  return {
    recommendedDirectionIndex: parsed.recommendedDirectionIndex,
    directions,
    guidance: params.guidance,
  };
}

export async function planGrowthDirections(params: {
  userId: string;
  graph: ComposeGraph;
  preference: ComposePreference;
  previousSummary: ComposePreviousSummary;
  recordUsage?: boolean;
}): Promise<GrowthDirectionPlannerResult> {
  const guidance = deriveDirectionCountGuidance(params.graph);
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "growth:compose:plan",
    intent: "growth-compose-plan",
    workflow: "growth",
    modelPolicy: "outline-architect",
    promptVersion: "growth-compose-plan@v1",
    userId: params.userId,
    metadata: {
      nodeCount: params.graph.nodes.length,
      edgeCount: params.graph.prerequisiteEdges.length,
      previousTreeCount: params.previousSummary.trees.length,
      guidance,
    },
  });

  try {
    const result = await generateText({
      model: getPlainModelForPolicy("outline-architect"),
      output: Output.object({ schema: directionPlannerOutputSchema }),
      system: GROWTH_COMPOSE_SYSTEM_PROMPT,
      prompt: buildGrowthComposePrompt({
        graph: params.graph,
        preference: params.preference,
        previousSummary: params.previousSummary,
        directionCountGuidance: guidance,
      }),
      ...buildGenerationSettingsForPolicy("outline-architect", {
        temperature: 0.1,
      }),
      timeout: GROWTH_DIRECTION_PLANNER_AI_TIMEOUT_MS,
    });

    const validated = validatePlannerOutput({
      output: result.output,
      graph: params.graph,
      previousSummary: params.previousSummary,
      guidance,
    });

    if (params.recordUsage !== false) {
      await recordAIUsage({
        ...telemetry,
        usage: result.usage,
        durationMs: Date.now() - startedAt,
        success: true,
        metadata: {
          ...telemetry.metadata,
          model: GROWTH_COMPOSE_PLANNER_MODEL_LABEL,
          directionCount: validated.directions.length,
          recommendedDirectionIndex: validated.recommendedDirectionIndex,
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
          model: GROWTH_COMPOSE_PLANNER_MODEL_LABEL,
        },
      });
    }
    throw error;
  }
}
