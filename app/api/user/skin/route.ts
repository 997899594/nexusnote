/**
 * User Skin Preference API
 */

import { z } from "zod";
import { setUserSkinPreference } from "@/lib/ai/skins";
import { withAuth } from "@/lib/api";

const SetSkinSchema = z.object({
  skinSlug: z.string().trim().min(1),
});

export const PUT = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { skinSlug } = SetSkinSchema.parse(body);

  await setUserSkinPreference(userId, skinSlug);

  return Response.json({
    success: true,
    skinSlug,
  });
});
