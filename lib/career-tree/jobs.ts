import { and, desc, eq, inArray } from "drizzle-orm";
import {
  careerCourseChapterEvidence,
  careerCourseSkillEvidence,
  careerGenerationRuns,
  careerUserGraphState,
  careerUserSkillEdges,
  careerUserSkillNodeEvidence,
  careerUserSkillNodes,
  careerUserTreeSnapshots,
  courseProgress,
  courses,
  db,
} from "@/db";
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
import { enqueueCareerTreeCompose, enqueueCareerTreeMerge } from "@/lib/career-tree/queue";
import { retrieveMergeCandidateSet } from "@/lib/career-tree/retrieve-merge-candidates";
import type { CareerTreeJobData } from "@/lib/queue/career-tree-queue";

type JobPayload<T extends CareerTreeJobData["type"]> = Extract<CareerTreeJobData, { type: T }>;

interface CourseRow {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  outlineData: unknown;
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

async function getOrCreateRun(params: {
  userId: string;
  courseId?: string;
  kind: "extract" | "merge" | "compose";
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
        evidenceId: careerCourseSkillEvidence.id,
        courseId: careerCourseSkillEvidence.courseId,
        chapterKeys: careerCourseSkillEvidence.chapterKeys,
        confidence: careerCourseSkillEvidence.confidence,
        outlineData: courses.outlineData,
        completedSections: courseProgress.completedSections,
        completedChapters: courseProgress.completedChapters,
      })
      .from(careerUserSkillNodeEvidence)
      .innerJoin(
        careerCourseSkillEvidence,
        eq(careerUserSkillNodeEvidence.courseSkillEvidenceId, careerCourseSkillEvidence.id),
      )
      .innerJoin(courses, eq(careerCourseSkillEvidence.courseId, courses.id))
      .leftJoin(
        courseProgress,
        and(eq(courseProgress.courseId, courses.id), eq(courseProgress.userId, userId)),
      )
      .where(eq(careerUserSkillNodeEvidence.nodeId, nodeId));

    const chapterCompletionRatios: AggregationInput["chapterCompletionRatios"] = [];
    const fallbackCourseProgressRatios: AggregationInput["fallbackCourseProgressRatios"] = [];
    const courseIds = new Set<string>();
    const chapterKeys = new Set<string>();

