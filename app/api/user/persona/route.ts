/**
 * User Persona Preference API
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { setUserPersonaPreference } from "@/lib/ai/personas";
import { withAuth } from "@/lib/api";

const SetPersonaSchema = z.object({
  personaSlug: z.string().trim().min(1),
});

export const runtime = "nodejs";

export const PUT = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { personaSlug } = SetPersonaSchema.parse(body);

  await setUserPersonaPreference(userId, personaSlug);

  return Response.json({ success: true, personaSlug });
});
