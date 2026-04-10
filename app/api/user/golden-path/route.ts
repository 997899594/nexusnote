import { z } from "zod";
import { withAuth } from "@/lib/api";
import { revalidateGoldenPath } from "@/lib/cache/tags";
import { GOLDEN_PATH_PROJECTION_PRIORS } from "@/lib/golden-path/ontology";
import { setUserGoldenPathPreference } from "@/lib/golden-path/preferences";

const SetCurrentRouteSchema = z.object({
  routeId: z
    .string()
    .trim()
    .min(1)
    .refine(
      (routeId) => GOLDEN_PATH_PROJECTION_PRIORS.some((route) => route.id === routeId),
      "Invalid routeId",
    ),
});

export const PUT = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { routeId } = SetCurrentRouteSchema.parse(body);

  await setUserGoldenPathPreference(userId, routeId);
  revalidateGoldenPath(userId);

  return Response.json({
    success: true,
    currentRouteId: routeId,
  });
});
