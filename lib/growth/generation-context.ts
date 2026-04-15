import { desc, eq } from "drizzle-orm";
import { db, knowledgeInsights } from "@/db";
import { getLatestFocusSnapshot } from "@/lib/growth/projection-data";
import { getGrowthSnapshot } from "@/lib/growth/snapshot-data";
import {
  findDefaultFocusNode,
  getCurrentGrowthTree,
  resolveProjectedFocusNode,
} from "@/lib/growth/view-model";
import type { GrowthGenerationContext } from "./generation-context-format";

export interface UserGrowthContext extends GrowthGenerationContext {}

export async function getUserGrowthContext(userId: string): Promise<UserGrowthContext> {
  const [snapshot, latestFocusSnapshot, insightRows] = await Promise.all([
    getGrowthSnapshot(userId),
    getLatestFocusSnapshot(userId),
    db
      .select({
        kind: knowledgeInsights.kind,
        title: knowledgeInsights.title,
        summary: knowledgeInsights.summary,
        confidence: knowledgeInsights.confidence,
      })
      .from(knowledgeInsights)
      .where(eq(knowledgeInsights.userId, userId))
      .orderBy(desc(knowledgeInsights.confidence))
      .limit(4),
  ]);

  const activeTree = getCurrentGrowthTree(snapshot);
  const activeFocusNode = activeTree
    ? (resolveProjectedFocusNode(
        activeTree.tree,
        latestFocusSnapshot?.directionKey === activeTree.directionKey
          ? (latestFocusSnapshot.node ?? {
              id: latestFocusSnapshot.nodeId,
              anchorRef: latestFocusSnapshot.anchorRef,
            })
          : null,
      ) ?? findDefaultFocusNode(activeTree.tree))
    : null;

  return {
    currentDirection: activeTree
      ? {
          directionKey: activeTree.directionKey,
          title: activeTree.title,
          summary: activeTree.summary,
          whyThisDirection: activeTree.whyThisDirection,
        }
      : null,
    currentFocus: activeFocusNode
      ? {
          nodeId: activeFocusNode.id,
          title: activeFocusNode.title,
          summary: activeFocusNode.summary,
          state: activeFocusNode.state,
          progress: activeFocusNode.progress,
        }
      : latestFocusSnapshot
        ? {
            nodeId: latestFocusSnapshot.nodeId,
            title: latestFocusSnapshot.title,
            summary: latestFocusSnapshot.summary,
            state: latestFocusSnapshot.state,
            progress: latestFocusSnapshot.progress,
          }
        : null,
    insights: insightRows.map((insight) => ({
      kind: insight.kind,
      title: insight.title,
      summary: insight.summary,
      confidence: Number(insight.confidence),
    })),
  };
}
