import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";
import type { NormalizedGrowthOutline } from "@/lib/growth/normalize-outline";

const GROWTH_COMPOSE_METADATA_PROMPT = loadPromptResource("growth/compose-metadata.md");
const GROWTH_EXTRACT_PROMPT = loadPromptResource("growth/extract.md");

export const GROWTH_COMPOSE_METADATA_SYSTEM_PROMPT = GROWTH_COMPOSE_METADATA_PROMPT;
export const GROWTH_EXTRACT_SYSTEM_PROMPT = GROWTH_EXTRACT_PROMPT;

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

export function buildGrowthComposeMetadataPrompt(input: {
  validationError?: string | null;
  direction: {
    keySeed: string;
    matchPreviousDirectionKey?: string;
    supportingNodeRefs: string[];
    confidence: number;
    visibleNodeCount: number;
    supportingNodeCount: number;
    requiredNodeLabelAnchorRefs: string[];
    nodes: Array<{
      anchorRef: string;
      parentAnchorRef: string | null;
      depth: number;
      canonicalLabel: string;
      summary: string | null;
      progress: number;
      state: string;
      evidenceScore: number;
    }>;
  };
}): string {
  return JSON.stringify(input, null, 2);
}
