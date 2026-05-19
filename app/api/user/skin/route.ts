/**
 * User Skin Preference API
 */

import { z } from "zod";
import { setUserSkinPreference } from "@/lib/ai/skins";
import { parseJsonBodyAs, withAuth } from "@/lib/api";

const SetSkinSchema = z.object({
  skinSlug: z.string().trim().min(1),
});

export const PUT = withAuth(async (request, { userId }) => {
  const { skinSlug } = await parseJsonBodyAs(request, SetSkinSchema);

  await setUserSkinPreference(userId, skinSlug);

  return Response.json({
    success: true,
    skinSlug,
  });
});
