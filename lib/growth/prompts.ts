import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";
import type { GrowthMergePlannerInput } from "@/lib/growth/merge";
import type { NormalizedGrowthOutline } from "@/lib/growth/normalize-outline";

const GROWTH_COMPOSE_PROMPT = loadPromptResource("growth/compose.md");
const GROWTH_COMPOSE_METADATA_PROMPT = loadPromptResource("growth/compose-metadata.md");
const GROWTH_EXTRACT_PROMPT = loadPromptResource("growth/extract.md");
const GROWTH_MERGE_PROMPT = loadPromptResource("growth/merge.md");

export const GROWTH_COMPOSE_SYSTEM_PROMPT = GROWTH_COMPOSE_PROMPT;
export const GROWTH_COMPOSE_METADATA_SYSTEM_PROMPT = GROWTH_COMPOSE_METADATA_PROMPT;
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

export function buildGrowthMergePrompt(input: GrowthMergePlannerInput): string {
  return JSON.stringify(
    {
      candidateContext: {
        nodes: input.candidateContext.nodes,
        evidenceLinks: input.candidateContext.evidenceLinks,
        prerequisiteEdges: input.candidateContext.prerequisiteEdges,
      },
      evidenceBatch: input.evidenceBatch,
      priorCourseSummary: input.priorCourseSummary,
    },
    null,
    2,
  );
}

export function buildGrowthComposePrompt(input: {
  graph: {
    nodes: Array<{
      id: string;
      canonicalLabel: string;
      summary: string | null;
      progress: number;
      state: string;
      courseCount: number;
      chapterCount: number;
      evidenceScore: number;
    }>;
    prerequisiteEdges: Array<{
      from: string;
      to: string;
      confidence: number;
    }>;
  };
  preference: {
    selectedDirectionKey?: string | null;
    preferenceVersion?: number;
    selectionCount?: number;
    directionSignals?: Array<{
      directionKey: string;
      selectionCount: number;
      latestSelectedAt: string;
    }>;
  };
  previousSummary: {
    trees: Array<{
      directionKey: string;
      supportingNodeRefs: string[];
    }>;
  };
  directionCountGuidance: {
    min: number;
    max: number;
    signalStrength: "weak" | "mixed" | "strong";
  };
}): string {
  return JSON.stringify(
    {
      selectedDirectionKey: input.preference.selectedDirectionKey ?? null,
      preferenceVersion: input.preference.preferenceVersion ?? 0,
      selectionCount: input.preference.selectionCount ?? 0,
      directionSignals: input.preference.directionSignals ?? [],
      previousDirections: input.previousSummary.trees,
      directionCountGuidance: input.directionCountGuidance,
      graph: input.graph,
    },
    null,
    2,
  );
}

export function buildGrowthComposeMetadataPrompt(input: {
  direction: {
    keySeed: string;
    matchPreviousDirectionKey?: string;
    supportingNodeRefs: string[];
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
