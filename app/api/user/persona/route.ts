/**
 * User Persona Preference API
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { setUserPersonaPreference } from "@/lib/ai/personas";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

const SetPersonaSchema = z.object({
  personaSlug: z.string().trim().min(1),
});

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const { personaSlug } = SetPersonaSchema.parse(body);

    await setUserPersonaPreference(session.user.id, personaSlug);

    return Response.json({ success: true, personaSlug });
  } catch (error) {
    return handleError(error);
  }
}
