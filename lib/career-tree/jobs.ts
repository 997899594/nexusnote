import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  careerGenerationRuns,
  careerUserGraphState,
  careerUserSkillEdges,
  careerUserSkillNodeEvidence,
  careerUserSkillNodes,
  careerUserTreeSnapshots,
  courseProgress,
  courses,
  db,
  knowledgeEvidence,
  knowledgeEvidenceSourceLinks,
  knowledgeInsights,
  userFocusSnapshots,
  userProfileSnapshots,
} from "@/db";
import { revalidateGoldenPath } from "@/lib/cache/tags";
import {
  type ComposerVisibleNode,
  composeCareerTrees,
  resolveDirectionKeys,
  treeComposerOutputSchema,
} from "@/lib/career-tree/compose";
import { CAREER_TREE_SCHEMA_VERSION } from "@/lib/career-tree/constants";
import {
  buildCareerCourseExtractionInput,
  buildCareerExtractionIdempotencyKey,
  extractCareerCourseEvidence,
} from "@/lib/career-tree/extract";
import {
  type AggregationInput,
  computeEvidenceScore,
  computeMasteryScore,
  computeProgress,
  planCareerGraphMerge,
  resolveCareerNodeState,
  validateMergePlannerOutput,
} from "@/lib/career-tree/merge";
import {
  computeCareerOutlineHash,
  type NormalizedCareerOutline,
  normalizeCareerOutline,
} from "@/lib/career-tree/normalize-outline";
import { getCareerTreePreference } from "@/lib/career-tree/preferences";
import {
  enqueueCareerTreeCompose,
  enqueueCareerTreeMerge,
  enqueueCareerTreeRefresh,
  enqueueKnowledgeInsights,
} from "@/lib/career-tree/queue";
import { retrieveMergeCandidateSet } from "@/lib/career-tree/retrieve-merge-candidates";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import {
  aggregateCourseEventsToKnowledgeEvidence,
  listLinkedNodeIdsForEvidenceSource,
} from "@/lib/knowledge/evidence";
import type { CareerTreeJobData } from "@/lib/queue/career-tree-queue";

type JobPayload<T extends CareerTreeJobData["type"]> = Extract<CareerTreeJobData, { type: T }>;

interface CourseRow {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  outlineData: unknown;
}

interface EvidenceMergeRow {
  id: string;
  title: string;
  summary: string;
  confidence: string;
  sourceVersionHash: string | null;
}

type CareerTreeExecutor = Pick<typeof db, "select" | "update">;

async function getCourseForCareerTree(userId: string, courseId: string): Promise<CourseRow | null> {
  const [course] = await db
    .select({
      id: courses.id,
      userId: courses.userId,
      title: courses.title,
      description: courses.description,
      outlineData: courses.outlineData,
    })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1);

  return course ?? null;
}

function buildSourceVersionCondition<T>(field: T, sourceVersionHash: string | null | undefined) {
  if (sourceVersionHash === undefined) {
    return undefined;
  }

  return sourceVersionHash === null
    ? isNull(field as never)
    : eq(field as never, sourceVersionHash);
}

async function loadSourceEvidenceRows(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
}): Promise<EvidenceMergeRow[]> {
  return db
    .select({
      id: knowledgeEvidence.id,
      title: knowledgeEvidence.title,
      summary: knowledgeEvidence.summary,
      confidence: knowledgeEvidence.confidence,
      sourceVersionHash: knowledgeEvidence.sourceVersionHash,
    })
    .from(knowledgeEvidence)
    .where(
      and(
        eq(knowledgeEvidence.userId, params.userId),
        eq(knowledgeEvidence.sourceType, params.sourceType),
        eq(knowledgeEvidence.sourceId, params.sourceId),
        buildSourceVersionCondition(knowledgeEvidence.sourceVersionHash, params.sourceVersionHash),
      ),
    );
}

async function loadEvidenceRefs(evidenceIds: string[]) {
  if (evidenceIds.length === 0) {
    return [];
  }

  return db
    .select({
      evidenceId: knowledgeEvidenceSourceLinks.evidenceId,
      refType: knowledgeEvidenceSourceLinks.refType,
      refId: knowledgeEvidenceSourceLinks.refId,
      snippet: knowledgeEvidenceSourceLinks.snippet,
    })
    .from(knowledgeEvidenceSourceLinks)
    .where(inArray(knowledgeEvidenceSourceLinks.evidenceId, evidenceIds));
}

function computeEvidenceBatchHash(rows: EvidenceMergeRow[]): string {
  return createHash("sha256")
    .update(
      rows
        .map(
          (row) =>
            `${row.id}:${row.title}:${row.summary}:${row.confidence}:${row.sourceVersionHash ?? ""}`,
        )
        .join("|"),
    )
    .digest("hex");
}

