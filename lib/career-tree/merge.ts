import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  careerCourseSkillEvidence,
  careerGenerationRuns,
  careerUserSkillEdges,
  careerUserSkillNodeEvidence,
  careerUserSkillNodes,
  db,
} from "@/db";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { generateStructuredObject } from "@/lib/ai/core/structured-output";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import {
  CAREER_TREE_MERGE_PROMPT_VERSION,
  CAREER_TREE_MERGE_TIMEOUT_MS,
  MAX_CAREER_MERGE_EDGES_PER_COURSE,
  MAX_CAREER_NEW_NODES_PER_COURSE,
} from "@/lib/career-tree/constants";
import { bumpCareerGraphState } from "@/lib/career-tree/graph-state";
import {
  CAREER_TREE_MERGE_MODEL_CANDIDATES,
  getCareerTreeRunModelName,
} from "@/lib/career-tree/model-candidates";
import {
  logCareerTreePipelineEvent,
  logCareerTreePipelineSkip,
} from "@/lib/career-tree/pipeline-log";
import { enqueueCareerTreeCompose } from "@/lib/career-tree/queue";
import {
  type CareerRunFailureOptions,
  getCareerRunById,
  getLatestSucceededCareerRun,
  getOrCreateCareerRun,
  markCareerRunFailed,
  markCareerRunSucceeded,
} from "@/lib/career-tree/runs";
import { recomputeCareerNodeAggregates } from "./aggregation";

const mergeDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("attach"),
    targetNodeId: z.string().trim().min(1),
    evidenceIds: z.array(z.string().uuid()).min(1),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1),
  }),
  z.object({
    action: z.literal("create"),
    tempNodeRef: z.string().trim().min(1).optional(),
    newNode: z.object({
      canonicalLabel: z.string().trim().min(1),
      summary: z.string().trim().min(1).nullable().optional(),
      kind: z.enum(["skill", "theme", "cluster"]).default("skill"),
    }),
    evidenceIds: z.array(z.string().uuid()).min(1),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1),
  }),
]);

const edgeDecisionSchema = z.object({
  type: z.enum(["prerequisite", "related", "supports"]),
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
});

export const careerMergePlannerOutputSchema = z.object({
  decisions: z.array(mergeDecisionSchema),
  edgeDecisions: z.array(edgeDecisionSchema).default([]),
});

type CareerMergePlannerOutput = z.infer<typeof careerMergePlannerOutputSchema>;
type ValidatedCareerMerge = ReturnType<typeof validateCareerMergePlan>;
type CareerMergeTransaction = Pick<typeof db, "delete" | "insert" | "select" | "update">;
type MergeDecision = CareerMergePlannerOutput["decisions"][number];
type MergeEdgeDecision = CareerMergePlannerOutput["edgeDecisions"][number];
type NormalizedCreateDecision = Extract<MergeDecision, { action: "create" }> & {
  tempNodeRef: string;
};
type NormalizedMergeDecision =
  | Extract<MergeDecision, { action: "attach" }>
  | NormalizedCreateDecision;
type NormalizedMergeEdgeDecision = MergeEdgeDecision & {
  from: string;
  to: string;
};

function buildMergeContext(params: {
  existingNodes: Array<typeof careerUserSkillNodes.$inferSelect>;
  existingEdges: Array<typeof careerUserSkillEdges.$inferSelect>;
  evidenceRows: Array<typeof careerCourseSkillEvidence.$inferSelect>;
}): string {
  return JSON.stringify(
    {
      existingNodes: params.existingNodes.map((node) => ({
        id: node.id,
        canonicalLabel: node.canonicalLabel,
        displayHint: node.displayHint,
        summary: node.summary,
        kind: node.kind,
        state: node.state,
        progress: node.progress,
        evidenceScore: node.evidenceScore,
        courseCount: node.courseCount,
        chapterCount: node.chapterCount,
      })),
      existingEdges: params.existingEdges.map((edge) => ({
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        edgeType: edge.edgeType,
        confidence: Number(edge.confidence),
      })),
      newCourseEvidence: params.evidenceRows.map((row) => ({
        id: row.id,
        title: row.title,
        kind: row.kind,
        summary: row.summary,
        confidence: Number(row.confidence),
        chapterRefs: row.chapterRefs,
        prerequisiteHints: row.prerequisiteHints,
        relatedHints: row.relatedHints,
        evidenceSnippets: row.evidenceSnippets,
      })),
    },
    null,
    2,
  );
}

