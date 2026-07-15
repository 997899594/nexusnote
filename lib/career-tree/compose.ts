import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  careerCourseChapterEvidence,
  careerCourseSkillEvidence,
  careerUserSkillEdges,
  careerUserSkillNodeEvidence,
  careerUserSkillNodes,
  careerUserTreeSnapshots,
  courses,
  db,
} from "@/db";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { generateStructuredObject } from "@/lib/ai/core/structured-output";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import {
  type ComposerVisibleNode,
  collectVisibleAnchorRefs,
  type ResolvedComposerProgressionRole,
  type ResolvedComposerTree,
  resolveDirectionKeys,
  resolveRecommendedDirectionKey,
  sanitizePreviousSnapshotForCompose,
  sortTreesByPreference,
  type TreeComposerOutput,
  treeComposerOutputSchema,
  validateComposerOutput,
} from "@/lib/career-tree/compose-output";
import {
  CAREER_TREE_COMPOSE_PROMPT_VERSION,
  CAREER_TREE_COMPOSE_TIMEOUT_MS,
  CAREER_TREE_SCHEMA_VERSION,
} from "@/lib/career-tree/constants";
import { getCareerGraphStateRow } from "@/lib/career-tree/graph-state";
import {
  CAREER_TREE_COMPOSE_MODEL_CANDIDATES,
  getCareerTreeRunModelName,
} from "@/lib/career-tree/model-candidates";
import {
  logCareerTreePipelineEvent,
  logCareerTreePipelineSkip,
} from "@/lib/career-tree/pipeline-log";
import { getCareerTreePreference } from "@/lib/career-tree/preferences";
import { isRealisticProgressionRoleTitle } from "@/lib/career-tree/realistic-roles";
import {
  acquireCareerRun,
  type CareerRunFailureOptions,
  markCareerRunFailed,
  markCareerRunSucceeded,
  startCareerRunLeaseHeartbeat,
} from "@/lib/career-tree/runs";
import {
  getLatestCareerTreeSnapshotRow,
  parseCareerTreeSnapshotPayload,
  restoreLatestCareerTreeSnapshotForComposeRun,
} from "@/lib/career-tree/snapshot";
import {
  computeCourseProgressHash,
  getCareerCourseProgressMap,
  hasEligibleCareerCourses,
} from "@/lib/career-tree/source";
import {
  type CandidateCareerTree,
  type CareerNodeState,
  type CareerTreeSnapshot,
  careerTreeSnapshotSchema,
  type VisibleSkillTreeNode,
} from "@/lib/career-tree/types";

interface ComposeGraphNode {
  id: string;
  canonicalLabel: string;
  displayHint: string | null;
  summary: string | null;
  kind: string;
  state: string;
  progress: number;
  masteryScore: number;
  evidenceScore: number;
  courseCount: number;
  chapterCount: number;
}

interface SupportingEvidenceRow {
  nodeId: string;
  evidenceId: string;
  courseId: string;
  courseTitle: string;
  chapterRefs: string[];
}

function materializeTreeNodes(
  directionKey: string,
  nodes: ComposerVisibleNode[],
  nodeMap: Map<string, ComposeGraphNode>,
  nodeEvidenceMap: Map<string, string[]>,
  supportingRowsByNodeId: Map<string, SupportingEvidenceRow[]>,
  chapterTitleByKey: Map<string, { chapterIndex: number; title: string }>,
  pathPrefix = "0",
): VisibleSkillTreeNode[] {
  return nodes.map((node, index) => {
    const pathIndex = `${pathPrefix}-${index}`;
    const hiddenNode = nodeMap.get(node.anchorRef);
    const supportingRows = supportingRowsByNodeId.get(node.anchorRef) ?? [];

    return {
      id: `${directionKey}:${node.anchorRef}:${pathIndex}`,
      anchorRef: node.anchorRef,
      title: node.title,
      summary: node.summary,
      progress: hiddenNode?.progress ?? 0,
      state: (hiddenNode?.state as CareerNodeState | undefined) ?? "ready",
      children: materializeTreeNodes(
        directionKey,
        node.children,
        nodeMap,
        nodeEvidenceMap,
        supportingRowsByNodeId,
        chapterTitleByKey,
        pathIndex,
      ),
      evidenceRefs: nodeEvidenceMap.get(node.anchorRef) ?? undefined,
      supportingCourses: resolveNodeSupportingCourses(supportingRows),
      supportingChapters: resolveNodeSupportingChapters(supportingRows, chapterTitleByKey),
    };
  });
}

