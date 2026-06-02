import { z } from "zod";
import { careerGraphPatchSchema } from "@/lib/ai/career-planning/schemas";
import { parseJsonBodyAs, withAuth } from "@/lib/api";
import { saveCurrentCareerGraphRevision } from "@/lib/career-planning/revisions";

const commitCareerPlanningRouteSchema = z.object({
  sessionId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  selectedRouteKey: z.string().trim().min(1),
  graphPatch: careerGraphPatchSchema.optional(),
});

export const POST = withAuth(async (request, { userId }) => {
  const body = await parseJsonBodyAs(request, commitCareerPlanningRouteSchema);
  const revision = await saveCurrentCareerGraphRevision({
    userId,
    sessionId: body.sessionId,
    conversationId: body.conversationId ?? null,
    source: "route_commit",
    selectedRouteKey: body.selectedRouteKey,
    graphPatch: body.graphPatch,
  });

  return Response.json({
    selectedRouteKey: revision.selectedRouteKey,
    revision: {
      id: revision.id,
      revisionIndex: revision.revisionIndex,
      title: revision.title,
      summary: revision.summary,
      createdAt: revision.createdAt,
    },
  });
});