async function planCareerMerge(params: {
  userId: string;
  courseId: string;
  existingNodes: Array<typeof careerUserSkillNodes.$inferSelect>;
  existingEdges: Array<typeof careerUserSkillEdges.$inferSelect>;
  evidenceRows: Array<typeof careerCourseSkillEvidence.$inferSelect>;
}): Promise<CareerMergePlannerOutput> {
  let lastError: unknown = null;

  for (const [index, candidate] of CAREER_TREE_MERGE_MODEL_CANDIDATES.entries()) {
    const telemetry = createTelemetryContext({
      endpoint: "career-tree:merge",
      intent: "career-tree-merge",
      workflow: "career-tree",
      modelPolicy: "extract-fast",
      modelSeries: candidate.modelSeries,
      promptVersion: CAREER_TREE_MERGE_PROMPT_VERSION,
      userId: params.userId,
      metadata: {
        courseId: params.courseId,
        nodeCount: params.existingNodes.length,
        evidenceCount: params.evidenceRows.length,
        candidate: candidate.label,
        fallbackAttempt: index,
      },
    });

    const attemptStartedAt = Date.now();
    try {
      const result = await generateStructuredObject({
        model: getPlainModelForPolicy("extract-fast", {
          modelSeries: candidate.modelSeries,
        }),
        schema: careerMergePlannerOutputSchema,
        name: "careerMergePlan",
        description: "课程证据合并到用户职业技能图谱的计划",
        prompt: renderPromptResource("career-tree/merge.md", {
          merge_context: buildMergeContext(params),
        }),
        ...buildGenerationSettingsForPolicy(
          "extract-fast",
          {
            temperature: 0.1,
            maxOutputTokens: 4_000,
          },
          {
            modelSeries: candidate.modelSeries,
          },
        ),
        timeout: CAREER_TREE_MERGE_TIMEOUT_MS,
      });

      await recordAIUsage({
        ...telemetry,
        usage: result.usage,
        durationMs: Date.now() - attemptStartedAt,
        success: true,
      });

      return result.output;
    } catch (error) {
      lastError = error;
      await recordAIUsage({
        ...telemetry,
        durationMs: Date.now() - attemptStartedAt,
        success: false,
        errorMessage: getErrorMessage(error),
      });
    }
  }

  throw lastError ?? new Error("Career merge planning failed without an error");
}

function createTempNodeRef(decisionIndex: number, evidenceIds: string[]): string {
  return `new:${decisionIndex}:${evidenceIds[0]}`;
}

function hasPrerequisitePath(
  adjacency: Map<string, Set<string>>,
  from: string,
  to: string,
): boolean {
  const stack = [from];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }

    if (current === to) {
      return true;
    }

    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }

  return false;
}

function resolvePlannedNodeRef(params: {
  ref: string;
  allowedTargetNodeIds: Set<string>;
  createRefsByAlias: Map<string, string>;
}): string | null {
  if (params.allowedTargetNodeIds.has(params.ref)) {
    return params.ref;
  }

  return params.createRefsByAlias.get(params.ref) ?? null;
}