function buildNodeEvidenceMap(rows: SupportingEvidenceRow[]): Map<string, string[]> {
  const nodeEvidenceMap = new Map<string, string[]>();

  for (const row of rows) {
    const refs = nodeEvidenceMap.get(row.nodeId) ?? [];
    if (!refs.includes(row.evidenceId)) {
      refs.push(row.evidenceId);
    }
    nodeEvidenceMap.set(row.nodeId, refs);
  }

  return nodeEvidenceMap;
}

function filterRealisticProgressionRoles(
  roles: ResolvedComposerTree["progressionRoles"],
): ResolvedComposerProgressionRole[] {
  const seen = new Set<string>();

  return roles
    .filter((role) => isRealisticProgressionRoleTitle(role.title))
    .filter((role) => {
      const normalizedTitle = role.title
        .replace(/[（(].*?[）)]/gu, "")
        .replace(/\s+/g, "")
        .toLowerCase();

      if (seen.has(normalizedTitle)) {
        return false;
      }

      seen.add(normalizedTitle);
      return true;
    })
    .slice(0, 3);
}

function buildSupportingRowsByNodeId(
  rows: SupportingEvidenceRow[],
): Map<string, SupportingEvidenceRow[]> {
  const rowsByNodeId = new Map<string, SupportingEvidenceRow[]>();

  for (const row of rows) {
    rowsByNodeId.set(row.nodeId, [...(rowsByNodeId.get(row.nodeId) ?? []), row]);
  }

  return rowsByNodeId;
}

function resolveNodeSupportingCourses(rows: SupportingEvidenceRow[]) {
  return [
    ...new Map(
      rows.map((row) => [
        row.courseId,
        {
          courseId: row.courseId,
          title: row.courseTitle,
        },
      ]),
    ).values(),
  ];
}

function resolveNodeSupportingChapters(
  rows: SupportingEvidenceRow[],
  chapterTitleByKey: Map<string, { chapterIndex: number; title: string }>,
) {
  return [
    ...new Map(
      rows.flatMap((row) =>
        row.chapterRefs.map((chapterKey) => {
          const chapter = chapterTitleByKey.get(`${row.courseId}:${chapterKey}`);
          return [
            `${row.courseId}:${chapterKey}`,
            {
              courseId: row.courseId,
              chapterKey,
              chapterIndex: chapter?.chapterIndex ?? 0,
              title: chapter?.title ?? chapterKey,
            },
          ] as const;
        }),
      ),
    ).values(),
  ];
}

