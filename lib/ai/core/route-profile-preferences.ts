import { getOrCreate } from "@/lib/profile";
import { getAIRouteProfileFromPreferences } from "../preferences";
import type { AIRouteProfile } from "./route-profiles";

export async function getUserAIRouteProfile(userId: string): Promise<AIRouteProfile> {
  const profile = await getOrCreate(userId);
  return getAIRouteProfileFromPreferences(profile.aiPreferences);
}