function validateCareerMergePlan(params: {
  output: CareerMergePlannerOutput;
  allowedTargetNodeIds: Set<string>;
  allowedEvidenceIds: Set<string>;
  existingPrerequisiteEdges: Array<{ fromNodeId: string; toNodeId: string }>;
}) {
  const validDecisions: NormalizedMergeDecision[] = [];
  let createdCount = 0;
  const createRefsByAlias = new Map<string, string>();

  for (const [index, decision] of params.output.decisions.entries()) {
    if (decision.action !== "create") {
      continue;
    }

    const evidenceIdsValid = decision.evidenceIds.every((id) => params.allowedEvidenceIds.has(id));
    if (!evidenceIdsValid) {
      continue;
    }

    if (createdCount >= MAX_CAREER_NEW_NODES_PER_COURSE) {
      continue;
    }

    const tempNodeRef = decision.tempNodeRef ?? createTempNodeRef(index, decision.evidenceIds);
    createdCount += 1;
    createRefsByAlias.set(tempNodeRef, tempNodeRef);
    createRefsByAlias.set(decision.newNode.canonicalLabel.trim(), tempNodeRef);
    validDecisions.push({
      ...decision,
      tempNodeRef,
    });
  }

  for (const decision of params.output.decisions) {
    if (decision.action !== "attach") {
      continue;
    }

    const evidenceIdsValid = decision.evidenceIds.every((id) => params.allowedEvidenceIds.has(id));
    if (!evidenceIdsValid) {
      continue;
    }

    const targetNodeId = resolvePlannedNodeRef({
      ref: decision.targetNodeId,
      allowedTargetNodeIds: params.allowedTargetNodeIds,
      createRefsByAlias,
    });
    if (!targetNodeId) {
      continue;
    }

    validDecisions.push({
      ...decision,
      targetNodeId,
    });
  }

  const prerequisiteAdjacency = new Map<string, Set<string>>();

  for (const edge of params.existingPrerequisiteEdges) {
    const next = prerequisiteAdjacency.get(edge.fromNodeId) ?? new Set<string>();
    next.add(edge.toNodeId);
    prerequisiteAdjacency.set(edge.fromNodeId, next);
  }

  const validEdges: NormalizedMergeEdgeDecision[] = [];
  for (const edge of params.output.edgeDecisions) {
    if (validEdges.length >= MAX_CAREER_MERGE_EDGES_PER_COURSE) {
      break;
    }

    const from = resolvePlannedNodeRef({
      ref: edge.from,
      allowedTargetNodeIds: params.allowedTargetNodeIds,
      createRefsByAlias,
    });
    const to = resolvePlannedNodeRef({
      ref: edge.to,
      allowedTargetNodeIds: params.allowedTargetNodeIds,
      createRefsByAlias,
    });

    if (!from || !to || from === to) {
      continue;
    }

    if (edge.type === "prerequisite") {
      if (hasPrerequisitePath(prerequisiteAdjacency, to, from)) {
        continue;
      }

      const next = prerequisiteAdjacency.get(from) ?? new Set<string>();
      next.add(to);
      prerequisiteAdjacency.set(from, next);
    }

    validEdges.push({
      ...edge,
      from,
      to,
    });
  }

  return {
    decisions: validDecisions,
    edgeDecisions: validEdges,
  };
}

async function listPriorCareerCourseMergeRunIds(params: {
  userId: string;
  courseId: string;
}): Promise<string[]> {
  const rows = await db
    .select({ id: careerGenerationRuns.id })
    .from(careerGenerationRuns)
    .where(
      and(
        eq(careerGenerationRuns.userId, params.userId),
        eq(careerGenerationRuns.courseId, params.courseId),
        eq(careerGenerationRuns.kind, "merge"),
      ),
    );

  return rows.map((row) => row.id);
}

