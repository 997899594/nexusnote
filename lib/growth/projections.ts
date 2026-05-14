import type { ComposerVisibleNode } from "@/lib/growth/compose-shared";
import {
  CAREER_PROJECTION_SCHEMA_VERSION,
  CAREER_TREE_SCHEMA_VERSION,
} from "@/lib/growth/constants";
import type { FocusSnapshotPayload, ProfileSnapshotPayload } from "@/lib/growth/projection-types";
import type {
  CandidateCareerTree,
  CareerTreeSnapshot,
  GrowthNodeState,
  VisibleSkillTreeNode,
} from "@/lib/growth/types";
import { countVisibleTreeMetrics, getCurrentGrowthTree } from "@/lib/growth/view-model";
import { selectFocusTargetFromSnapshot } from "@/lib/knowledge/focus/selector";

export interface ProjectionHiddenNode {
  id: string;
  progress: number;
  state: string;
}

export interface ProjectionEvidenceRow {
  nodeId: string;
  evidenceId: string;
  sourceType: string;
  sourceId: string | null;
  sourceCourseTitle: string | null;
  refType: string | null;
  refId: string | null;
  refSnippet: string | null;
  refCourseTitle: string | null;
}

export interface ResolvedComposerTree {
  directionKey: string;
  keySeed?: string;
  matchPreviousDirectionKey?: string;
  title: string;
  summary: string;
  confidence: number;
  whyThisDirection: string;
  progressionRoles: CandidateCareerTree["progressionRoles"];
  supportingNodeRefs: string[];
  tree: ComposerVisibleNode[];
}

export interface GrowthProjectionArtifacts {
  snapshot: CareerTreeSnapshot;
  recommendedDirectionKey: string | null;
  focusTree: CandidateCareerTree | null;
  focusNode: VisibleSkillTreeNode | null;
  focusSummary: string | null;
  focusScore: number | null;
  focusPayload: FocusSnapshotPayload;
  profilePayload: ProfileSnapshotPayload;
}

