import type {
  CandidateCareerTree,
  CareerProgressionRole,
  CareerTreeSnapshot,
  VisibleSkillTreeNode,
} from "@/lib/growth/types";
import { getCurrentGrowthTree, getTreeByDirectionKey } from "@/lib/growth/view-model";

export interface CareerRoleNode {
  key: string;
  title: string;
  summary: string;
  confidence: number;
  horizon: "current" | CareerProgressionRole["horizon"];
  supportingCoursesCount: number;
  supportingChaptersCount: number;
  visibleNodeCount: number;
  evidenceRefsCount: number;
  isRecommended: boolean;
  isSelected: boolean;
}

export interface CareerDevelopmentGraph {
  currentCareer: CareerRoleNode;
  futureCareers: CareerRoleNode[];
  skillRoots: VisibleSkillTreeNode[];
  recommendedCareerKey: string | null;
  selectedCareerKey: string | null;
}

function flattenVisibleNodes(nodes: VisibleSkillTreeNode[]): VisibleSkillTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenVisibleNodes(node.children)]);
}

function toCareerRoleNode(tree: CandidateCareerTree, snapshot: CareerTreeSnapshot): CareerRoleNode {
  const visibleNodes = flattenVisibleNodes(tree.tree);

  return {
    key: tree.directionKey,
    title: tree.title,
    summary: tree.summary,
    confidence: tree.confidence,
    horizon: "current",
    supportingCoursesCount: tree.supportingCourses.length,
    supportingChaptersCount: tree.supportingChapters.length,
    visibleNodeCount: visibleNodes.length,
    evidenceRefsCount: visibleNodes.reduce(
      (total, node) => total + (node.evidenceRefs?.length ?? 0),
      0,
    ),
    isRecommended: tree.directionKey === snapshot.recommendedDirectionKey,
    isSelected: tree.directionKey === snapshot.selectedDirectionKey,
  };
}

function toFutureCareerRoleNode(
  role: CareerProgressionRole,
  tree: CandidateCareerTree,
): CareerRoleNode {
  const supportingNodeRefs = new Set(role.supportingNodeRefs);
  const visibleNodes = flattenVisibleNodes(tree.tree).filter((node) =>
    supportingNodeRefs.has(node.anchorRef),
  );

  return {
    key: role.id,
    title: role.title,
    summary: role.summary,
    confidence: role.confidence,
    horizon: role.horizon,
    supportingCoursesCount: tree.supportingCourses.length,
    supportingChaptersCount: tree.supportingChapters.length,
    visibleNodeCount: visibleNodes.length || role.supportingNodeRefs.length,
    evidenceRefsCount: visibleNodes.reduce(
      (total, node) => total + (node.evidenceRefs?.length ?? 0),
      0,
    ),
    isRecommended: false,
    isSelected: false,
  };
}

export function buildCareerDevelopmentGraph(
  snapshot: CareerTreeSnapshot,
  directionKey?: string | null,
): CareerDevelopmentGraph | null {
  const currentTree =
    getTreeByDirectionKey(snapshot, directionKey) ?? getCurrentGrowthTree(snapshot);

  if (!currentTree) {
    return null;
  }

  const currentCareer = toCareerRoleNode(currentTree, snapshot);
  const futureCareers = currentTree.progressionRoles.map((role) =>
    toFutureCareerRoleNode(role, currentTree),
  );

  return {
    currentCareer,
    futureCareers,
    skillRoots: currentTree.tree,
    recommendedCareerKey: snapshot.recommendedDirectionKey,
    selectedCareerKey: snapshot.selectedDirectionKey,
  };
}