    for (const row of linkedEvidenceRows) {
      courseIds.add(row.courseId);
      const outline = normalizeCareerOutline(row.outlineData);
      const progressMap = buildChapterProgressMap(
        outline,
        row.completedSections ?? [],
        row.completedChapters ?? [],
      );
      const confidence = Number(row.confidence);
      const rowChapterKeys = row.chapterKeys ?? [];

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

    await db.transaction(async (tx) => {
      if (extracted.items.length > 0) {
        await tx.insert(careerCourseSkillEvidence).values(
          extracted.items.map((item) => ({
            userId: job.userId,
            courseId: job.courseId,
            extractRunId: run.id,
            title: item.title,
            kind: item.kind,
            summary: item.summary,
            confidence: item.confidence.toFixed(3),
            chapterKeys: item.chapterKeys,
            prerequisiteHints: item.prerequisiteHints,
            relatedHints: item.relatedHints,
            evidenceSnippets: item.evidenceSnippets,
            sourceOutlineHash: outlineHash,
          })),
        );
      }

      const chapterEvidenceMap = new Map<
        string,
        { chapterTitle: string; skillEvidenceIds: string[]; confidence: number }
      >();

      const evidenceRows = await tx
        .select({
          id: careerCourseSkillEvidence.id,
          chapterKeys: careerCourseSkillEvidence.chapterKeys,
          confidence: careerCourseSkillEvidence.confidence,
        })
        .from(careerCourseSkillEvidence)
        .where(eq(careerCourseSkillEvidence.extractRunId, run.id));

      for (const row of evidenceRows) {
        for (const chapterKey of row.chapterKeys ?? []) {
          const chapter = outline.chapters.find((item) => item.chapterKey === chapterKey);
          if (!chapter) {
            continue;
          }

          const current = chapterEvidenceMap.get(chapterKey) ?? {
            chapterTitle: chapter.title,
            skillEvidenceIds: [],
            confidence: 0,
          };

          current.skillEvidenceIds.push(row.id);
          current.confidence = Math.max(current.confidence, Number(row.confidence));
          chapterEvidenceMap.set(chapterKey, current);
        }
      }

      if (chapterEvidenceMap.size > 0) {
        await tx
          .delete(careerCourseChapterEvidence)
          .where(
            and(
              eq(careerCourseChapterEvidence.userId, job.userId),
              eq(careerCourseChapterEvidence.courseId, job.courseId),
            ),
          );

        await tx.insert(careerCourseChapterEvidence).values(
          [...chapterEvidenceMap.entries()].map(([chapterKey, value]) => ({
            userId: job.userId,
            courseId: job.courseId,
            chapterKey,
            chapterTitle: value.chapterTitle,
            skillEvidenceIds: value.skillEvidenceIds,
            confidence: value.confidence.toFixed(3),
          })),
        );
      }
    });

    await markRunSucceeded(db, run.id, extracted);
    await enqueueCareerTreeMerge(job.userId, job.courseId, run.id);
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
      id: careerCourseSkillEvidence.id,
      title: careerCourseSkillEvidence.title,
      summary: careerCourseSkillEvidence.summary,
      confidence: careerCourseSkillEvidence.confidence,
      chapterKeys: careerCourseSkillEvidence.chapterKeys,
      sourceOutlineHash: careerCourseSkillEvidence.sourceOutlineHash,
      evidenceSnippets: careerCourseSkillEvidence.evidenceSnippets,
    })
    .from(careerCourseSkillEvidence)
    .where(eq(careerCourseSkillEvidence.extractRunId, extractRun.id));

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
      title: careerCourseSkillEvidence.title,
      summary: careerCourseSkillEvidence.summary,
    })
    .from(careerUserSkillNodeEvidence)
    .innerJoin(
      careerCourseSkillEvidence,
      eq(careerUserSkillNodeEvidence.courseSkillEvidenceId, careerCourseSkillEvidence.id),
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
      chapterKeys: row.chapterKeys ?? [],
      prerequisiteHints: [],
      relatedHints: [],
      evidenceSnippets: row.evidenceSnippets ?? [],
    })),
    existingNodes,
    existingEvidenceLinks,
    existingPrerequisiteEdges,
  });

  const priorCourseLinks = await db
    .select({
      nodeId: careerUserSkillNodeEvidence.nodeId,
      evidenceId: careerUserSkillNodeEvidence.courseSkillEvidenceId,
    })
    .from(careerUserSkillNodeEvidence)
    .innerJoin(
      careerCourseSkillEvidence,
      eq(careerUserSkillNodeEvidence.courseSkillEvidenceId, careerCourseSkillEvidence.id),
    )
    .where(
      and(
        eq(careerUserSkillNodeEvidence.userId, job.userId),
        eq(careerCourseSkillEvidence.courseId, job.courseId),
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
          careerCourseSkillEvidence,
          eq(careerUserSkillNodeEvidence.courseSkillEvidenceId, careerCourseSkillEvidence.id),
        )
        .where(
          and(
            eq(careerUserSkillNodeEvidence.userId, job.userId),
            eq(careerCourseSkillEvidence.courseId, job.courseId),
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
      const touchedNodeIds = new Set(oldCourseLinkRows.map((row) => row.nodeId));

      for (const decision of validated.decisions) {
        if (decision.action === "attach") {
          touchedNodeIds.add(decision.targetNodeId);
          await tx
            .insert(careerUserSkillNodeEvidence)
            .values(
              decision.evidenceIds.map((evidenceId) => ({
                userId: job.userId,
                nodeId: decision.targetNodeId,
                courseSkillEvidenceId: evidenceId,
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
            courseSkillEvidenceId: evidenceId,
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
        courseId: careerCourseSkillEvidence.courseId,
        chapterKeys: careerCourseSkillEvidence.chapterKeys,
        courseTitle: courses.title,
      })
      .from(careerUserSkillNodeEvidence)
      .innerJoin(
        careerCourseSkillEvidence,
        eq(careerUserSkillNodeEvidence.courseSkillEvidenceId, careerCourseSkillEvidence.id),
      )
      .innerJoin(courses, eq(careerCourseSkillEvidence.courseId, courses.id))
      .where(eq(careerUserSkillNodeEvidence.userId, job.userId));

    const snapshotTrees = resolvedTrees.map((tree) => {
      const supportingRows = nodeEvidenceRows.filter((row) =>
        tree.supportingNodeRefs.includes(row.nodeId),
      );
      const supportingCourses = [
        ...new Map(
          supportingRows.map((row) => [
            row.courseId,
            {
              courseId: row.courseId,
              title: row.courseTitle,
            },
          ]),
        ).values(),
      ];
      const supportingChapters = supportingRows.flatMap((row) =>
        (row.chapterKeys ?? []).map((chapterKey) => ({
          courseId: row.courseId,
          chapterKey,
          chapterIndex: parseChapterIndexFromKey(chapterKey),
          title: chapterKey,
        })),
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

      await markRunSucceeded(tx, composeRun.id, {
        recommendedDirectionHint: parsed.recommendedDirectionHint ?? null,
        trees: resolvedTrees,
      });
    });
  } catch (error) {
    await markRunFailed(composeRun.id, error);
    throw error;
  }
}
