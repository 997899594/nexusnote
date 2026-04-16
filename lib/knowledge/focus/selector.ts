import type {
  CandidateCareerTree,
  CareerTreeSnapshot,
  GrowthNodeState,
  VisibleSkillTreeNode,
} from "@/lib/growth/types";

interface FocusCandidate {
  node: VisibleSkillTreeNode;
  depth: number;
  pathLabel: string;
  evidenceCount: number;
  actionableChildrenCount: number;
}

export interface FocusNodeSelection {
  node: VisibleSkillTreeNode | null;
  summary: string | null;
  score: number | null;
}

export interface FocusSelection extends FocusNodeSelection {
  tree: CandidateCareerTree | null;
}

const FOCUS_STATE_PRIORITY: GrowthNodeState[] = ["in_progress", "ready", "locked", "mastered"];

function getCurrentTree(snapshot: CareerTreeSnapshot): CandidateCareerTree | null {
  return (
    snapshot.trees.find((tree) => tree.directionKey === snapshot.selectedDirectionKey) ??
    snapshot.trees.find((tree) => tree.directionKey === snapshot.recommendedDirectionKey) ??
    snapshot.trees[0] ??
    null
  );
}

function collectCandidates(
  nodes: VisibleSkillTreeNode[],
  depth = 0,
  pathPrefix = "0",
): FocusCandidate[] {
  return nodes.flatMap((node, index) => {
    const pathLabel = `${pathPrefix}-${index}`;
    const actionableChildrenCount = node.children.filter(
      (child) => child.state !== "mastered",
    ).length;
    return [
      {
        node,
        depth,
        pathLabel,
        evidenceCount: node.evidenceRefs?.length ?? 0,
        actionableChildrenCount,
      },
      ...collectCandidates(node.children, depth + 1, pathLabel),
    ];
  });
}

function clampScore(value: number): number {
  return Math.round(Math.max(0, value));
}

function getStateBaseScore(state: GrowthNodeState): number {
  switch (state) {
    case "in_progress":
      return 120;
    case "ready":
      return 96;
    case "locked":
      return 54;
    case "mastered":
      return 18;
  }
}

function getProgressFitScore(state: GrowthNodeState, progress: number): number {
  switch (state) {
    case "in_progress":
      return Math.max(0, 34 - Math.abs(progress - 55) * 0.45);
    case "ready":
      return 16 + progress * 0.5;
    case "locked":
      return 10 + progress * 0.35;
    case "mastered":
      return Math.max(0, 12 - Math.abs(progress - 92) * 0.3);
  }
}

function getDepthFitScore(depth: number): number {
  return Math.max(0, 18 - Math.abs(depth - 2) * 6);
}

function scoreCandidate(candidate: FocusCandidate): number {
  const leafBonus =
    candidate.node.children.length === 0 ? 10 : Math.max(0, 8 - candidate.node.children.length * 2);
  const frontierBonus = Math.max(0, 8 - candidate.actionableChildrenCount * 2);
  const evidenceBonus = Math.min(candidate.evidenceCount * 6, 24);

  return clampScore(
    getStateBaseScore(candidate.node.state) +
      getProgressFitScore(candidate.node.state, candidate.node.progress) +
      getDepthFitScore(candidate.depth) +
      leafBonus +
      frontierBonus +
      evidenceBonus,
  );
}

function compareCandidates(left: FocusCandidate, right: FocusCandidate): number {
  const scoreDiff = scoreCandidate(right) - scoreCandidate(left);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  if (right.evidenceCount !== left.evidenceCount) {
    return right.evidenceCount - left.evidenceCount;
  }

  if (right.node.progress !== left.node.progress) {
    return right.node.progress - left.node.progress;
  }

  if (left.depth !== right.depth) {
    return left.depth - right.depth;
  }

  return left.pathLabel.localeCompare(right.pathLabel, "zh-Hans-CN");
}

function pickFocusPool(candidates: FocusCandidate[]): FocusCandidate[] {
  for (const state of FOCUS_STATE_PRIORITY) {
    const stateCandidates = candidates.filter((candidate) => candidate.node.state === state);
    if (stateCandidates.length > 0) {
      return stateCandidates;
    }
  }

  return candidates;
}

function buildFocusSummary(candidate: FocusCandidate): string {
  const evidenceCount = candidate.evidenceCount;
  const evidenceLabel = evidenceCount > 0 ? `，并且已经累积 ${evidenceCount} 条相关知识证据` : "";

  switch (candidate.node.state) {
    case "in_progress":
      return `这条能力分支已经进入推进阶段，当前进度 ${candidate.node.progress}%${evidenceLabel}，继续沿着它深挖最容易把现有学习沉淀成稳定能力。`;
    case "ready":
      return `这条能力分支已经被前置条件打开，当前进度 ${candidate.node.progress}%${evidenceLabel}，现在切进去最顺手，也最容易形成下一轮明显增长。`;
    case "locked":
      return `这条能力分支已经出现明确信号${evidenceLabel}，但还被前置链路卡住，优先围绕它补齐上游能力最划算。`;
    case "mastered":
      return `这条能力分支已经接近完成，当前进度 ${candidate.node.progress}%${evidenceLabel}，适合作为下一轮整理输出和巩固复盘的落点。`;
  }
}

export function selectFocusNodeFromNodes(nodes: VisibleSkillTreeNode[]): FocusNodeSelection {
  const candidates = collectCandidates(nodes);
  if (candidates.length === 0) {
    return {
      node: null,
      summary: null,
      score: null,
    };
  }

  const [selected] = pickFocusPool(candidates).sort(compareCandidates);
  return {
    node: selected?.node ?? null,
    summary: selected ? buildFocusSummary(selected) : null,
    score: selected ? scoreCandidate(selected) : null,
  };
}

export function selectFocusTargetFromSnapshot(snapshot: CareerTreeSnapshot): FocusSelection {
  const tree = getCurrentTree(snapshot);
  if (!tree) {
    return {
      tree: null,
      node: null,
      summary: null,
      score: null,
    };
  }

  const focus = selectFocusNodeFromNodes(tree.tree);
  return {
    tree,
    node: focus.node,
    summary: focus.summary,
    score: focus.score,
  };
}
