import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { type CareerPlanRevision, careerPlanningSessions, careerPlanRevisions, db } from "@/db";
import type { CareerGraphPatch } from "@/lib/ai/career-planning/schemas";
import {
  type CareerPlanningWorkspaceData,
  getCareerPlanningWorkspaceDataFresh,
} from "@/lib/career-planning/workspace-data";

type JsonObject = Record<string, unknown>;
type JsonObjectArray = JsonObject[];

interface SaveCurrentCareerGraphRevisionInput {
  userId: string;
  sessionId: string;
  conversationId?: string | null;
  source: "initial" | "manual_save" | "route_commit";
  selectedRouteKey?: string | null;
  constraints?: JsonObject;
  graphPatch?: CareerGraphPatch | null;
}

function toJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function toJsonObjectArray(value: unknown[]): JsonObjectArray {
  return value.map((item) => toJsonObject(item));
}

function buildRevisionPayload(
  data: CareerPlanningWorkspaceData,
  selectedRouteKey?: string | null,
  graphPatch?: CareerGraphPatch | null,
) {
  const patchRoute =
    data.routes.find((route) => route.directionKey === graphPatch?.targetDirectionKey) ?? null;
  const currentRoute =
    patchRoute ??
    data.routes.find((route) => route.directionKey === selectedRouteKey) ??
    data.currentRoute;
  const primaryTargetNode =
    graphPatch?.nodes.find((node) => node.type === "future_path" || node.type === "target_role") ??
    graphPatch?.nodes[0] ??
    null;

  return {
    selectedRouteKey:
      graphPatch?.targetDirectionKey ?? currentRoute?.directionKey ?? selectedRouteKey ?? null,
    title: primaryTargetNode?.title ?? currentRoute?.title ?? "职业成长校准",
    summary:
      primaryTargetNode?.summary ??
      graphPatch?.summary ??
      currentRoute?.summary ??
      "从访谈和学习证据开始校准职业方向。",
    sourceSnapshotJson: {
      status: data.snapshot.status,
      generatedAt: data.snapshot.generatedAt,
      recommendedDirectionKey: data.snapshot.recommendedDirectionKey,
      selectedDirectionKey: data.snapshot.selectedDirectionKey,
      treesCount: data.snapshot.trees.length,
    },
    signalsJson: toJsonObjectArray(data.signals),
    routesJson: toJsonObjectArray(graphPatch?.nodes ?? data.routes),
    mapJson: {
      graphPatch: graphPatch ?? null,
      currentRoute,
      metrics: data.metrics,
    },
  };
}

export async function saveCurrentCareerGraphRevision(
  input: SaveCurrentCareerGraphRevisionInput,
): Promise<CareerPlanRevision> {
  const data = await getCareerPlanningWorkspaceDataFresh(input.userId);
  const payload = buildRevisionPayload(data, input.selectedRouteKey, input.graphPatch);

  return db.transaction(async (tx) => {
    const [existingSession] = await tx
      .select()
      .from(careerPlanningSessions)
      .where(
        and(
          eq(careerPlanningSessions.id, input.sessionId),
          eq(careerPlanningSessions.userId, input.userId),
        ),
      )
      .limit(1);

    if (existingSession) {
      await tx
        .update(careerPlanningSessions)
        .set({
          conversationId: input.conversationId ?? existingSession.conversationId,
          selectedRouteKey: payload.selectedRouteKey,
          sourceSnapshotJson: payload.sourceSnapshotJson,
          signalsJson: payload.signalsJson,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(careerPlanningSessions.id, input.sessionId),
            eq(careerPlanningSessions.userId, input.userId),
          ),
        );
    } else {
      await tx.insert(careerPlanningSessions).values({
        id: input.sessionId,
        userId: input.userId,
        conversationId: input.conversationId ?? null,
        selectedRouteKey: payload.selectedRouteKey,
        sourceSnapshotJson: payload.sourceSnapshotJson,
        signalsJson: payload.signalsJson,
      });
    }

    const [latestRevision] = await tx
      .select({ revisionIndex: careerPlanRevisions.revisionIndex })
      .from(careerPlanRevisions)
      .where(
        and(
          eq(careerPlanRevisions.sessionId, input.sessionId),
          eq(careerPlanRevisions.userId, input.userId),
        ),
      )
      .orderBy(desc(careerPlanRevisions.revisionIndex))
      .limit(1);

    const [revision] = await tx
      .insert(careerPlanRevisions)
      .values({
        sessionId: input.sessionId,
        userId: input.userId,
        revisionIndex: (latestRevision?.revisionIndex ?? 0) + 1,
        source: input.source,
        selectedRouteKey: payload.selectedRouteKey,
        title: payload.title,
        summary: payload.summary,
        sourceSnapshotJson: payload.sourceSnapshotJson,
        signalsJson: payload.signalsJson,
        routesJson: payload.routesJson,
        constraintsJson: input.constraints ?? {},
        mapJson: payload.mapJson,
      })
      .returning();

    if (!revision) {
      throw new Error("Failed to save career plan revision.");
    }

    return revision;
  });
}
