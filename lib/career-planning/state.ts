import "server-only";

import { desc, eq } from "drizzle-orm";
import { careerPlanRevisions, db } from "@/db";
import { type CareerMapDraft, careerMapDraftSchema } from "@/lib/ai/career-planning/schemas";

export interface CareerPlanningState {
  sessionId: string;
  revisionId: string;
  revisionIndex: number;
  source: string;
  selectedRouteKey: string | null;
  title: string;
  summary: string;
  mapDraft: CareerMapDraft | null;
  updatedAt: string;
}

function parseMapDraft(mapJson: Record<string, unknown>): CareerMapDraft | null {
  const parsed = careerMapDraftSchema.safeParse(mapJson.draft);
  return parsed.success ? parsed.data : null;
}

export async function getLatestCareerPlanningState(
  userId: string,
): Promise<CareerPlanningState | null> {
  const [revision] = await db
    .select({
      sessionId: careerPlanRevisions.sessionId,
      revisionId: careerPlanRevisions.id,
      revisionIndex: careerPlanRevisions.revisionIndex,
      source: careerPlanRevisions.source,
      selectedRouteKey: careerPlanRevisions.selectedRouteKey,
      title: careerPlanRevisions.title,
      summary: careerPlanRevisions.summary,
      mapJson: careerPlanRevisions.mapJson,
      createdAt: careerPlanRevisions.createdAt,
    })
    .from(careerPlanRevisions)
    .where(eq(careerPlanRevisions.userId, userId))
    .orderBy(desc(careerPlanRevisions.createdAt))
    .limit(1);

  if (!revision) {
    return null;
  }

  return {
    sessionId: revision.sessionId,
    revisionId: revision.revisionId,
    revisionIndex: revision.revisionIndex,
    source: revision.source,
    selectedRouteKey: revision.selectedRouteKey,
    title: revision.title,
    summary: revision.summary,
    mapDraft: parseMapDraft(revision.mapJson),
    updatedAt: revision.createdAt.toISOString(),
  };
}
