import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";
import type { NormalizedCareerOutline } from "@/lib/career-tree/normalize-outline";

const CAREER_TREE_EXTRACT_PROMPT = loadPromptResource("career-tree/extract.md");
const CAREER_TREE_MERGE_PROMPT = loadPromptResource("career-tree/merge.md");
const CAREER_TREE_COMPOSE_PROMPT = loadPromptResource("career-tree/compose.md");

export const CAREER_TREE_EXTRACT_SYSTEM_PROMPT = CAREER_TREE_EXTRACT_PROMPT;
export const CAREER_TREE_MERGE_SYSTEM_PROMPT = CAREER_TREE_MERGE_PROMPT;
export const CAREER_TREE_COMPOSE_SYSTEM_PROMPT = CAREER_TREE_COMPOSE_PROMPT;

export function buildCareerExtractPrompt(input: {
  title: string;
  description: string | null;
  outline: NormalizedCareerOutline;
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

export function buildCareerMergePrompt(input: unknown): string {
  return JSON.stringify(input, null, 2);
}

export function buildCareerComposePrompt(input: unknown): string {
  return JSON.stringify(input, null, 2);
}
