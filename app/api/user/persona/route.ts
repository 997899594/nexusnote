/**
 * User Persona Preference API
 */

import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleError, APIError } from "@/lib/api";
import { setUserPersonaPreference } from "@/lib/ai/personas";
import { z } from "zod";

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
