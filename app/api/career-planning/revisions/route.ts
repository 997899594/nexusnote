import { z } from "zod";
import { careerMapDraftSchema } from "@/lib/ai/career-planning/schemas";
import { parseJsonBodyAs, withAuth } from "@/lib/api";
import { saveCurrentCareerMapRevision } from "@/lib/career-planning/revisions";

const saveCareerPlanRevisionSchema = z.object({
  sessionId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  source: z.enum(["initial", "manual_save", "route_commit"]).default("manual_save"),
  selectedRouteKey: z.string().trim().min(1).optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  mapDraft: careerMapDraftSchema.optional(),
});

export const POST = withAuth(async (request, { userId }) => {
  const body = await parseJsonBodyAs(request, saveCareerPlanRevisionSchema);
  const revision = await saveCurrentCareerMapRevision({
    userId,
    sessionId: body.sessionId,
    conversationId: body.conversationId ?? null,
    source: body.source,
    selectedRouteKey: body.selectedRouteKey,
    constraints: body.constraints,
    mapDraft: body.mapDraft,
  });

  return Response.json({
    revision: {
      id: revision.id,
      revisionIndex: revision.revisionIndex,
      selectedRouteKey: revision.selectedRouteKey,
      title: revision.title,
      summary: revision.summary,
      createdAt: revision.createdAt,
    },
  });
});
