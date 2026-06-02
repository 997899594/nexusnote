import "server-only";

import { desc, eq } from "drizzle-orm";
import { careerPlanRevisions, db } from "@/db";
import { type CareerGraphPatch, careerGraphPatchSchema } from "@/lib/ai/career-planning/schemas";

export interface CareerPlanningState {
  sessionId: string;
  revisionId: string;
  revisionIndex: number;
  source: string;
  selectedRouteKey: string | null;
  title: string;
  summary: string;
  graphPatch: CareerGraphPatch | null;
  updatedAt: string;
}

function parseGraphPatch(mapJson: Record<string, unknown>): CareerGraphPatch | null {
  const graphPatch = mapJson.graphPatch;
  if (!graphPatch || typeof graphPatch !== "object" || Array.isArray(graphPatch)) {
    return null;
  }

  if (!("author" in graphPatch)) {
    return null;
  }

  const parsed = careerGraphPatchSchema.safeParse(mapJson.graphPatch);
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
    graphPatch: parseGraphPatch(revision.mapJson),
    updatedAt: revision.createdAt.toISOString(),
  };
}
