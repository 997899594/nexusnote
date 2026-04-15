import type { ComposerVisibleNode } from "@/lib/growth/compose";
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
import {
  countVisibleTreeMetrics,
  findDefaultFocusNode,
  getCurrentGrowthTree,
} from "@/lib/growth/view-model";

export interface ProjectionHiddenNode {
  id: string;
  progress: number;
  state: string;
}

export interface ProjectionEvidenceRow {
  nodeId: string;
  sourceId: string | null;
  courseTitle: string | null;
  refType: string | null;
  refId: string | null;
}

export interface ResolvedComposerTree {
  directionKey: string;
  keySeed?: string;
  title: string;
  summary: string;
  confidence: number;
  whyThisDirection: string;
  supportingNodeRefs: string[];
  tree: ComposerVisibleNode[];
}

export interface GrowthProjectionArtifacts {
  snapshot: CareerTreeSnapshot;
  recommendedDirectionKey: string | null;
  focusTree: CandidateCareerTree | null;
  focusNode: VisibleSkillTreeNode | null;
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
      children: materializeTreeNodes(directionKey, node.children, nodeMap, pathIndex),
      evidenceRefs: undefined,
    };
  });
}

export function parseChapterIndexFromKey(chapterKey: string): number {
  const match = /^chapter-(\d+)$/.exec(chapterKey);
  return match ? Number(match[1]) : 0;
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
  const snapshotTrees: CandidateCareerTree[] = params.resolvedTrees.map((tree) => {
    const supportingRows = params.supportingRows.filter((row) =>
      tree.supportingNodeRefs.includes(row.nodeId),
    );
    const supportingCourses = [
      ...new Map(
        supportingRows
          .filter((row) => row.sourceId)
          .map((row) => [
            row.sourceId,
            {
              courseId: row.sourceId as string,
              title: row.courseTitle ?? "未命名课程",
            },
          ]),
      ).values(),
    ];
    const supportingChapters = [
      ...new Map(
        supportingRows
          .filter((row) => row.refType === "chapter" && row.sourceId && row.refId)
          .map((row) => [
            `${row.sourceId}:${row.refId}`,
            {
              courseId: row.sourceId as string,
              chapterKey: row.refId as string,
              chapterIndex: parseChapterIndexFromKey(row.refId as string),
              title: row.refId as string,
            },
          ]),
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
      tree: materializeTreeNodes(tree.directionKey, tree.tree, nodeMap),
    };
  });

  const recommendedDirectionKey =
    params.resolvedTrees.find(
      (tree) =>
        tree.keySeed === params.recommendedDirectionHint ||
        tree.directionKey === params.recommendedDirectionHint,
    )?.directionKey ??
    snapshotTrees[0]?.directionKey ??
    null;

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
  const focusTree = getCurrentGrowthTree(snapshot);
  const focusNode = focusTree ? findDefaultFocusNode(focusTree.tree) : null;

  return {
    recommendedDirectionKey: snapshot.recommendedDirectionKey,
    focusTree,
    focusNode,
    focusPayload: {
      schemaVersion: CAREER_PROJECTION_SCHEMA_VERSION,
      directionKey: focusTree?.directionKey ?? null,
      treeTitle: focusTree?.title ?? null,
      whyThisDirection: focusTree?.whyThisDirection ?? null,
      node: focusNode,
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
    focusPayload: viewProjectionArtifacts.focusPayload,
    profilePayload: viewProjectionArtifacts.profilePayload,
  };
}