async function getOrCreateRun(params: {
  userId: string;
  courseId?: string;
  kind: "extract" | "merge" | "compose" | "refresh";
  idempotencyKey: string;
  inputHash: string;
  model: string;
  promptVersion: string;
}) {
  const [created] = await db
    .insert(careerGenerationRuns)
    .values({
      userId: params.userId,
      courseId: params.courseId,
      kind: params.kind,
      status: "running",
      idempotencyKey: params.idempotencyKey,
      model: params.model,
      promptVersion: params.promptVersion,
      inputHash: params.inputHash,
      startedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const existing = await db.query.careerGenerationRuns.findFirst({
    where: eq(careerGenerationRuns.idempotencyKey, params.idempotencyKey),
  });

  if (!existing) {
    throw new Error(`Missing generation run after conflict: ${params.idempotencyKey}`);
  }

  if (existing.status !== "running") {
    await db
      .update(careerGenerationRuns)
      .set({
        status: "running",
        startedAt: new Date(),
        finishedAt: null,
        errorCode: null,
        errorMessage: null,
      })
      .where(eq(careerGenerationRuns.id, existing.id));

    return {
      ...existing,
      status: "running",
    };
  }

  return existing;
}

async function markRunSucceeded(
  executor: Pick<CareerTreeExecutor, "update">,
  runId: string,
  outputJson: unknown,
) {
  await executor
    .update(careerGenerationRuns)
    .set({
      status: "succeeded",
      outputJson,
      finishedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    })
    .where(eq(careerGenerationRuns.id, runId));
}

async function markRunFailed(runId: string, error: unknown) {
  await db
    .update(careerGenerationRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorCode: "JOB_FAILED",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    })
    .where(eq(careerGenerationRuns.id, runId));
}

function buildChapterProgressMap(
  outline: NormalizedCareerOutline,
  completedSections: string[] | null,
  completedChapters: number[] | null,
) {
  const completedSectionSet = new Set(completedSections ?? []);
  const completedChapterSet = new Set(completedChapters ?? []);
  const chapterRatios = new Map<string, number>();

  let totalSections = 0;
  let totalCompletedSections = 0;

  for (const chapter of outline.chapters) {
    if (chapter.sections.length > 0) {
      const completed = chapter.sections.filter((section) =>
        completedSectionSet.has(section.sectionKey),
      ).length;
      totalSections += chapter.sections.length;
      totalCompletedSections += completed;
      chapterRatios.set(chapter.chapterKey, (completed / chapter.sections.length) * 100);
      continue;
    }

    const chapterCompleted = completedChapterSet.has(chapter.chapterIndex);
    chapterRatios.set(chapter.chapterKey, chapterCompleted ? 100 : 0);
  }

  const courseRatio = totalSections > 0 ? (totalCompletedSections / totalSections) * 100 : 0;

  return {
    chapterRatios,
    courseRatio,
  };
}

async function recomputeNodeAggregates(
  executor: CareerTreeExecutor,
  userId: string,
  nodeIds: string[],
) {
  const uniqueNodeIds = [...new Set(nodeIds)];
  if (uniqueNodeIds.length === 0) {
    return;
  }

  for (const nodeId of uniqueNodeIds) {
    const linkedEvidenceRows = await executor
      .select({
        evidenceId: knowledgeEvidence.id,
        sourceType: knowledgeEvidence.sourceType,
        sourceId: knowledgeEvidence.sourceId,
        confidence: knowledgeEvidence.confidence,
      })
      .from(careerUserSkillNodeEvidence)
      .innerJoin(
        knowledgeEvidence,
        eq(careerUserSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
      )
      .where(eq(careerUserSkillNodeEvidence.nodeId, nodeId));

    const linkedRefs =
      linkedEvidenceRows.length > 0
        ? await db
            .select({
              evidenceId: knowledgeEvidenceSourceLinks.evidenceId,
              refType: knowledgeEvidenceSourceLinks.refType,
              refId: knowledgeEvidenceSourceLinks.refId,
            })
            .from(knowledgeEvidenceSourceLinks)
            .where(
              inArray(
                knowledgeEvidenceSourceLinks.evidenceId,
                linkedEvidenceRows.map((row) => row.evidenceId),
              ),
            )
        : [];

    const linkedCourseIds = [
      ...new Set(
        linkedEvidenceRows
          .filter((row) => row.sourceType === "course" && row.sourceId)
          .map((row) => row.sourceId as string),
      ),
    ];

    const courseRows =
      linkedCourseIds.length > 0
        ? await db
            .select({
              courseId: courses.id,
              outlineData: courses.outlineData,
              completedSections: courseProgress.completedSections,
              completedChapters: courseProgress.completedChapters,
            })
            .from(courses)
            .leftJoin(
              courseProgress,
              and(eq(courseProgress.courseId, courses.id), eq(courseProgress.userId, userId)),
            )
            .where(inArray(courses.id, linkedCourseIds))
        : [];

    const courseRowById = new Map(courseRows.map((row) => [row.courseId, row]));

    const chapterCompletionRatios: AggregationInput["chapterCompletionRatios"] = [];
    const fallbackCourseProgressRatios: AggregationInput["fallbackCourseProgressRatios"] = [];
    const courseIds = new Set<string>();
    const chapterKeys = new Set<string>();

    for (const row of linkedEvidenceRows) {
      if (row.sourceType !== "course" || !row.sourceId) {
        continue;
      }

      const courseRow = courseRowById.get(row.sourceId);
      if (!courseRow) {
        continue;
      }

      courseIds.add(row.sourceId);
      const outline = normalizeCareerOutline(courseRow.outlineData);
      const progressMap = buildChapterProgressMap(
        outline,
        courseRow.completedSections ?? [],
        courseRow.completedChapters ?? [],
      );
      const confidence = Number(row.confidence);
      const rowChapterKeys = linkedRefs
        .filter((ref) => ref.evidenceId === row.evidenceId && ref.refType === "chapter")
        .map((ref) => ref.refId);

      if (rowChapterKeys.length > 0) {
        for (const chapterKey of rowChapterKeys) {
          chapterKeys.add(chapterKey);
          chapterCompletionRatios.push({
            ratio: progressMap.chapterRatios.get(chapterKey) ?? progressMap.courseRatio,
            confidence,
          });
        }
      } else {
        fallbackCourseProgressRatios.push({
          ratio: progressMap.courseRatio,
          confidence,
        });
      }
    }

    const prerequisiteSourceRows = await executor
      .select({
        progress: careerUserSkillNodes.progress,
      })
      .from(careerUserSkillEdges)
      .innerJoin(careerUserSkillNodes, eq(careerUserSkillEdges.fromNodeId, careerUserSkillNodes.id))
      .where(eq(careerUserSkillEdges.toNodeId, nodeId));

    const aggregationInput: AggregationInput = {
      chapterCompletionRatios,
      fallbackCourseProgressRatios,
      courseCount: courseIds.size,
      chapterCount: chapterKeys.size,
      repeatedEvidenceCount: Math.max(0, linkedEvidenceRows.length - courseIds.size),
      prerequisiteProgresses: prerequisiteSourceRows.map((row) => row.progress),
    };

    const progress = computeProgress(aggregationInput);
    const evidenceScore = computeEvidenceScore(aggregationInput);
    const masteryScore = computeMasteryScore(progress, aggregationInput);
    const state = resolveCareerNodeState(
      progress,
      evidenceScore,
      aggregationInput.prerequisiteProgresses,
    );

    await executor
      .update(careerUserSkillNodes)
      .set({
        progress,
        evidenceScore,
        masteryScore,
        state,
        courseCount: aggregationInput.courseCount,
        chapterCount: aggregationInput.chapterCount,
        updatedAt: new Date(),
        lastMergedAt: new Date(),
      })
      .where(eq(careerUserSkillNodes.id, nodeId));
  }
}

function buildComposeGraph(
  nodes: Array<typeof careerUserSkillNodes.$inferSelect>,
  edges: Array<typeof careerUserSkillEdges.$inferSelect>,
) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      canonicalLabel: node.canonicalLabel,
      summary: node.summary,
      progress: node.progress,
      state: node.state,
      courseCount: node.courseCount,
      chapterCount: node.chapterCount,
      evidenceScore: node.evidenceScore,
    })),
    prerequisiteEdges: edges.map((edge) => ({
      from: edge.fromNodeId,
      to: edge.toNodeId,
      confidence: Number(edge.confidence),
    })),
  };
}

