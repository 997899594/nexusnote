import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";
import { BUILT_IN_SKIN_CATALOG, type BuiltInSkinCatalogItem } from "./skin-catalog";

export interface BuiltInSkinDefinition extends BuiltInSkinCatalogItem {
  systemPrompt: string;
}

const BUILT_IN_SKIN_SYSTEM_PROMPTS = {
  default: loadPromptResource("skins/default-system.md"),
  best_friend: loadPromptResource("skins/best-friend-system.md"),
  girlfriend: loadPromptResource("skins/girlfriend-system.md"),
  gentle_teacher: loadPromptResource("skins/gentle-teacher-system.md"),
  socrates: loadPromptResource("skins/socrates-system.md"),
  steve_jobs: loadPromptResource("skins/steve-jobs-system.md"),
  gordon: loadPromptResource("skins/gordon-system.md"),
  clickbait: loadPromptResource("skins/clickbait-system.md"),
} as const;

export const BUILT_IN_SKINS: readonly BuiltInSkinDefinition[] = BUILT_IN_SKIN_CATALOG.map(
  (skin) => ({
    ...skin,
    systemPrompt:
      BUILT_IN_SKIN_SYSTEM_PROMPTS[skin.slug as keyof typeof BUILT_IN_SKIN_SYSTEM_PROMPTS],
  }),
);

/**
 * Get a built-in skin by slug
 */
export function getBuiltInSkin(slug: string): BuiltInSkinDefinition | undefined {
  return BUILT_IN_SKINS.find((skin) => skin.slug === slug);
}
