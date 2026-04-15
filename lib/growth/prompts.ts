import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";
import type { NormalizedGrowthOutline } from "@/lib/growth/normalize-outline";

const GROWTH_EXTRACT_PROMPT = loadPromptResource("growth/extract.md");
const GROWTH_MERGE_PROMPT = loadPromptResource("growth/merge.md");

export const GROWTH_EXTRACT_SYSTEM_PROMPT = GROWTH_EXTRACT_PROMPT;
export const GROWTH_MERGE_SYSTEM_PROMPT = GROWTH_MERGE_PROMPT;

export function buildGrowthExtractPrompt(input: {
  title: string;
  description: string | null;
  outline: NormalizedGrowthOutline;
}): string {
  return JSON.stringify(
    {
      title: input.title,
      description: input.description ?? "",
      courseSkillIds: input.outline.courseSkillIds,
      chapters: input.outline.chapters,
    },
    null,
    2,
  );
}

export function buildGrowthMergePrompt(input: unknown): string {
  return JSON.stringify(input, null, 2);
}