function materializeTreeNodes(
  directionKey: string,
  nodes: ComposerVisibleNode[],
  nodeMap: Map<string, typeof careerUserSkillNodes.$inferSelect>,
  pathPrefix = "0",
): Array<import("@/lib/career-tree/types").VisibleSkillTreeNode> {
  return nodes.map((node, index) => {
    const pathIndex = `${pathPrefix}-${index}`;
    const hiddenNode = nodeMap.get(node.anchorRef);
    return {
      id: `${directionKey}:${node.anchorRef}:${pathIndex}`,
      anchorRef: node.anchorRef,
      title: node.title,
      summary: node.summary,
      progress: hiddenNode?.progress ?? 0,
      state:
        (hiddenNode?.state as import("@/lib/career-tree/types").CareerTreeNodeState) ?? "ready",
      children: materializeTreeNodes(directionKey, node.children, nodeMap, pathIndex),
      evidenceRefs: undefined,
    };
  });
}

function parseChapterIndexFromKey(chapterKey: string): number {
  const match = /^chapter-(\d+)$/.exec(chapterKey);
  return match ? Number(match[1]) : 0;
}

function flattenVisibleNodes(
  nodes: Array<import("@/lib/career-tree/types").VisibleSkillTreeNode>,
): Array<import("@/lib/career-tree/types").VisibleSkillTreeNode> {
  return nodes.flatMap((node) => [node, ...flattenVisibleNodes(node.children)]);
}

function findFocusNode(
  nodes: Array<import("@/lib/career-tree/types").VisibleSkillTreeNode>,
): import("@/lib/career-tree/types").VisibleSkillTreeNode | null {
  const flattened = flattenVisibleNodes(nodes);
  return (
    flattened.find((node) => node.state === "in_progress") ??
    flattened.find((node) => node.state === "ready") ??
    flattened[0] ??
    null
  );
}

export async function processCareerTreeExtractJob(
  job: JobPayload<"extract_course_evidence">,
): Promise<void> {
  const course = await getCourseForCareerTree(job.userId, job.courseId);
  if (!course) {
    return;
  }

  const outline = normalizeCareerOutline(course.outlineData);
  const outlineHash = computeCareerOutlineHash(outline);
  const idempotencyKey = buildCareerExtractionIdempotencyKey(job.userId, job.courseId, outlineHash);
  const run = await getOrCreateRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "extract",
    idempotencyKey,
    inputHash: outlineHash,
    model: "CAREER_TREE_JSON",
    promptVersion: "career-tree-extract@v1",
  });

  if (run.status === "succeeded") {
    await enqueueCareerTreeMerge(job.userId, job.courseId, run.id);
    return;
  }

  try {
    const extracted = await extractCareerCourseEvidence(
      buildCareerCourseExtractionInput({
        userId: job.userId,
        courseId: job.courseId,
        title: course.title,
        description: course.description,
        outline,
      }),
    );

    for (const item of extracted.items) {
      await ingestEvidenceEvent({
        id: crypto.randomUUID(),
        userId: job.userId,
        kind: "course_outline",
        sourceType: "course",
        sourceId: job.courseId,
        sourceVersionHash: outlineHash,
        title: item.title,
        summary: item.summary,
        confidence: item.confidence,
        happenedAt: new Date().toISOString(),
        metadata: {
          itemKind: item.kind,
          prerequisiteHints: item.prerequisiteHints,
          relatedHints: item.relatedHints,
        },
        refs: [
          ...item.chapterKeys.map((chapterKey) => ({
            refType: "chapter",
            refId: chapterKey,
            snippet:
              outline.chapters.find((chapter) => chapter.chapterKey === chapterKey)?.title ??
              chapterKey,
            weight: 1,
          })),
          ...item.evidenceSnippets.map((snippet, index) => ({
            refType: "snippet",
            refId: `${item.title}:${index}`,
            snippet,
            weight: 1,
          })),
        ],
      });
    }

    const affectedNodeIds = await listLinkedNodeIdsForEvidenceSource({
      userId: job.userId,
      sourceType: "course",
      sourceId: job.courseId,
      sourceVersionHash: null,
    });

    await aggregateCourseEventsToKnowledgeEvidence({
      userId: job.userId,
      courseId: job.courseId,
      sourceVersionHash: outlineHash,
    });

    await markRunSucceeded(db, run.id, extracted);
    await enqueueCareerTreeMerge(job.userId, job.courseId, run.id, affectedNodeIds);
  } catch (error) {
    await markRunFailed(run.id, error);
    throw error;
  }
}

