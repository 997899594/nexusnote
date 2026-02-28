/**
 * User Preferences API
 *
 * Returns all user personalization data in one call.
 * Requires login.
 */

import type { PersonaPreference } from "@/lib/ai/personas";
import { type AIPersona, getAvailablePersonas, getUserPersonaPreference } from "@/lib/ai/personas";
import { withAuth } from "@/lib/api";
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

export const GET = withAuth(async (_request, { userId }) => {
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
});
