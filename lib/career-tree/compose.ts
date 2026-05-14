import { createHash } from "node:crypto";
import { generateText, Output } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
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
import { getModelNameForPolicy, getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { revalidateCareerTrees } from "@/lib/cache/tags";
import {
  CAREER_TREE_COMPOSE_PROMPT_VERSION,
  CAREER_TREE_COMPOSE_TIMEOUT_MS,
  CAREER_TREE_SCHEMA_VERSION,
  MAX_CAREER_TREES,
} from "@/lib/career-tree/constants";
import { getCareerGraphStateRow } from "@/lib/career-tree/graph-state";
import { getCareerTreePreference } from "@/lib/career-tree/preferences";
import {
  getOrCreateCareerRun,
  markCareerRunFailed,
  markCareerRunSucceeded,
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

interface ComposerVisibleNode {
  anchorRef: string;
  title: string;
  summary: string;
  children: ComposerVisibleNode[];
}

const composerVisibleNodeSchema: z.ZodType<ComposerVisibleNode> = z.lazy(() =>
  z.object({
    anchorRef: z.string().trim().min(1),
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    children: z.array(composerVisibleNodeSchema).default([]),
  }),
);

const composerTreeSchema = z.object({
  matchPreviousDirectionKey: z.string().trim().min(1).optional(),
  keySeed: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  whyThisDirection: z.string().trim().min(1),
  supportingNodeRefs: z.array(z.string().trim().min(1)).min(1),
  progressionRoles: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        title: z.string().trim().min(1),
        summary: z.string().trim().min(1),
        horizon: z.enum(["next", "later"]),
        confidence: z.number().min(0).max(1),
        supportingNodeRefs: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .max(3)
    .default([]),
  tree: z.array(composerVisibleNodeSchema).min(1),
});

const treeComposerOutputSchema = z.object({
  recommendedDirectionHint: z.string().trim().min(1).nullable().optional(),
  trees: z.array(composerTreeSchema).min(1).max(MAX_CAREER_TREES),
});

type TreeComposerOutput = z.infer<typeof treeComposerOutputSchema>;
type ResolvedComposerTree = z.infer<typeof composerTreeSchema> & { directionKey: string };

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

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug || "direction";
}

function collectAnchorRefs(nodes: ComposerVisibleNode[]): string[] {
  return nodes.flatMap((node) => [node.anchorRef, ...collectAnchorRefs(node.children)]);
}

function collectVisibleAnchorRefs(nodes: VisibleSkillTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.anchorRef, ...collectVisibleAnchorRefs(node.children)]);
}