export async function processCareerTreeMergeJob(
  job: JobPayload<"merge_user_skill_graph">,
): Promise<void> {
  const extractRun = job.extractRunId
    ? await db.query.careerGenerationRuns.findFirst({
        where: eq(careerGenerationRuns.id, job.extractRunId),
      })
    : await db.query.careerGenerationRuns.findFirst({
        where: and(
          eq(careerGenerationRuns.userId, job.userId),
          eq(careerGenerationRuns.courseId, job.courseId),
          eq(careerGenerationRuns.kind, "extract"),
          eq(careerGenerationRuns.status, "succeeded"),
        ),
        orderBy: desc(careerGenerationRuns.createdAt),
      });

  if (!extractRun) {
    return;
  }

  const mergeRun = await getOrCreateRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "merge",
    idempotencyKey: `merge:user:${job.userId}:course:${job.courseId}:extract_run:${extractRun.id}`,
    inputHash: extractRun.inputHash,
    model: "CAREER_TREE_JSON",
    promptVersion: "career-tree-merge@v1",
  });

  if (mergeRun.status === "succeeded") {
    await enqueueCareerTreeCompose(job.userId);
    return;
  }

  const evidenceRows = await db
    .select({
      id: knowledgeEvidence.id,
      title: knowledgeEvidence.title,
      summary: knowledgeEvidence.summary,
      confidence: knowledgeEvidence.confidence,
      sourceVersionHash: knowledgeEvidence.sourceVersionHash,
    })
    .from(knowledgeEvidence)
    .where(
      and(
        eq(knowledgeEvidence.userId, job.userId),
        eq(knowledgeEvidence.sourceType, "course"),
        eq(knowledgeEvidence.sourceId, job.courseId),
        eq(knowledgeEvidence.sourceVersionHash, extractRun.inputHash),
      ),
    );

  const evidenceRefs =
    evidenceRows.length > 0
      ? await db
          .select({
            evidenceId: knowledgeEvidenceSourceLinks.evidenceId,
            refType: knowledgeEvidenceSourceLinks.refType,
            refId: knowledgeEvidenceSourceLinks.refId,
            snippet: knowledgeEvidenceSourceLinks.snippet,
          })
          .from(knowledgeEvidenceSourceLinks)
          .where(
            inArray(
              knowledgeEvidenceSourceLinks.evidenceId,
              evidenceRows.map((row) => row.id),
            ),
          )
      : [];

  const existingNodes = await db
    .select({
      id: careerUserSkillNodes.id,
      canonicalLabel: careerUserSkillNodes.canonicalLabel,
      summary: careerUserSkillNodes.summary,
    })
    .from(careerUserSkillNodes)
    .where(eq(careerUserSkillNodes.userId, job.userId));

  const existingEvidenceLinks = await db
    .select({
      nodeId: careerUserSkillNodeEvidence.nodeId,
      title: knowledgeEvidence.title,
      summary: knowledgeEvidence.summary,
    })
    .from(careerUserSkillNodeEvidence)
    .innerJoin(
      knowledgeEvidence,
      eq(careerUserSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
    )
    .where(eq(careerUserSkillNodeEvidence.userId, job.userId));

  const existingPrerequisiteEdges = await db
    .select({
      fromNodeId: careerUserSkillEdges.fromNodeId,
      toNodeId: careerUserSkillEdges.toNodeId,
    })
    .from(careerUserSkillEdges)
    .where(eq(careerUserSkillEdges.userId, job.userId));

  const candidateSet = retrieveMergeCandidateSet({
    evidenceItems: evidenceRows.map((row) => ({
      title: row.title,
      kind: "skill",
      summary: row.summary,
      confidence: Number(row.confidence),
      chapterKeys: evidenceRefs
        .filter((ref) => ref.evidenceId === row.id && ref.refType === "chapter")
        .map((ref) => ref.refId),
      prerequisiteHints: [],
      relatedHints: [],
      evidenceSnippets: evidenceRefs
        .filter((ref) => ref.evidenceId === row.id && ref.snippet)
        .map((ref) => ref.snippet!)
        .filter(Boolean),
    })),
    existingNodes,
    existingEvidenceLinks,
    existingPrerequisiteEdges,
  });

  const priorCourseLinks = await db
    .select({
      nodeId: careerUserSkillNodeEvidence.nodeId,
      evidenceId: careerUserSkillNodeEvidence.knowledgeEvidenceId,
    })
    .from(careerUserSkillNodeEvidence)
    .innerJoin(
      knowledgeEvidence,
      eq(careerUserSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
    )
    .where(
      and(
        eq(careerUserSkillNodeEvidence.userId, job.userId),
        eq(knowledgeEvidence.sourceType, "course"),
        eq(knowledgeEvidence.sourceId, job.courseId),
      ),
    );

  try {
    const planned = await planCareerGraphMerge({
      userId: job.userId,
      courseId: job.courseId,
      candidateContext: candidateSet,
      evidenceBatch: evidenceRows,
      priorCourseSummary: priorCourseLinks,
    });

    const validated = validateMergePlannerOutput({
      output: planned,
      allowedTargetNodeIds: new Set(existingNodes.map((node) => node.id)),
      allowedEvidenceIds: new Set(evidenceRows.map((row) => row.id)),
    });

    await db.transaction(async (tx) => {
      const oldCourseLinkRows = await tx
        .select({
          id: careerUserSkillNodeEvidence.id,
          nodeId: careerUserSkillNodeEvidence.nodeId,
        })
        .from(careerUserSkillNodeEvidence)
        .innerJoin(
          knowledgeEvidence,
          eq(careerUserSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
        )
        .where(
          and(
            eq(careerUserSkillNodeEvidence.userId, job.userId),
            eq(knowledgeEvidence.sourceType, "course"),
            eq(knowledgeEvidence.sourceId, job.courseId),
          ),
        );

      if (oldCourseLinkRows.length > 0) {
        await tx.delete(careerUserSkillNodeEvidence).where(
          inArray(
            careerUserSkillNodeEvidence.id,
            oldCourseLinkRows.map((row) => row.id),
          ),
        );
      }

      const priorMergeRuns = await tx
        .select({ id: careerGenerationRuns.id })
        .from(careerGenerationRuns)
        .where(
          and(
            eq(careerGenerationRuns.userId, job.userId),
            eq(careerGenerationRuns.courseId, job.courseId),
            eq(careerGenerationRuns.kind, "merge"),
          ),
        );

      if (priorMergeRuns.length > 0) {
        await tx.delete(careerUserSkillEdges).where(
          inArray(
            careerUserSkillEdges.sourceMergeRunId,
            priorMergeRuns.map((row) => row.id),
          ),
        );
      }

      const tempNodeRefMap = new Map<string, string>();
      const touchedNodeIds = new Set([
        ...oldCourseLinkRows.map((row) => row.nodeId),
        ...(job.affectedNodeIds ?? []),
      ]);

      for (const decision of validated.decisions) {
        if (decision.action === "attach") {
          touchedNodeIds.add(decision.targetNodeId);
          await tx
            .insert(careerUserSkillNodeEvidence)
            .values(
              decision.evidenceIds.map((evidenceId) => ({
                userId: job.userId,
                nodeId: decision.targetNodeId,
                knowledgeEvidenceId: evidenceId,
                mergeRunId: mergeRun.id,
                weight: decision.confidence.toFixed(3),
              })),
            )
            .onConflictDoNothing();
          continue;
        }

        const [createdNode] = await tx
          .insert(careerUserSkillNodes)
          .values({
            userId: job.userId,
            canonicalLabel: decision.newNode.canonicalLabel,
            summary: decision.newNode.summary ?? null,
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

        await tx.insert(careerUserSkillNodeEvidence).values(
          decision.evidenceIds.map((evidenceId) => ({
            userId: job.userId,
            nodeId: createdNode.id,
            knowledgeEvidenceId: evidenceId,
            mergeRunId: mergeRun.id,
            weight: decision.confidence.toFixed(3),
          })),
        );
      }

      const resolvedEdges = validated.prerequisiteEdges
        .map((edge) => ({
          fromNodeId: tempNodeRefMap.get(edge.from) ?? edge.from,
          toNodeId: tempNodeRefMap.get(edge.to) ?? edge.to,
          confidence: edge.confidence.toFixed(3),
        }))
        .filter((edge) => edge.fromNodeId !== edge.toNodeId);

      if (resolvedEdges.length > 0) {
        await tx
          .insert(careerUserSkillEdges)
          .values(
            resolvedEdges.map((edge) => ({
              userId: job.userId,
              fromNodeId: edge.fromNodeId,
              toNodeId: edge.toNodeId,
              confidence: edge.confidence,
              sourceMergeRunId: mergeRun.id,
            })),
          )
          .onConflictDoNothing();

        for (const edge of resolvedEdges) {
          touchedNodeIds.add(edge.fromNodeId);
          touchedNodeIds.add(edge.toNodeId);
        }
      }

      const existingGraphState = await tx.query.careerUserGraphState.findFirst({
        where: eq(careerUserGraphState.userId, job.userId),
      });

      if (existingGraphState) {
        await tx
          .update(careerUserGraphState)
          .set({
            graphVersion: existingGraphState.graphVersion + 1,
            lastMergeRunId: mergeRun.id,
            updatedAt: new Date(),
          })
          .where(eq(careerUserGraphState.userId, job.userId));
      } else {
        await tx.insert(careerUserGraphState).values({
          userId: job.userId,
          graphVersion: 1,
          lastMergeRunId: mergeRun.id,
          updatedAt: new Date(),
        });
      }

      await recomputeNodeAggregates(tx, job.userId, [...touchedNodeIds]);
    });

    await markRunSucceeded(db, mergeRun.id, validated);
    await enqueueCareerTreeCompose(job.userId);
    await enqueueKnowledgeInsights(job.userId);
  } catch (error) {
    await markRunFailed(mergeRun.id, error);
    throw error;
  }
}

export async function processKnowledgeSourceMergeJob(
  job: JobPayload<"merge_knowledge_source_evidence">,
): Promise<void> {
  const evidenceRows = await loadSourceEvidenceRows({
    userId: job.userId,
    sourceType: job.sourceType,
    sourceId: job.sourceId,
    sourceVersionHash: job.sourceVersionHash,
  });
  const evidenceBatchHash = computeEvidenceBatchHash(evidenceRows);

  if (evidenceRows.length === 0) {
    if ((job.affectedNodeIds ?? []).length > 0) {
      await enqueueCareerTreeRefresh(job.userId, undefined, job.affectedNodeIds);
    } else {
      await enqueueKnowledgeInsights(job.userId);
    }
    return;
  }

  const mergeRun = await getOrCreateRun({
    userId: job.userId,
    kind: "merge",
    idempotencyKey: `merge:user:${job.userId}:source:${job.sourceType}:${job.sourceId}:hash:${evidenceBatchHash}`,
    inputHash: evidenceBatchHash,
    model: "CAREER_TREE_JSON",
    promptVersion: "career-tree-merge@v1",
  });

  if (mergeRun.status === "succeeded") {
    await enqueueCareerTreeCompose(job.userId);
    return;
  }

  const evidenceRefs = await loadEvidenceRefs(evidenceRows.map((row) => row.id));

  const existingNodes = await db
    .select({
      id: careerUserSkillNodes.id,
      canonicalLabel: careerUserSkillNodes.canonicalLabel,
      summary: careerUserSkillNodes.summary,
    })
    .from(careerUserSkillNodes)
    .where(eq(careerUserSkillNodes.userId, job.userId));

  const existingEvidenceLinks = await db
    .select({
      nodeId: careerUserSkillNodeEvidence.nodeId,
      title: knowledgeEvidence.title,
      summary: knowledgeEvidence.summary,
    })
    .from(careerUserSkillNodeEvidence)
    .innerJoin(
      knowledgeEvidence,
      eq(careerUserSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
    )
    .where(eq(careerUserSkillNodeEvidence.userId, job.userId));

  const existingPrerequisiteEdges = await db
    .select({
      fromNodeId: careerUserSkillEdges.fromNodeId,
      toNodeId: careerUserSkillEdges.toNodeId,
    })
    .from(careerUserSkillEdges)
    .where(eq(careerUserSkillEdges.userId, job.userId));

  const candidateSet = retrieveMergeCandidateSet({
    evidenceItems: evidenceRows.map((row) => ({
      title: row.title,
      kind: "skill",
      summary: row.summary,
      confidence: Number(row.confidence),
      chapterKeys: evidenceRefs
        .filter((ref) => ref.evidenceId === row.id && ref.refType === "chapter")
        .map((ref) => ref.refId),
      prerequisiteHints: [],
      relatedHints: [],
      evidenceSnippets: evidenceRefs
        .filter((ref) => ref.evidenceId === row.id && ref.snippet)
        .map((ref) => ref.snippet!)
        .filter(Boolean),
    })),
    existingNodes,
    existingEvidenceLinks,
    existingPrerequisiteEdges,
  });

  try {
    const planned = await planCareerGraphMerge({
      userId: job.userId,
      courseId: `${job.sourceType}:${job.sourceId}`,
      candidateContext: candidateSet,
      evidenceBatch: evidenceRows,
      priorCourseSummary: {
        sourceType: job.sourceType,
        sourceId: job.sourceId,
      },
    });

    const validated = validateMergePlannerOutput({
      output: planned,
      allowedTargetNodeIds: new Set(existingNodes.map((node) => node.id)),
      allowedEvidenceIds: new Set(evidenceRows.map((row) => row.id)),
    });

    await db.transaction(async (tx) => {
      const existingSourceLinkRows = await tx
        .select({
          id: careerUserSkillNodeEvidence.id,
          nodeId: careerUserSkillNodeEvidence.nodeId,
        })
        .from(careerUserSkillNodeEvidence)
        .innerJoin(
          knowledgeEvidence,
          eq(careerUserSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
        )
        .where(
          and(
            eq(careerUserSkillNodeEvidence.userId, job.userId),
            eq(knowledgeEvidence.sourceType, job.sourceType),
            eq(knowledgeEvidence.sourceId, job.sourceId),
            buildSourceVersionCondition(knowledgeEvidence.sourceVersionHash, job.sourceVersionHash),
          ),
        );

      if (existingSourceLinkRows.length > 0) {
        await tx.delete(careerUserSkillNodeEvidence).where(
          inArray(
            careerUserSkillNodeEvidence.id,
            existingSourceLinkRows.map((row) => row.id),
          ),
        );
      }

      const tempNodeRefMap = new Map<string, string>();
      const touchedNodeIds = new Set([
        ...existingSourceLinkRows.map((row) => row.nodeId),
        ...(job.affectedNodeIds ?? []),
      ]);

      for (const decision of validated.decisions) {
        if (decision.action === "attach") {
          touchedNodeIds.add(decision.targetNodeId);
          await tx
            .insert(careerUserSkillNodeEvidence)
            .values(
              decision.evidenceIds.map((evidenceId) => ({
                userId: job.userId,
                nodeId: decision.targetNodeId,
                knowledgeEvidenceId: evidenceId,
                mergeRunId: mergeRun.id,
                weight: decision.confidence.toFixed(3),
              })),
            )
            .onConflictDoNothing();
          continue;
        }

        const [createdNode] = await tx
          .insert(careerUserSkillNodes)
          .values({
            userId: job.userId,
            canonicalLabel: decision.newNode.canonicalLabel,
            summary: decision.newNode.summary ?? null,
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

        await tx.insert(careerUserSkillNodeEvidence).values(
          decision.evidenceIds.map((evidenceId) => ({
            userId: job.userId,
            nodeId: createdNode.id,
            knowledgeEvidenceId: evidenceId,
            mergeRunId: mergeRun.id,
            weight: decision.confidence.toFixed(3),
          })),
        );
      }

      const existingGraphState = await tx.query.careerUserGraphState.findFirst({
        where: eq(careerUserGraphState.userId, job.userId),
      });

      if (existingGraphState) {
        await tx
          .update(careerUserGraphState)
          .set({
            graphVersion: existingGraphState.graphVersion + 1,
            lastMergeRunId: mergeRun.id,
            updatedAt: new Date(),
          })
          .where(eq(careerUserGraphState.userId, job.userId));
      } else {
        await tx.insert(careerUserGraphState).values({
          userId: job.userId,
          graphVersion: 1,
          lastMergeRunId: mergeRun.id,
          updatedAt: new Date(),
        });
      }

      await recomputeNodeAggregates(tx, job.userId, [...touchedNodeIds]);
    });

    await markRunSucceeded(db, mergeRun.id, validated);
    await enqueueCareerTreeCompose(job.userId);
    await enqueueKnowledgeInsights(job.userId);
  } catch (error) {
    await markRunFailed(mergeRun.id, error);
    throw error;
  }
}

export async function processCareerTreeComposeJob(
  job: JobPayload<"compose_user_career_trees">,
): Promise<void> {
  const [userCourses, graphState, preference, nodes, edges, latestSnapshot] = await Promise.all([
    db.select({ id: courses.id }).from(courses).where(eq(courses.userId, job.userId)).limit(1),
    db.query.careerUserGraphState.findFirst({
      where: eq(careerUserGraphState.userId, job.userId),
    }),
    getCareerTreePreference(job.userId),
    db.select().from(careerUserSkillNodes).where(eq(careerUserSkillNodes.userId, job.userId)),
    db.select().from(careerUserSkillEdges).where(eq(careerUserSkillEdges.userId, job.userId)),
    db.query.careerUserTreeSnapshots.findFirst({
      where: and(
        eq(careerUserTreeSnapshots.userId, job.userId),
        eq(careerUserTreeSnapshots.isLatest, true),
      ),
      orderBy: desc(careerUserTreeSnapshots.createdAt),
    }),
  ]);

  if (userCourses.length === 0) {
    return;
  }

  const composeRun = await getOrCreateRun({
    userId: job.userId,
    kind: "compose",
    idempotencyKey: `compose:user:${job.userId}:graph:${graphState?.graphVersion ?? 0}:pref:${preference.preferenceVersion}`,
    inputHash: `${graphState?.graphVersion ?? 0}:${preference.preferenceVersion}`,
    model: "CAREER_TREE_JSON",
    promptVersion: "career-tree-compose@v1",
  });

  if (composeRun.status === "succeeded") {
    return;
  }

  if (nodes.length === 0) {
    return;
  }

  const previousComposeRun = latestSnapshot?.composeRunId
    ? await db.query.careerGenerationRuns.findFirst({
        where: eq(careerGenerationRuns.id, latestSnapshot.composeRunId),
      })
    : null;

  try {
    const composed = await composeCareerTrees({
      userId: job.userId,
      graph: buildComposeGraph(nodes, edges),
      preference,
      previousSummary: previousComposeRun?.outputJson ?? null,
    });

    const parsed = treeComposerOutputSchema.parse(composed);
    const previousOutput =
      previousComposeRun?.outputJson && typeof previousComposeRun.outputJson === "object"
        ? previousComposeRun.outputJson
        : null;
    const previousTrees = previousOutput && "trees" in previousOutput ? previousOutput.trees : null;
    const previousDirections = Array.isArray(previousTrees)
      ? previousTrees
          .filter(
            (
              tree,
            ): tree is {
              directionKey?: string;
              matchPreviousDirectionKey?: string;
              keySeed?: string;
              supportingNodeRefs: string[];
            } =>
              typeof tree === "object" &&
              tree !== null &&
              "supportingNodeRefs" in tree &&
              Array.isArray(tree.supportingNodeRefs),
          )
          .map((tree) => ({
            directionKey: tree.directionKey ?? tree.matchPreviousDirectionKey ?? tree.keySeed ?? "",
            supportingNodeRefs: tree.supportingNodeRefs,
          }))
          .filter((tree) => tree.directionKey.length > 0)
      : [];

    const resolvedTrees = resolveDirectionKeys({
      trees: parsed.trees,
      previousDirections,
    });

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const nodeEvidenceRows = await db
      .select({
        nodeId: careerUserSkillNodeEvidence.nodeId,
        sourceId: knowledgeEvidence.sourceId,
        courseTitle: courses.title,
        refType: knowledgeEvidenceSourceLinks.refType,
        refId: knowledgeEvidenceSourceLinks.refId,
      })
      .from(careerUserSkillNodeEvidence)
      .innerJoin(
        knowledgeEvidence,
        eq(careerUserSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
      )
      .leftJoin(courses, eq(courses.id, knowledgeEvidence.sourceId))
      .leftJoin(
        knowledgeEvidenceSourceLinks,
        eq(knowledgeEvidenceSourceLinks.evidenceId, knowledgeEvidence.id),
      )
      .where(eq(careerUserSkillNodeEvidence.userId, job.userId));

    const snapshotTrees = resolvedTrees.map((tree) => {
      const supportingRows = nodeEvidenceRows.filter((row) =>
        tree.supportingNodeRefs.includes(row.nodeId),
      );
      const supportingCourses = [
        ...new Map(
          supportingRows.map((row) => [
            row.sourceId,
            {
              courseId: row.sourceId,
              title: row.courseTitle ?? "未命名课程",
            },
          ]),
        ).values(),
      ].filter((course): course is { courseId: string; title: string } => Boolean(course.courseId));
      const supportingChapters = supportingRows.flatMap((row) =>
        row.refType === "chapter" && row.sourceId && row.refId
          ? [
              {
                courseId: row.sourceId,
                chapterKey: row.refId,
                chapterIndex: parseChapterIndexFromKey(row.refId),
                title: row.refId,
              },
            ]
          : [],
      );

      return {
        directionKey: tree.directionKey,
        title: tree.title,
        summary: tree.summary,
        confidence: tree.confidence,
        whyThisDirection: tree.whyThisDirection,
        supportingCourses,
        supportingChapters,
        tree: materializeTreeNodes(tree.directionKey, tree.tree, nodeMap),
      };
    });

    const recommendedDirectionKey =
      resolvedTrees.find(
        (tree) =>
          tree.keySeed === parsed.recommendedDirectionHint ||
          tree.directionKey === parsed.recommendedDirectionHint,
      )?.directionKey ??
      snapshotTrees[0]?.directionKey ??
      null;

    const focusTree =
      snapshotTrees.find((tree) => tree.directionKey === preference.selectedDirectionKey) ??
      snapshotTrees.find((tree) => tree.directionKey === recommendedDirectionKey) ??
      snapshotTrees[0] ??
      null;
    const focusNode = focusTree ? findFocusNode(focusTree.tree) : null;
    const topInsights = await db
      .select({
        kind: knowledgeInsights.kind,
        title: knowledgeInsights.title,
        summary: knowledgeInsights.summary,
        confidence: knowledgeInsights.confidence,
      })
      .from(knowledgeInsights)
      .where(eq(knowledgeInsights.userId, job.userId))
      .orderBy(desc(knowledgeInsights.confidence))
      .limit(3);

    const payload = {
      schemaVersion: CAREER_TREE_SCHEMA_VERSION,
      status: "ready" as const,
      recommendedDirectionKey,
      selectedDirectionKey: preference.selectedDirectionKey,
      trees: snapshotTrees,
      generatedAt: new Date().toISOString(),
    };

    await db.transaction(async (tx) => {
      await tx
        .update(careerUserTreeSnapshots)
        .set({ isLatest: false })
        .where(
          and(
            eq(careerUserTreeSnapshots.userId, job.userId),
            eq(careerUserTreeSnapshots.isLatest, true),
          ),
        );

      await tx.insert(careerUserTreeSnapshots).values({
        userId: job.userId,
        composeRunId: composeRun.id,
        schemaVersion: CAREER_TREE_SCHEMA_VERSION,
        status: "ready",
        recommendedDirectionKey,
        selectedDirectionKey: preference.selectedDirectionKey,
        graphVersion: graphState?.graphVersion ?? 0,
        preferenceVersion: preference.preferenceVersion,
        payload,
        isLatest: true,
        generatedAt: new Date(),
      });

      const [latestTreeSnapshot] = await tx
        .select({ id: careerUserTreeSnapshots.id })
        .from(careerUserTreeSnapshots)
        .where(
          and(
            eq(careerUserTreeSnapshots.userId, job.userId),
            eq(careerUserTreeSnapshots.composeRunId, composeRun.id),
          ),
        )
        .orderBy(desc(careerUserTreeSnapshots.createdAt))
        .limit(1);

      await tx
        .update(userFocusSnapshots)
        .set({ isLatest: false })
        .where(
          and(eq(userFocusSnapshots.userId, job.userId), eq(userFocusSnapshots.isLatest, true)),
        );

      const [focusSnapshot] = await tx
        .insert(userFocusSnapshots)
        .values({
          userId: job.userId,
          treeSnapshotId: latestTreeSnapshot?.id ?? null,
          directionKey: focusTree?.directionKey ?? null,
          nodeId: focusNode?.id ?? null,
          title: focusNode?.title ?? focusTree?.title ?? "当前焦点生成中",
          summary: focusNode?.summary ?? focusTree?.whyThisDirection ?? "系统正在整理当前焦点。",
          progress: focusNode?.progress ?? 0,
          state: focusNode?.state ?? "ready",
          payload: {
            directionKey: focusTree?.directionKey ?? null,
            treeTitle: focusTree?.title ?? null,
            whyThisDirection: focusTree?.whyThisDirection ?? null,
            node: focusNode,
          },
          isLatest: true,
          generatedAt: new Date(),
        })
        .returning({ id: userFocusSnapshots.id });

      await tx
        .update(userProfileSnapshots)
        .set({ isLatest: false })
        .where(
          and(eq(userProfileSnapshots.userId, job.userId), eq(userProfileSnapshots.isLatest, true)),
        );

      await tx.insert(userProfileSnapshots).values({
        userId: job.userId,
        treeSnapshotId: latestTreeSnapshot?.id ?? null,
        focusSnapshotId: focusSnapshot?.id ?? null,
        payload: {
          recommendedDirectionKey,
          selectedDirectionKey: preference.selectedDirectionKey,
          treesCount: snapshotTrees.length,
          focus: focusNode,
          insights: topInsights.map((insight) => ({
            ...insight,
            confidence: Number(insight.confidence),
          })),
        },
        isLatest: true,
        generatedAt: new Date(),
      });

      await markRunSucceeded(tx, composeRun.id, {
        recommendedDirectionHint: parsed.recommendedDirectionHint ?? null,
        trees: resolvedTrees,
      });
    });

    revalidateGoldenPath(job.userId);
  } catch (error) {
    await markRunFailed(composeRun.id, error);
    throw error;
  }
}

export async function processCareerTreeRefreshJob(
  job: JobPayload<"refresh_user_skill_graph">,
): Promise<void> {
  const nodeIds =
    job.nodeIds && job.nodeIds.length > 0
      ? [...new Set(job.nodeIds)]
      : [
          ...new Set(
            (
              await db
                .select({
                  nodeId: careerUserSkillNodeEvidence.nodeId,
                })
                .from(careerUserSkillNodeEvidence)
                .innerJoin(
                  knowledgeEvidence,
                  eq(careerUserSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
                )
                .where(
                  and(
                    eq(careerUserSkillNodeEvidence.userId, job.userId),
                    eq(knowledgeEvidence.sourceType, "course"),
                    job.courseId ? eq(knowledgeEvidence.sourceId, job.courseId) : undefined,
                  ),
                )
            ).map((row) => row.nodeId),
          ),
        ];

  if (nodeIds.length === 0) {
    return;
  }

  const refreshRun = await getOrCreateRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "refresh",
    idempotencyKey: `refresh:user:${job.userId}:course:${job.courseId ?? "all"}:${Date.now()}`,
    inputHash: `${job.courseId ?? "all"}:${nodeIds.length}`,
    model: "deterministic",
    promptVersion: "career-tree-refresh@v1",
  });

  try {
    await db.transaction(async (tx) => {
      const existingGraphState = await tx.query.careerUserGraphState.findFirst({
        where: eq(careerUserGraphState.userId, job.userId),
      });

      if (existingGraphState) {
        await tx
          .update(careerUserGraphState)
          .set({
            graphVersion: existingGraphState.graphVersion + 1,
            updatedAt: new Date(),
          })
          .where(eq(careerUserGraphState.userId, job.userId));
      } else {
        await tx.insert(careerUserGraphState).values({
          userId: job.userId,
          graphVersion: 1,
          updatedAt: new Date(),
        });
      }

      await recomputeNodeAggregates(tx, job.userId, nodeIds);
      await markRunSucceeded(tx, refreshRun.id, {
        courseId: job.courseId ?? null,
        refreshedNodeCount: nodeIds.length,
      });
    });

    await enqueueCareerTreeCompose(job.userId);
    await enqueueKnowledgeInsights(job.userId);
  } catch (error) {
    await markRunFailed(refreshRun.id, error);
    throw error;
  }
}