export function buildComposeGraph(
  nodes: Array<{
    id: string;
    canonicalLabel: string;
    summary: string | null;
    progress: number;
    state: string;
    courseCount: number;
    chapterCount: number;
    evidenceScore: number;
  }>,
  edges: Array<{
    fromNodeId: string;
    toNodeId: string;
    confidence: string;
  }>,
  supportingRows: ProjectionEvidenceRow[] = [],
) {
  const semanticRefsByNodeId = buildNodeSemanticRefs(supportingRows);

  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      canonicalLabel: node.canonicalLabel,
      summary: node.summary,
      semanticRefs: semanticRefsByNodeId.get(node.id) ?? [],
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

function buildNodeSemanticRefs(rows: ProjectionEvidenceRow[]): Map<string, string[]> {
  const refsByNodeId = new Map<string, Set<string>>();

  for (const row of rows) {
    const refs = refsByNodeId.get(row.nodeId) ?? new Set<string>();
    if (row.refType === "chapter" && row.refId) {
      refs.add(`chapter:${row.sourceId ?? "unknown"}:${row.refId}`);
    }

    const normalizedSnippet = row.refSnippet?.replace(/\s+/g, " ").trim().toLowerCase();
    if (row.refType === "snippet" && normalizedSnippet && normalizedSnippet.length >= 4) {
      refs.add(`snippet:${normalizedSnippet}`);
    }

    refsByNodeId.set(row.nodeId, refs);
  }

  return new Map(
    [...refsByNodeId.entries()].map(([nodeId, refs]) => [
      nodeId,
      [...refs].sort((left, right) => left.localeCompare(right, "zh-Hans-CN")),
    ]),
  );
}

export function materializeTreeNodes(
  directionKey: string,
  nodes: ComposerVisibleNode[],
  nodeMap: Map<
    string,
    {
      id: string;
      progress: number;
      state: string;
    }
  >,
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
      state: (hiddenNode?.state as GrowthNodeState) ?? "ready",
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

export function parseChapterIndexFromKey(chapterKey: string): number {
  const match = /^chapter-(\d+)$/.exec(chapterKey);
  return match ? Number(match[1]) : 0;
}

interface ResolvedSupportingCourse {
  courseId: string;
  title: string;
}

interface ResolvedSupportingChapter {
  courseId: string;
  chapterKey: string;
  chapterIndex: number;
  title: string;
}

function buildNodeEvidenceMap(rows: ProjectionEvidenceRow[]): Map<string, string[]> {
  const nodeEvidenceMap = new Map<string, string[]>();

  for (const row of rows) {
    const existing = nodeEvidenceMap.get(row.nodeId) ?? [];
    if (existing.includes(row.evidenceId)) {
      continue;
    }

    existing.push(row.evidenceId);
    nodeEvidenceMap.set(row.nodeId, existing);
  }

  return nodeEvidenceMap;
}

function buildSupportingCourseByEvidenceId(
  rows: ProjectionEvidenceRow[],
): Map<string, ResolvedSupportingCourse> {
  const courseByEvidenceId = new Map<string, ResolvedSupportingCourse>();

  for (const row of rows) {
    const directCourseId = row.sourceType === "course" ? row.sourceId : null;
    const directTitle = row.sourceCourseTitle;
    const refCourseId = row.refType === "course" ? row.refId : null;
    const refTitle = row.refCourseTitle ?? row.refSnippet;
    const courseId = directCourseId ?? refCourseId;

    if (!courseId) {
      continue;
    }

    const existing = courseByEvidenceId.get(row.evidenceId);
    const resolvedTitle =
      directTitle ?? refTitle ?? existing?.title ?? row.sourceCourseTitle ?? "未命名课程";

    courseByEvidenceId.set(row.evidenceId, {
      courseId,
      title: resolvedTitle,
    });
  }

  return courseByEvidenceId;
}

function buildSupportingCourses(
  coursesByEvidenceId: Map<string, ResolvedSupportingCourse>,
): ResolvedSupportingCourse[] {
  return [
    ...new Map(
      [...coursesByEvidenceId.values()].map((course) => [course.courseId, course]),
    ).values(),
  ];
}

function buildSupportingChapters(params: {
  rows: ProjectionEvidenceRow[];
  coursesByEvidenceId: Map<string, ResolvedSupportingCourse>;
}): ResolvedSupportingChapter[] {
  const supportingChapterMap = new Map<string, ResolvedSupportingChapter>();

  for (const row of params.rows) {
    if (row.refType !== "chapter" || !row.refId) {
      continue;
    }

    const supportingCourse = params.coursesByEvidenceId.get(row.evidenceId);
    if (!supportingCourse) {
      continue;
    }

    const chapterKey = row.refId;
    supportingChapterMap.set(`${supportingCourse.courseId}:${chapterKey}`, {
      courseId: supportingCourse.courseId,
      chapterKey,
      chapterIndex: parseChapterIndexFromKey(chapterKey),
      title: row.refSnippet ?? chapterKey,
    });
  }

  return [...supportingChapterMap.values()];
}

function resolveRecommendedDirectionKey(params: {
  resolvedTrees: ResolvedComposerTree[];
  recommendedDirectionHint?: string | null;
  snapshotTrees: CandidateCareerTree[];
}): string | null {
  return (
    params.resolvedTrees.find(
      (tree) =>
        tree.keySeed === params.recommendedDirectionHint ||
        tree.matchPreviousDirectionKey === params.recommendedDirectionHint ||
        tree.directionKey === params.recommendedDirectionHint,
    )?.directionKey ??
    params.snapshotTrees[0]?.directionKey ??
    null
  );
}

export function buildGrowthSnapshotArtifacts(params: {
  resolvedTrees: ResolvedComposerTree[];
  recommendedDirectionHint?: string | null;
  selectedDirectionKey: string | null;
  hiddenNodes: ProjectionHiddenNode[];
  supportingRows: ProjectionEvidenceRow[];
  generatedAt?: string;
}): Pick<GrowthProjectionArtifacts, "snapshot" | "recommendedDirectionKey"> {
  const nodeMap = new Map(params.hiddenNodes.map((node) => [node.id, node]));
  const nodeEvidenceMap = buildNodeEvidenceMap(params.supportingRows);
  const snapshotTrees: CandidateCareerTree[] = params.resolvedTrees.map((tree) => {
    const supportingRows = params.supportingRows.filter((row) =>
      tree.supportingNodeRefs.includes(row.nodeId),
    );
    const supportingCoursesByEvidenceId = buildSupportingCourseByEvidenceId(supportingRows);
    const supportingCourses = buildSupportingCourses(supportingCoursesByEvidenceId);
    const supportingChapters = buildSupportingChapters({
      rows: supportingRows,
      coursesByEvidenceId: supportingCoursesByEvidenceId,
    });

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
    snapshotTrees,
  });

  const generatedAt = params.generatedAt ?? new Date().toISOString();

  return {
    snapshot: {
      schemaVersion: CAREER_TREE_SCHEMA_VERSION,
      status: "ready",
      recommendedDirectionKey,
      selectedDirectionKey: params.selectedDirectionKey,
      trees: snapshotTrees,
      generatedAt,
    },
    recommendedDirectionKey,
  };
}

export function buildGrowthViewProjectionArtifacts(
  snapshot: CareerTreeSnapshot,
): Omit<GrowthProjectionArtifacts, "snapshot"> {
  const focusSelection = selectFocusTargetFromSnapshot(snapshot);
  const focusTree = focusSelection.tree ?? getCurrentGrowthTree(snapshot);
  const focusNode = focusSelection.node;

  return {
    recommendedDirectionKey: snapshot.recommendedDirectionKey,
    focusTree,
    focusNode,
    focusSummary: focusSelection.summary,
    focusScore: focusSelection.score,
    focusPayload: {
      schemaVersion: CAREER_PROJECTION_SCHEMA_VERSION,
      directionKey: focusTree?.directionKey ?? null,
      treeTitle: focusTree?.title ?? null,
      whyThisDirection: focusTree?.whyThisDirection ?? null,
      node: focusNode,
      summary: focusSelection.summary,
      score: focusSelection.score,
    },
    profilePayload: {
      schemaVersion: CAREER_PROJECTION_SCHEMA_VERSION,
      recommendedDirectionKey: snapshot.recommendedDirectionKey,
      selectedDirectionKey: snapshot.selectedDirectionKey,
      treesCount: snapshot.trees.length,
      currentDirection: focusTree
        ? {
            directionKey: focusTree.directionKey,
            title: focusTree.title,
            summary: focusTree.summary,
            confidence: focusTree.confidence,
            whyThisDirection: focusTree.whyThisDirection,
            supportingCoursesCount: focusTree.supportingCourses.length,
            supportingChaptersCount: focusTree.supportingChapters.length,
          }
        : null,
      metrics: focusTree ? countVisibleTreeMetrics(focusTree.tree) : null,
      focus: focusNode,
    },
  };
}

export function buildGrowthProjectionArtifacts(params: {
  resolvedTrees: ResolvedComposerTree[];
  recommendedDirectionHint?: string | null;
  selectedDirectionKey: string | null;
  hiddenNodes: ProjectionHiddenNode[];
  supportingRows: ProjectionEvidenceRow[];
  generatedAt?: string;
}): GrowthProjectionArtifacts {
  const snapshotArtifacts = buildGrowthSnapshotArtifacts(params);
  const viewProjectionArtifacts = buildGrowthViewProjectionArtifacts(snapshotArtifacts.snapshot);

  return {
    snapshot: snapshotArtifacts.snapshot,
    recommendedDirectionKey: snapshotArtifacts.recommendedDirectionKey,
    focusTree: viewProjectionArtifacts.focusTree,
    focusNode: viewProjectionArtifacts.focusNode,
    focusSummary: viewProjectionArtifacts.focusSummary,
    focusScore: viewProjectionArtifacts.focusScore,
    focusPayload: viewProjectionArtifacts.focusPayload,
    profilePayload: viewProjectionArtifacts.profilePayload,
  };
}
