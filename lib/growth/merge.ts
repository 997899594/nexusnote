import { generateText, Output } from "ai";
import { z } from "zod";
import {
  createTelemetryContext,
  getErrorMessage,
  getJsonModelForPolicy,
  recordAIUsage,
} from "@/lib/ai/core";
import {
  GROWTH_STRUCTURED_AI_TIMEOUT_MS,
  IN_PROGRESS_THRESHOLD,
  MASTERED_EVIDENCE_THRESHOLD,
  MASTERED_PROGRESS_THRESHOLD,
  READY_PREREQ_PROGRESS_THRESHOLD,
} from "@/lib/growth/constants";
import { buildGrowthMergePrompt, GROWTH_MERGE_SYSTEM_PROMPT } from "@/lib/growth/prompts";

export const mergeDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("attach"),
    targetNodeId: z.string(),
    evidenceIds: z.array(z.string()).min(1),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
  }),
  z.object({
    action: z.literal("create"),
    tempNodeRef: z.string().min(1),
    newNode: z.object({
      canonicalLabel: z.string().min(1),
      summary: z.string().nullable().optional(),
    }),
    evidenceIds: z.array(z.string()).min(1),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
  }),
]);

export const prerequisiteEdgeDecisionSchema = z.object({
  from: z.string(),
  to: z.string(),
  confidence: z.number().min(0).max(1),
});

export const mergePlannerOutputSchema = z.object({
  decisions: z.array(mergeDecisionSchema),
  prerequisiteEdges: z.array(prerequisiteEdgeDecisionSchema).default([]),
});

export type MergePlannerOutput = z.infer<typeof mergePlannerOutputSchema>;

export async function planGrowthGraphMerge(params: {
  userId: string;
  courseId: string;
  candidateContext: unknown;
  evidenceBatch: unknown;
  priorCourseSummary: unknown;
}): Promise<MergePlannerOutput> {
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "growth:merge",
    intent: "growth-merge",
    workflow: "growth",
    modelPolicy: "structured-high-quality",
    promptVersion: "growth-merge@v1",
    userId: params.userId,
    metadata: {
      courseId: params.courseId,
    },
  });

  try {
    const result = await generateText({
      model: getJsonModelForPolicy("structured-high-quality"),
      output: Output.object({ schema: mergePlannerOutputSchema }),
      system: GROWTH_MERGE_SYSTEM_PROMPT,
      prompt: buildGrowthMergePrompt({
        candidateContext: params.candidateContext,
        evidenceBatch: params.evidenceBatch,
        priorCourseSummary: params.priorCourseSummary,
      }),
      temperature: 0.1,
      timeout: GROWTH_STRUCTURED_AI_TIMEOUT_MS,
    });

    await recordAIUsage({
      ...telemetry,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return result.output;
  } catch (error) {
    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
}

export interface AggregationInput {
  chapterCompletionRatios: Array<{ ratio: number; confidence: number }>;
  fallbackCourseProgressRatios: Array<{ ratio: number; confidence: number }>;
  courseCount: number;
  chapterCount: number;
  repeatedEvidenceCount: number;
  prerequisiteProgresses: number[];
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeProgress(input: AggregationInput): number {
  const sources =
    input.chapterCompletionRatios.length > 0
      ? input.chapterCompletionRatios
      : input.fallbackCourseProgressRatios;

  if (sources.length === 0) {
    return 0;
  }

  const totalWeight = sources.reduce((sum, item) => sum + item.confidence, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  const weightedValue = sources.reduce((sum, item) => sum + item.ratio * item.confidence, 0);
  return clampPercent(weightedValue / totalWeight);
}

export function computeEvidenceScore(input: AggregationInput): number {
  const support =
    input.chapterCompletionRatios.reduce((sum, item) => sum + item.confidence * 20, 0) +
    input.fallbackCourseProgressRatios.reduce((sum, item) => sum + item.confidence * 10, 0);
  return clampPercent(Math.min(100, support));
}

export function computeMasteryScore(progress: number, input: AggregationInput): number {
  return clampPercent(
    progress * 0.7 +
      Math.min(20, input.courseCount * 5) +
      Math.min(10, input.repeatedEvidenceCount * 2),
  );
}

export function resolveGrowthNodeState(
  progress: number,
  evidenceScore: number,
  prerequisiteProgresses: number[],
): "mastered" | "in_progress" | "ready" | "locked" {
  if (progress >= MASTERED_PROGRESS_THRESHOLD && evidenceScore >= MASTERED_EVIDENCE_THRESHOLD) {
    return "mastered";
  }

  if (progress >= IN_PROGRESS_THRESHOLD) {
    return "in_progress";
  }

  const allPrerequisitesReady =
    prerequisiteProgresses.length === 0 ||
    prerequisiteProgresses.every((value) => value >= READY_PREREQ_PROGRESS_THRESHOLD);

  return allPrerequisitesReady ? "ready" : "locked";
}

export function validateMergePlannerOutput(params: {
  output: MergePlannerOutput;
  allowedTargetNodeIds: Set<string>;
  allowedEvidenceIds: Set<string>;
  maxNewNodes?: number;
  maxEdges?: number;
}): MergePlannerOutput {
  const maxNewNodes = params.maxNewNodes ?? 20;
  const maxEdges = params.maxEdges ?? 40;

  let createdCount = 0;
  const validDecisions = params.output.decisions.filter((decision) => {
    const evidenceIdsValid = decision.evidenceIds.every((id) => params.allowedEvidenceIds.has(id));
    if (!evidenceIdsValid) {
      return false;
    }

    if (decision.action === "attach") {
      return params.allowedTargetNodeIds.has(decision.targetNodeId);
    }

    createdCount += 1;
    return createdCount <= maxNewNodes;
  });

  const validEdges = params.output.prerequisiteEdges
    .filter((edge) => edge.from !== edge.to)
    .slice(0, maxEdges);

  return {
    decisions: validDecisions,
    prerequisiteEdges: filterCyclicEdges(validEdges),
  };
}

function filterCyclicEdges(
  edges: Array<{ from: string; to: string; confidence: number }>,
): Array<{ from: string; to: string; confidence: number }> {
  const accepted: Array<{ from: string; to: string; confidence: number }> = [];
  const adjacency = new Map<string, Set<string>>();

  function createsCycle(from: string, to: string): boolean {
    const stack = [to];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) {
        continue;
      }

      if (current === from) {
        return true;
      }

      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        stack.push(next);
      }
    }

    return false;
  }

  for (const edge of edges) {
    if (createsCycle(edge.from, edge.to)) {
      continue;
    }

    accepted.push(edge);
    const next = adjacency.get(edge.from) ?? new Set<string>();
    next.add(edge.to);
    adjacency.set(edge.from, next);
  }

  return accepted;
}
