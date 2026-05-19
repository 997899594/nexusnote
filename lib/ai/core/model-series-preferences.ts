import { getOrCreate } from "@/lib/profile";
import { getAIModelSeriesFromPreferences } from "../preferences";
import type { AIModelSeries } from "./model-series";

export async function getUserAIModelSeries(userId: string): Promise<AIModelSeries> {
  const profile = await getOrCreate(userId);
  return getAIModelSeriesFromPreferences(profile.aiPreferences);
}
