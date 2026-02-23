/**
 * User Preferences API
 *
 * Returns all user personalization data in one call.
 * Requires login.
 */

import type { NextRequest } from "next/server";
import type { PersonaPreference } from "@/lib/ai/personas";
import { type AIPersona, getAvailablePersonas, getUserPersonaPreference } from "@/lib/ai/personas";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getUserStyleProfile, type UserStyleProfile } from "@/lib/style/analysis";

export const runtime = "nodejs";

interface PreferencesResponse {
  profile: {
    learningStyle?: {
      preferredFormat?: string;
      pace?: string;
    };
    style?: UserStyleProfile;
  };
  personaPreference: PersonaPreference;
  availablePersonas: AIPersona[];
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const userId = session.user.id;

    // Parallel fetch all personalization data
    const [styleProfile, personaPreference, availablePersonas] = await Promise.all([
      getUserStyleProfile(userId),
      getUserPersonaPreference(userId),
      getAvailablePersonas(userId),
    ]);

    const response: PreferencesResponse = {
      profile: {
        learningStyle: { preferredFormat: "mixed", pace: "normal" },
        style: styleProfile || undefined,
      },
      personaPreference,
      availablePersonas,
    };

    return Response.json(response);
  } catch (error) {
    return handleError(error);
  }
}
