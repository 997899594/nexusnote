import { and, desc, eq } from "drizzle-orm";
import { careerUserTreeSnapshots, db, knowledgeInsights, userFocusSnapshots } from "@/db";
import { goldenPathSnapshotSchema } from "@/lib/career-tree/types";

export interface UserGenerationContext {
  currentDirection: {
    directionKey: string | null;
    title: string | null;
    summary: string | null;
    whyThisDirection: string | null;
  } | null;
  currentFocus: {
    nodeId: string | null;
    title: string | null;
    summary: string | null;
    state: string | null;
    progress: number | null;
  } | null;
  insights: Array<{
    kind: string;
    title: string;
    summary: string;
    confidence: number;
  }>;
}

export async function getUserGenerationContext(userId: string): Promise<UserGenerationContext> {
  const [latestTreeSnapshot, latestFocusSnapshot, insightRows] = await Promise.all([
    db.query.careerUserTreeSnapshots.findFirst({
      where: and(
        eq(careerUserTreeSnapshots.userId, userId),
        eq(careerUserTreeSnapshots.isLatest, true),
      ),
      orderBy: desc(careerUserTreeSnapshots.createdAt),
    }),
    db.query.userFocusSnapshots.findFirst({
      where: and(eq(userFocusSnapshots.userId, userId), eq(userFocusSnapshots.isLatest, true)),
      orderBy: desc(userFocusSnapshots.createdAt),
    }),
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

  const parsedTreeSnapshot = latestTreeSnapshot
    ? goldenPathSnapshotSchema.safeParse(latestTreeSnapshot.payload)
    : null;
  const snapshot = parsedTreeSnapshot?.success ? parsedTreeSnapshot.data : null;
  const activeTree =
    snapshot?.trees.find((tree) => tree.directionKey === snapshot.selectedDirectionKey) ??
    snapshot?.trees.find((tree) => tree.directionKey === snapshot?.recommendedDirectionKey) ??
    snapshot?.trees[0] ??
    null;

  return {
    currentDirection: activeTree
      ? {
          directionKey: activeTree.directionKey,
          title: activeTree.title,
          summary: activeTree.summary,
          whyThisDirection: activeTree.whyThisDirection,
        }
      : null,
    currentFocus: latestFocusSnapshot
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