async function applyCareerMerge(params: {
  tx: CareerMergeTransaction;
  userId: string;
  courseId: string;
  mergeRunId: string;
  validated: ValidatedCareerMerge;
  priorMergeRunIds: string[];
}) {
  const staleLinks = await params.tx
    .select({
      id: careerUserSkillNodeEvidence.id,
      nodeId: careerUserSkillNodeEvidence.nodeId,
    })
    .from(careerUserSkillNodeEvidence)
    .innerJoin(
      careerCourseSkillEvidence,
      eq(careerUserSkillNodeEvidence.courseSkillEvidenceId, careerCourseSkillEvidence.id),
    )
    .where(
      and(
        eq(careerUserSkillNodeEvidence.userId, params.userId),
        eq(careerCourseSkillEvidence.courseId, params.courseId),
      ),
    );

  if (staleLinks.length > 0) {
    await params.tx.delete(careerUserSkillNodeEvidence).where(
      inArray(
        careerUserSkillNodeEvidence.id,
        staleLinks.map((row) => row.id),
      ),
    );
  }

  if (params.priorMergeRunIds.length > 0) {
    await params.tx
      .delete(careerUserSkillEdges)
      .where(inArray(careerUserSkillEdges.sourceMergeRunId, params.priorMergeRunIds));
  }

  const tempNodeRefMap = new Map<string, string>();
  const touchedNodeIds = new Set(staleLinks.map((row) => row.nodeId));

  for (const decision of params.validated.decisions) {
    if (decision.action === "attach") {
      const nodeId = tempNodeRefMap.get(decision.targetNodeId) ?? decision.targetNodeId;
      touchedNodeIds.add(nodeId);
      await params.tx
        .insert(careerUserSkillNodeEvidence)
        .values(
          decision.evidenceIds.map((evidenceId) => ({
            userId: params.userId,
            nodeId,
            courseSkillEvidenceId: evidenceId,
            mergeRunId: params.mergeRunId,
            weight: decision.confidence.toFixed(3),
          })),
        )
        .onConflictDoNothing();
      continue;
    }

    const [createdNode] = await params.tx
      .insert(careerUserSkillNodes)
      .values({
        userId: params.userId,
        canonicalLabel: decision.newNode.canonicalLabel,
        displayHint: null,
        summary: decision.newNode.summary ?? null,
        kind: decision.newNode.kind,
        state: "ready",
        progress: 0,
        masteryScore: 0,
        evidenceScore: 0,
        courseCount: 0,
        chapterCount: 0,
        lastMergedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: careerUserSkillNodes.id });

    tempNodeRefMap.set(decision.tempNodeRef, createdNode.id);
    touchedNodeIds.add(createdNode.id);

    await params.tx.insert(careerUserSkillNodeEvidence).values(
      decision.evidenceIds.map((evidenceId) => ({
        userId: params.userId,
        nodeId: createdNode.id,
        courseSkillEvidenceId: evidenceId,
        mergeRunId: params.mergeRunId,
        weight: decision.confidence.toFixed(3),
      })),
    );
  }

  const resolvedEdges = params.validated.edgeDecisions
    .map((edge) => ({
      fromNodeId: tempNodeRefMap.get(edge.from) ?? edge.from,
      toNodeId: tempNodeRefMap.get(edge.to) ?? edge.to,
      edgeType: edge.type,
      confidence: edge.confidence,
    }))
    .filter((edge) => edge.fromNodeId !== edge.toNodeId);

  if (resolvedEdges.length > 0) {
    await params.tx
      .insert(careerUserSkillEdges)
      .values(
        resolvedEdges.map((edge) => ({
          userId: params.userId,
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
          edgeType: edge.edgeType,
          confidence: edge.confidence.toFixed(3),
          sourceMergeRunId: params.mergeRunId,
        })),
      )
      .onConflictDoNothing();

    for (const edge of resolvedEdges) {
      touchedNodeIds.add(edge.fromNodeId);
      touchedNodeIds.add(edge.toNodeId);
    }
  }

  await bumpCareerGraphState(params.tx, {
    userId: params.userId,
    lastMergeRunId: params.mergeRunId,
  });
  await recomputeCareerNodeAggregates(params.tx, params.userId, [...touchedNodeIds]);
}

async function loadExtractRun(job: { userId: string; courseId: string; extractRunId?: string }) {
  if (job.extractRunId) {
    return getCareerRunById(job.extractRunId);
  }

  return getLatestSucceededCareerRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "extract",
  });
}