function buildSnapshotPayload(params: {
  resolvedTrees: ResolvedComposerTree[];
  recommendedDirectionHint: string | null;
  selectedDirectionKey: string | null;
  nodes: ComposeGraphNode[];
  supportingRows: SupportingEvidenceRow[];
  chapterTitleByKey: Map<string, { chapterIndex: number; title: string }>;
}): {
  snapshot: CareerTreeSnapshot;
  recommendedDirectionKey: string | null;
} {
  const nodeMap = new Map(params.nodes.map((node) => [node.id, node]));
  const nodeEvidenceMap = buildNodeEvidenceMap(params.supportingRows);
  const supportingRowsByNodeId = buildSupportingRowsByNodeId(params.supportingRows);
  const snapshotTrees: CandidateCareerTree[] = params.resolvedTrees.map((tree) => {
    const supportingRows = params.supportingRows.filter((row) =>
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
    const supportingChapters = [
      ...new Map(
        supportingRows.flatMap((row) =>
          row.chapterRefs.map((chapterKey) => {
            const chapter = params.chapterTitleByKey.get(`${row.courseId}:${chapterKey}`);
            return [
              `${row.courseId}:${chapterKey}`,
              {
                courseId: row.courseId,
                chapterKey,
                chapterIndex: chapter?.chapterIndex ?? 0,
                title: chapter?.title ?? chapterKey,
              },
            ] as const;
          }),
        ),
      ).values(),
    ];

    return {
      directionKey: tree.directionKey,
      title: tree.title,
      summary: tree.summary,
      confidence: tree.confidence,
      whyThisDirection: tree.whyThisDirection,
      supportingCourses,
      supportingChapters,
      progressionRoles: filterRealisticProgressionRoles(tree.progressionRoles),
      tree: materializeTreeNodes(
        tree.directionKey,
        tree.tree,
        nodeMap,
        nodeEvidenceMap,
        supportingRowsByNodeId,
        params.chapterTitleByKey,
      ),
    };
  });
  const recommendedDirectionKey = resolveRecommendedDirectionKey({
    resolvedTrees: params.resolvedTrees,
    recommendedDirectionHint: params.recommendedDirectionHint,
  });

  return {
    snapshot: {
      schemaVersion: CAREER_TREE_SCHEMA_VERSION,
      status: "ready",
      recommendedDirectionKey,
      selectedDirectionKey: params.selectedDirectionKey,
      trees: snapshotTrees,
      generatedAt: new Date().toISOString(),
    },
    recommendedDirectionKey,
  };
}

function buildComposeContext(params: {
  nodes: ComposeGraphNode[];
  edges: Array<typeof careerUserSkillEdges.$inferSelect>;
  preference: Awaited<ReturnType<typeof getCareerTreePreference>>;
  previousSnapshot: CareerTreeSnapshot | null;
  supportingRows: SupportingEvidenceRow[];
}): string {
  const evidenceCountByNodeId = new Map<string, number>();
  const coursesByNodeId = new Map<string, Set<string>>();

  for (const row of params.supportingRows) {
    evidenceCountByNodeId.set(row.nodeId, (evidenceCountByNodeId.get(row.nodeId) ?? 0) + 1);
    const courses = coursesByNodeId.get(row.nodeId) ?? new Set<string>();
    courses.add(row.courseTitle);
    coursesByNodeId.set(row.nodeId, courses);
  }

  return JSON.stringify(
    {
      graph: {
        nodes: params.nodes.map((node) => ({
          id: node.id,
          canonicalLabel: node.canonicalLabel,
          displayHint: node.displayHint,
          summary: node.summary,
          kind: node.kind,
          state: node.state,
          progress: node.progress,
          masteryScore: node.masteryScore,
          evidenceScore: node.evidenceScore,
          courseCount: node.courseCount,
          chapterCount: node.chapterCount,
          evidenceCount: evidenceCountByNodeId.get(node.id) ?? 0,
          supportingCourseTitles: [...(coursesByNodeId.get(node.id) ?? [])].slice(0, 6),
        })),
        edges: params.edges.map((edge) => ({
          from: edge.fromNodeId,
          to: edge.toNodeId,
          type: edge.edgeType,
          confidence: Number(edge.confidence),
        })),
      },
      preference: params.preference,
      previousSnapshot: params.previousSnapshot
        ? {
            recommendedDirectionKey: params.previousSnapshot.recommendedDirectionKey,
            selectedDirectionKey: params.previousSnapshot.selectedDirectionKey,
            trees: params.previousSnapshot.trees.map((tree) => ({
              directionKey: tree.directionKey,
              title: tree.title,
              summary: tree.summary,
              supportingNodeRefs: [...new Set(collectVisibleAnchorRefs(tree.tree))],
            })),
          }
        : null,
    },
    null,
    2,
  );
}

async function loadComposeSupportRows(userId: string): Promise<{
  rows: SupportingEvidenceRow[];
  chapterTitleByKey: Map<string, { chapterIndex: number; title: string }>;
  progressHash: string;
}> {
  const rows = await db
    .select({
      nodeId: careerUserSkillNodeEvidence.nodeId,
      evidenceId: careerCourseSkillEvidence.id,
      courseId: careerCourseSkillEvidence.courseId,
      courseTitle: courses.title,
      chapterRefs: careerCourseSkillEvidence.chapterRefs,
    })
    .from(careerUserSkillNodeEvidence)
    .innerJoin(
      careerCourseSkillEvidence,
      eq(careerUserSkillNodeEvidence.courseSkillEvidenceId, careerCourseSkillEvidence.id),
    )
    .innerJoin(courses, eq(careerCourseSkillEvidence.courseId, courses.id))
    .where(eq(careerUserSkillNodeEvidence.userId, userId));

  const courseIds = [...new Set(rows.map((row) => row.courseId))];
  const progressHash = computeCourseProgressHash(
    await getCareerCourseProgressMap(userId, courseIds),
  );
  const chapterRows =
    courseIds.length > 0
      ? await db
          .select({
            courseId: careerCourseChapterEvidence.courseId,
            chapterKey: careerCourseChapterEvidence.chapterKey,
            chapterIndex: careerCourseChapterEvidence.chapterIndex,
            title: careerCourseChapterEvidence.chapterTitle,
          })
          .from(careerCourseChapterEvidence)
          .where(inArray(careerCourseChapterEvidence.courseId, courseIds))
      : [];

  return {
    rows,
    chapterTitleByKey: new Map(
      chapterRows.map((chapter) => [
        `${chapter.courseId}:${chapter.chapterKey}`,
        {
          chapterIndex: chapter.chapterIndex,
          title: chapter.title,
        },
      ]),
    ),
    progressHash,
  };
}

async function runCareerTreeComposer(params: {
  userId: string;
  nodes: ComposeGraphNode[];
  edges: Array<typeof careerUserSkillEdges.$inferSelect>;
  preference: Awaited<ReturnType<typeof getCareerTreePreference>>;
  previousSnapshot: CareerTreeSnapshot | null;
  supportingRows: SupportingEvidenceRow[];
}): Promise<TreeComposerOutput> {
  let lastError: unknown = null;

  for (const [index, candidate] of CAREER_TREE_COMPOSE_MODEL_CANDIDATES.entries()) {
    const telemetry = createTelemetryContext({
      endpoint: "career-tree:compose",
      intent: "career-tree-compose",
      workflow: "career-tree",
      modelPolicy: "outline-architect",
      modelSeries: candidate.modelSeries,
      promptVersion: CAREER_TREE_COMPOSE_PROMPT_VERSION,
      userId: params.userId,
      metadata: {
        nodeCount: params.nodes.length,
        edgeCount: params.edges.length,
        previousTreeCount: params.previousSnapshot?.trees.length ?? 0,
        candidate: candidate.label,
        fallbackAttempt: index,
      },
    });

    const attemptStartedAt = Date.now();
    try {
      const result = await generateStructuredObject({
        model: getPlainModelForPolicy("outline-architect", {
          modelSeries: candidate.modelSeries,
        }),
        schema: treeComposerOutputSchema,
        name: "careerTreeSnapshot",
        description: "用户职业方向树候选结果",
        prompt: renderPromptResource("career-tree/compose.md", {
          compose_context: buildComposeContext(params),
        }),
        ...buildGenerationSettingsForPolicy(
          "outline-architect",
          {
            temperature: 0.2,
            maxOutputTokens: 8_000,
          },
          {
            modelSeries: candidate.modelSeries,
          },
        ),
        timeout: CAREER_TREE_COMPOSE_TIMEOUT_MS,
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

  throw lastError ?? new Error("Career tree compose failed without an error");
}

function buildComposeInputHash(params: {
  graphVersion: number;
  preferenceVersion: number;
  progressHash: string;
  nodeIds: string[];
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        graphVersion: params.graphVersion,
        preferenceVersion: params.preferenceVersion,
        progressHash: params.progressHash,
        nodeIds: [...params.nodeIds].sort(),
        promptVersion: CAREER_TREE_COMPOSE_PROMPT_VERSION,
      }),
    )
    .digest("hex");
}

export async function processCareerTreeComposeJob(job: {
  userId: string;
  requestKey?: string;
  failure?: CareerRunFailureOptions;
}): Promise<void> {
  logCareerTreePipelineEvent("career_tree_pipeline_started", {
    stage: "compose",
    userId: job.userId,
    requestKey: job.requestKey ?? null,
  });
  const eligibleCoursesExist = await hasEligibleCareerCourses(job.userId);
  if (!eligibleCoursesExist) {
    logCareerTreePipelineSkip({
      stage: "compose",
      reason: "no_eligible_courses",
      userId: job.userId,
      requestKey: job.requestKey ?? null,
    });
    return;
  }

  const [graphState, preference, nodes, edges, latestSnapshot] = await Promise.all([
    getCareerGraphStateRow(job.userId),
    getCareerTreePreference(job.userId),
    db.select().from(careerUserSkillNodes).where(eq(careerUserSkillNodes.userId, job.userId)),
    db.select().from(careerUserSkillEdges).where(eq(careerUserSkillEdges.userId, job.userId)),
    getLatestCareerTreeSnapshotRow(job.userId),
  ]);

  if (nodes.length === 0) {
    logCareerTreePipelineSkip({
      stage: "compose",
      reason: "skill_graph_has_no_nodes",
      userId: job.userId,
      requestKey: job.requestKey ?? null,
      graphVersion: graphState?.graphVersion ?? 0,
    });
    return;
  }

  const {
    rows: supportingRows,
    chapterTitleByKey,
    progressHash,
  } = await loadComposeSupportRows(job.userId);
  const graphVersion = graphState?.graphVersion ?? 0;
  const inputHash = buildComposeInputHash({
    graphVersion,
    preferenceVersion: preference.preferenceVersion,
    progressHash,
    nodeIds: nodes.map((node) => node.id),
  });
  const model = getCareerTreeRunModelName("compose");
  const acquisition = await acquireCareerRun({
    userId: job.userId,
    kind: "compose",
    idempotencyKey: `compose:user:${job.userId}:graph:${graphVersion}:pref:${preference.preferenceVersion}:progress:${progressHash}:prompt:${CAREER_TREE_COMPOSE_PROMPT_VERSION}:model:${model}`,
    inputHash,
    model,
    promptVersion: CAREER_TREE_COMPOSE_PROMPT_VERSION,
    reuseCompleted: true,
  });
  const composeRun = acquisition.run;

  if (acquisition.state === "completed") {
    const restoredSnapshot = await restoreLatestCareerTreeSnapshotForComposeRun({
      userId: job.userId,
      composeRunId: composeRun.id,
    });

    if (!restoredSnapshot) {
      throw new Error(
        `Career compose run ${composeRun.id} is completed but has no current snapshot`,
      );
    }

    logCareerTreePipelineEvent("career_tree_pipeline_succeeded", {
      stage: "compose",
      userId: job.userId,
      requestKey: job.requestKey ?? null,
      runId: composeRun.id,
      reused: true,
      snapshotId: restoredSnapshot.id,
    });
    return;
  }

  if (acquisition.state === "busy") {
    logCareerTreePipelineSkip({
      stage: "compose",
      reason: "run_lease_held",
      userId: job.userId,
      requestKey: job.requestKey ?? null,
      runId: composeRun.id,
    });
    return;
  }

  const stopLeaseHeartbeat = startCareerRunLeaseHeartbeat({
    runId: composeRun.id,
    fencingToken: acquisition.fencingToken,
  });

  try {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const previousSnapshot = latestSnapshot
      ? parseCareerTreeSnapshotPayload(latestSnapshot.payload)
      : null;
    const sanitizedPreviousSnapshot = sanitizePreviousSnapshotForCompose(previousSnapshot, nodeIds);
    const composed = await runCareerTreeComposer({
      userId: job.userId,
      nodes,
      edges,
      preference,
      previousSnapshot: sanitizedPreviousSnapshot,
      supportingRows,
    });
    const previousDirectionKeys = new Set(
      sanitizedPreviousSnapshot?.trees.map((tree) => tree.directionKey) ?? [],
    );
    const validated = validateComposerOutput({
      output: composed,
      nodeIds,
      previousDirectionKeys,
      userId: job.userId,
      runId: composeRun.id,
    });
    const resolvedTrees = sortTreesByPreference({
      trees: resolveDirectionKeys({
        trees: validated.trees,
        previousDirectionKeys,
      }),
      selectedDirectionKey: preference.selectedDirectionKey,
    });
    const { snapshot, recommendedDirectionKey } = buildSnapshotPayload({
      resolvedTrees,
      recommendedDirectionHint: validated.recommendedDirectionHint ?? null,
      selectedDirectionKey: preference.selectedDirectionKey,
      nodes,
      supportingRows,
      chapterTitleByKey,
    });
    const parsedSnapshot = careerTreeSnapshotSchema.parse(snapshot);

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
        graphVersion,
        preferenceVersion: preference.preferenceVersion,
        payload: parsedSnapshot,
        isLatest: true,
        generatedAt: new Date(),
      });

      await markCareerRunSucceeded(tx, composeRun.id, acquisition.fencingToken, {
        recommendedDirectionHint: validated.recommendedDirectionHint ?? null,
        trees: resolvedTrees,
      });
    });
    logCareerTreePipelineEvent("career_tree_pipeline_succeeded", {
      stage: "compose",
      userId: job.userId,
      requestKey: job.requestKey ?? null,
      runId: composeRun.id,
      reused: false,
      graphVersion,
      treeCount: resolvedTrees.length,
      nodeCount: nodes.length,
      supportingEvidenceCount: supportingRows.length,
      recommendedDirectionKey,
    });
  } catch (error) {
    await markCareerRunFailed(composeRun.id, acquisition.fencingToken, error, job.failure);
    throw error;
  } finally {
    stopLeaseHeartbeat();
  }
}
