import type {
  CurrentDirectionProjection,
  FocusSnapshotProjection,
  ProfileSnapshotProjection,
  VisibleTreeMetrics,
} from "@/lib/growth/projection-types";
import type {
  CandidateCareerTree,
  CareerTreeSnapshot,
  VisibleSkillTreeNode,
} from "@/lib/growth/types";
import { selectFocusNodeFromNodes } from "@/lib/knowledge/focus/selector";

export interface FocusNodeReference {
  id?: string | null;
  anchorRef?: string | null;
}

export interface ResolvedGrowthDisplayState {
  currentTree: CandidateCareerTree;
  displayDirection: CurrentDirectionProjection;
  metrics: VisibleTreeMetrics;
  preferredFocusNode: VisibleSkillTreeNode | null;
}

function findNode(
  nodes: VisibleSkillTreeNode[],
  matcher: (node: VisibleSkillTreeNode) => boolean,
): VisibleSkillTreeNode | null {
  for (const node of nodes) {
    if (matcher(node)) {
      return node;
    }

    const child = findNode(node.children, matcher);
    if (child) {
      return child;
    }
  }

  return null;
}

export function flattenVisibleNodes(nodes: VisibleSkillTreeNode[]): VisibleSkillTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenVisibleNodes(node.children)]);
}

export function getTreeByDirectionKey(
  snapshot: CareerTreeSnapshot,
  directionKey: string | null | undefined,
): CandidateCareerTree | null {
  if (!directionKey) {
    return null;
  }

  return snapshot.trees.find((tree) => tree.directionKey === directionKey) ?? null;
}

export function getCurrentGrowthTree(snapshot: CareerTreeSnapshot): CandidateCareerTree | null {
  return (
    getTreeByDirectionKey(snapshot, snapshot.selectedDirectionKey) ??
    getTreeByDirectionKey(snapshot, snapshot.recommendedDirectionKey) ??
    snapshot.trees[0] ??
    null
  );
}

export function countVisibleTreeMetrics(nodes: VisibleSkillTreeNode[]): VisibleTreeMetrics {
  const flattened = flattenVisibleNodes(nodes);
  if (flattened.length === 0) {
    return {
      total: 0,
      mastered: 0,
      inProgress: 0,
      ready: 0,
      locked: 0,
      averageProgress: 0,
    };
  }

  let mastered = 0;
  let inProgress = 0;
  let ready = 0;
  let locked = 0;
  let progressSum = 0;

  for (const node of flattened) {
    progressSum += node.progress;
    switch (node.state) {
      case "mastered":
        mastered += 1;
        break;
      case "in_progress":
        inProgress += 1;
        break;
      case "ready":
        ready += 1;
        break;
      case "locked":
        locked += 1;
        break;
    }
  }

  return {
    total: flattened.length,
    mastered,
    inProgress,
    ready,
    locked,
    averageProgress: Math.round(progressSum / flattened.length),
  };
}

export function findNodeById(
  nodes: VisibleSkillTreeNode[],
  nodeId: string | null | undefined,
): VisibleSkillTreeNode | null {
  if (!nodeId) {
    return null;
  }

  return findNode(nodes, (node) => node.id === nodeId);
}

export function findNodeByAnchorRef(
  nodes: VisibleSkillTreeNode[],
  anchorRef: string | null | undefined,
): VisibleSkillTreeNode | null {
  if (!anchorRef) {
    return null;
  }

  return findNode(nodes, (node) => node.anchorRef === anchorRef);
}

export function resolveProjectedFocusNode(
  nodes: VisibleSkillTreeNode[],
  reference: FocusNodeReference | null | undefined,
): VisibleSkillTreeNode | null {
  if (!reference) {
    return null;
  }

  return (
    findNodeById(nodes, reference.id ?? null) ??
    findNodeByAnchorRef(nodes, reference.anchorRef ?? null)
  );
}

export function findDefaultFocusNode(nodes: VisibleSkillTreeNode[]): VisibleSkillTreeNode | null {
  return selectFocusNodeFromNodes(nodes).node;
}

function buildFallbackCurrentDirection(tree: CandidateCareerTree): CurrentDirectionProjection {
  return {
    directionKey: tree.directionKey,
    title: tree.title,
    summary: tree.summary,
    confidence: tree.confidence,
    whyThisDirection: tree.whyThisDirection,
    supportingCoursesCount: tree.supportingCourses.length,
    supportingChaptersCount: tree.supportingChapters.length,
  };
}

function resolveProjectedFocusReference(
  focusSnapshot: FocusSnapshotProjection | null,
): FocusNodeReference | null {
  if (!focusSnapshot) {
    return null;
  }

  return (
    focusSnapshot.node ?? {
      id: focusSnapshot.nodeId,
      anchorRef: focusSnapshot.anchorRef,
    }
  );
}

export function resolveGrowthDisplayState(params: {
  snapshot: CareerTreeSnapshot;
  directionKey?: string | null;
  focusSnapshot: FocusSnapshotProjection | null;
  profileSnapshot: ProfileSnapshotProjection | null;
}): ResolvedGrowthDisplayState | null {
  const currentTree =
    getTreeByDirectionKey(params.snapshot, params.directionKey) ??
    getCurrentGrowthTree(params.snapshot);

  if (!currentTree) {
    return null;
  }

  const alignedProfileDirection =
    params.profileSnapshot?.currentDirection?.directionKey === currentTree.directionKey
      ? params.profileSnapshot.currentDirection
      : null;
  const alignedProfileFocus = alignedProfileDirection
    ? (params.profileSnapshot?.focus ?? null)
    : null;
  const alignedFocusSnapshot =
    params.focusSnapshot?.directionKey === currentTree.directionKey ? params.focusSnapshot : null;

  return {
    currentTree,
    displayDirection: alignedProfileDirection ?? buildFallbackCurrentDirection(currentTree),
    metrics:
      alignedProfileDirection && params.profileSnapshot?.metrics
        ? params.profileSnapshot.metrics
        : countVisibleTreeMetrics(currentTree.tree),
    preferredFocusNode:
      resolveProjectedFocusNode(
        currentTree.tree,
        alignedProfileFocus ?? resolveProjectedFocusReference(alignedFocusSnapshot),
      ) ?? findDefaultFocusNode(currentTree.tree),
  };
}