export async function processCareerTreeMergeJob(job: {
  userId: string;
  courseId: string;
  extractRunId?: string;
  requestKey?: string;
  enqueueFollowups?: boolean;
  failure?: CareerRunFailureOptions;
}): Promise<void> {
  logCareerTreePipelineEvent("career_tree_pipeline_started", {
    stage: "merge",
    userId: job.userId,
    courseId: job.courseId,
    requestKey: job.requestKey ?? null,
    extractRunId: job.extractRunId ?? null,
  });
  const extractRun = await loadExtractRun(job);
  if (!extractRun || extractRun.status !== "succeeded") {
    logCareerTreePipelineSkip({
      stage: "merge",
      reason: "succeeded_extract_run_missing",
      userId: job.userId,
      courseId: job.courseId,
      requestKey: job.requestKey ?? null,
      extractRunId: job.extractRunId ?? null,
      extractRunStatus: extractRun?.status ?? null,
    });
    return;
  }

  const model = getCareerTreeRunModelName("merge");
  const mergeRun = await getOrCreateCareerRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "merge",
    idempotencyKey: `merge:user:${job.userId}:course:${job.courseId}:extract_run:${extractRun.id}:prompt:${CAREER_TREE_MERGE_PROMPT_VERSION}:model:${model}`,
    inputHash: extractRun.inputHash,
    model,
    promptVersion: CAREER_TREE_MERGE_PROMPT_VERSION,
    reuseCompleted: true,
  });

  if (mergeRun.status === "succeeded") {
    logCareerTreePipelineEvent("career_tree_pipeline_succeeded", {
      stage: "merge",
      userId: job.userId,
      courseId: job.courseId,
      requestKey: job.requestKey ?? null,
      runId: mergeRun.id,
      extractRunId: extractRun.id,
      reused: true,
    });
    if (job.enqueueFollowups !== false) {
      await enqueueCareerTreeCompose(job.userId, job.requestKey);
    }
    return;
  }

  const [existingNodes, existingEdges, evidenceRows] = await Promise.all([
    db.select().from(careerUserSkillNodes).where(eq(careerUserSkillNodes.userId, job.userId)),
    db.select().from(careerUserSkillEdges).where(eq(careerUserSkillEdges.userId, job.userId)),
    db
      .select()
      .from(careerCourseSkillEvidence)
      .where(eq(careerCourseSkillEvidence.extractRunId, extractRun.id)),
  ]);

  if (evidenceRows.length === 0) {
    logCareerTreePipelineSkip({
      stage: "merge",
      reason: "extract_run_has_no_evidence",
      userId: job.userId,
      courseId: job.courseId,
      requestKey: job.requestKey ?? null,
      runId: mergeRun.id,
      extractRunId: extractRun.id,
    });
    return;
  }

  try {
    const planned = await planCareerMerge({
      userId: job.userId,
      courseId: job.courseId,
      existingNodes,
      existingEdges,
      evidenceRows,
    });
    const validated = validateCareerMergePlan({
      output: planned,
      allowedTargetNodeIds: new Set(existingNodes.map((node) => node.id)),
      allowedEvidenceIds: new Set(evidenceRows.map((row) => row.id)),
      existingPrerequisiteEdges: existingEdges
        .filter((edge) => edge.edgeType === "prerequisite")
        .map((edge) => ({
          fromNodeId: edge.fromNodeId,
          toNodeId: edge.toNodeId,
        })),
    });

    if (validated.decisions.length === 0) {
      throw new Error("Career merge planner produced no valid decisions");
    }

    const priorMergeRunIds = await listPriorCareerCourseMergeRunIds({
      userId: job.userId,
      courseId: job.courseId,
    });

    await db.transaction(async (tx) => {
      await applyCareerMerge({
        tx,
        userId: job.userId,
        courseId: job.courseId,
        mergeRunId: mergeRun.id,
        validated,
        priorMergeRunIds,
      });
      await markCareerRunSucceeded(tx, mergeRun.id, validated);
    });
    logCareerTreePipelineEvent("career_tree_pipeline_succeeded", {
      stage: "merge",
      userId: job.userId,
      courseId: job.courseId,
      requestKey: job.requestKey ?? null,
      runId: mergeRun.id,
      extractRunId: extractRun.id,
      reused: false,
      evidenceCount: evidenceRows.length,
      decisionCount: validated.decisions.length,
      edgeCount: validated.edgeDecisions.length,
    });

    if (job.enqueueFollowups !== false) {
      await enqueueCareerTreeCompose(job.userId, job.requestKey);
    }
  } catch (error) {
    await markCareerRunFailed(mergeRun.id, error, job.failure);
    throw error;
  }
}
