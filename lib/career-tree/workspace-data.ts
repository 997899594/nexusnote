import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getCareerTreesTag, getNotesIndexTag, getProfileStatsTag } from "@/lib/cache/tags";
import type {
  FocusSnapshotProjection,
  ProfileSnapshotProjection,
} from "@/lib/career-tree/projection-types";
import { getCareerTreeSnapshot } from "@/lib/career-tree/snapshot";
import type { CareerTreeSnapshot } from "@/lib/career-tree/types";
import { countVisibleTreeMetrics, getCurrentCareerTree } from "@/lib/career-tree/view-model";
import { selectFocusTargetFromSnapshot } from "@/lib/knowledge/focus/selector";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import { listUserKnowledgeInsights } from "@/lib/knowledge/insights";

export interface CareerTreeWorkspaceData {
  snapshot: CareerTreeSnapshot;
  focusSnapshot: FocusSnapshotProjection | null;
  profileSnapshot: ProfileSnapshotProjection | null;
  insights: KnowledgeInsight[];
}

function applyCareerTreeWorkspaceCacheTags(userId: string): void {
  cacheLife("minutes");
  cacheTag(getCareerTreesTag(userId));
  cacheTag(getProfileStatsTag(userId));
  cacheTag(getNotesIndexTag(userId));
}

async function loadCareerTreeWorkspaceData(
  userId: string,
  insightLimit: number,
): Promise<CareerTreeWorkspaceData> {
  const [snapshot, insights] = await Promise.all([
    getCareerTreeSnapshot(userId),
    listUserKnowledgeInsights(userId, insightLimit),
  ]);
  const currentTree = getCurrentCareerTree(snapshot);
  const focusSelection = selectFocusTargetFromSnapshot(snapshot);
  const focusSnapshot =
    currentTree && focusSelection.node
      ? {
          directionKey: currentTree.directionKey,
          nodeId: focusSelection.node.id,
          anchorRef: focusSelection.node.anchorRef,
          title: focusSelection.node.title,
          summary: focusSelection.summary ?? focusSelection.node.summary,
          progress: focusSelection.node.progress,
          state: focusSelection.node.state,
          whyThisDirection: currentTree.whyThisDirection,
          score: focusSelection.score,
          node: focusSelection.node,
        }
      : null;
  const currentDirection = currentTree
    ? {
        directionKey: currentTree.directionKey,
        title: currentTree.title,
        summary: currentTree.summary,
        confidence: currentTree.confidence,
        whyThisDirection: currentTree.whyThisDirection,
        supportingCoursesCount: currentTree.supportingCourses.length,
        supportingChaptersCount: currentTree.supportingChapters.length,
      }
    : null;
  const profileSnapshot: ProfileSnapshotProjection | null = currentTree
    ? {
        recommendedDirectionKey: snapshot.recommendedDirectionKey,
        selectedDirectionKey: snapshot.selectedDirectionKey,
        treesCount: snapshot.trees.length,
        currentDirection,
        metrics: countVisibleTreeMetrics(currentTree.tree),
        focus: focusSnapshot?.node ?? null,
      }
    : null;

  return {
    snapshot,
    focusSnapshot,
    profileSnapshot,
    insights,
  };
}

export async function getCareerTreeWorkspaceDataCached(
  userId: string,
  insightLimit = 4,
): Promise<CareerTreeWorkspaceData> {
  "use cache";

  applyCareerTreeWorkspaceCacheTags(userId);

  return loadCareerTreeWorkspaceData(userId, insightLimit);
}

export async function getCareerTreeWorkspaceDataFresh(
  userId: string,
  insightLimit = 4,
): Promise<CareerTreeWorkspaceData> {
  return loadCareerTreeWorkspaceData(userId, insightLimit);
}