function ensureUniqueValues(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Career compose returned duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function validateComposerOutput(params: {
  output: TreeComposerOutput;
  nodeIds: Set<string>;
  previousDirectionKeys: Set<string>;
}): TreeComposerOutput {
  ensureUniqueValues(
    params.output.trees.map((tree) => tree.keySeed),
    "keySeed",
  );

  for (const tree of params.output.trees) {
    if (
      tree.matchPreviousDirectionKey &&
      !params.previousDirectionKeys.has(tree.matchPreviousDirectionKey)
    ) {
      throw new Error(
        `Career compose returned invalid previous direction key: ${tree.matchPreviousDirectionKey}`,
      );
    }

    ensureUniqueValues(tree.supportingNodeRefs, `supporting refs for ${tree.keySeed}`);
    const supportingNodeRefs = new Set(tree.supportingNodeRefs);
    for (const nodeRef of tree.supportingNodeRefs) {
      if (!params.nodeIds.has(nodeRef)) {
        throw new Error(`Career compose returned unknown supporting node ref: ${nodeRef}`);
      }
    }

    const anchorRefs = collectAnchorRefs(tree.tree);
    ensureUniqueValues(anchorRefs, `anchor refs for ${tree.keySeed}`);
    const anchorRefSet = new Set(anchorRefs);
    for (const anchorRef of anchorRefs) {
      if (!params.nodeIds.has(anchorRef)) {
        throw new Error(`Career compose returned unknown anchor ref: ${anchorRef}`);
      }
      if (!supportingNodeRefs.has(anchorRef)) {
        throw new Error(`Career compose used anchorRef outside supporting refs: ${anchorRef}`);
      }
    }

    for (const role of tree.progressionRoles) {
      for (const nodeRef of role.supportingNodeRefs) {
        if (!anchorRefSet.has(nodeRef)) {
          throw new Error(`Career compose role ${role.id} references hidden node outside tree`);
        }
      }
    }
  }

  return params.output;
}

function resolveDirectionKeys(params: {
  trees: z.infer<typeof composerTreeSchema>[];
  previousDirectionKeys: Set<string>;
}): ResolvedComposerTree[] {
  const usedKeys = new Set<string>();

  return params.trees.map((tree) => {
    const inheritedKey =
      tree.matchPreviousDirectionKey &&
      params.previousDirectionKeys.has(tree.matchPreviousDirectionKey)
        ? tree.matchPreviousDirectionKey
        : null;
    const rawBaseKey = inheritedKey ?? slugify(tree.keySeed);
    let directionKey = rawBaseKey;
    let suffix = 2;

    while (usedKeys.has(directionKey)) {
      directionKey = `${slugify(tree.keySeed)}-${suffix}`;
      suffix += 1;
    }

    usedKeys.add(directionKey);
    return {
      ...tree,
      directionKey,
    };
  });
}

function sortTreesByPreference(params: {
  trees: ResolvedComposerTree[];
  selectedDirectionKey: string | null;
}): ResolvedComposerTree[] {
  return [...params.trees].sort((left, right) => {
    if (params.selectedDirectionKey) {
      if (left.directionKey === params.selectedDirectionKey) {
        return -1;
      }
      if (right.directionKey === params.selectedDirectionKey) {
        return 1;
      }
    }

    return 0;
  });
}

function resolveRecommendedDirectionKey(params: {
  resolvedTrees: ResolvedComposerTree[];
  recommendedDirectionHint: string | null;
}): string | null {
  return (
    params.resolvedTrees.find(
      (tree) =>
        tree.keySeed === params.recommendedDirectionHint ||
        tree.matchPreviousDirectionKey === params.recommendedDirectionHint ||
        tree.directionKey === params.recommendedDirectionHint,
    )?.directionKey ??
    params.resolvedTrees[0]?.directionKey ??
    null
  );
}

function materializeTreeNodes(
  directionKey: string,
  nodes: ComposerVisibleNode[],
  nodeMap: Map<string, ComposeGraphNode>,
  nodeEvidenceMap: Map<string, string[]>,
  pathPrefix = "0",
): VisibleSkillTreeNode[] {
  return nodes.map((node, index) => {
    const pathIndex = `${pathPrefix}-${index}`;
    const hiddenNode = nodeMap.get(node.anchorRef);

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
        pathIndex,
      ),
      evidenceRefs: nodeEvidenceMap.get(node.anchorRef) ?? undefined,
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
      progressionRoles: tree.progressionRoles,
      tree: materializeTreeNodes(tree.directionKey, tree.tree, nodeMap, nodeEvidenceMap),
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
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "career-tree:compose",
    intent: "career-tree-compose",
    workflow: "career-tree",
    modelPolicy: "outline-architect",
    promptVersion: CAREER_TREE_COMPOSE_PROMPT_VERSION,
    userId: params.userId,
    metadata: {
      nodeCount: params.nodes.length,
      edgeCount: params.edges.length,
      previousTreeCount: params.previousSnapshot?.trees.length ?? 0,
    },
  });

  try {
    const result = await generateText({
      model: getPlainModelForPolicy("outline-architect"),
      output: Output.object({ schema: treeComposerOutputSchema }),
      prompt: renderPromptResource("career-tree/compose.md", {
        compose_context: buildComposeContext(params),
      }),
      ...buildGenerationSettingsForPolicy("outline-architect", {
        temperature: 0.2,
        maxOutputTokens: 5_000,
      }),
      timeout: CAREER_TREE_COMPOSE_TIMEOUT_MS,
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

export async function processCareerTreeComposeJob(job: { userId: string }): Promise<void> {
  const eligibleCoursesExist = await hasEligibleCareerCourses(job.userId);
  if (!eligibleCoursesExist) {
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
  const composeRun = await getOrCreateCareerRun({
    userId: job.userId,
    kind: "compose",
    idempotencyKey: `compose:user:${job.userId}:graph:${graphVersion}:pref:${preference.preferenceVersion}:progress:${progressHash}:prompt:${CAREER_TREE_COMPOSE_PROMPT_VERSION}`,
    inputHash,
    model: getModelNameForPolicy("outline-architect"),
    promptVersion: CAREER_TREE_COMPOSE_PROMPT_VERSION,
    reuseCompleted: true,
  });

  if (composeRun.status === "succeeded") {
    const restoredSnapshot = await restoreLatestCareerTreeSnapshotForComposeRun({
      userId: job.userId,
      composeRunId: composeRun.id,
    });

    if (!restoredSnapshot) {
      throw new Error(
        `Career compose run ${composeRun.id} is completed but has no compatible snapshot`,
      );
    }

    revalidateCareerTrees(job.userId);
    return;
  }

  const previousSnapshot = latestSnapshot
    ? parseCareerTreeSnapshotPayload(latestSnapshot.payload)
    : null;

  try {
    const composed = await runCareerTreeComposer({
      userId: job.userId,
      nodes,
      edges,
      preference,
      previousSnapshot,
      supportingRows,
    });
    const previousDirectionKeys = new Set(
      previousSnapshot?.trees.map((tree) => tree.directionKey) ?? [],
    );
    const validated = validateComposerOutput({
      output: composed,
      nodeIds: new Set(nodes.map((node) => node.id)),
      previousDirectionKeys,
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

      await markCareerRunSucceeded(tx, composeRun.id, {
        recommendedDirectionHint: validated.recommendedDirectionHint ?? null,
        trees: resolvedTrees,
      });
    });

    revalidateCareerTrees(job.userId);
  } catch (error) {
    await markCareerRunFailed(composeRun.id, error);
    throw error;
  }
}
