import { getModelNameForPolicy, type ModelPolicy } from "@/lib/ai/core/model-policy";
import type { AIModelSeries } from "@/lib/ai/core/model-series";
import {
  CAREER_TREE_COMPOSE_PROMPT_VERSION,
  CAREER_TREE_EXTRACT_PROMPT_VERSION,
  CAREER_TREE_MERGE_PROMPT_VERSION,
} from "@/lib/career-tree/constants";

export interface CareerTreeModelCandidate {
  modelSeries: AIModelSeries;
  label: string;
}

export const CAREER_TREE_EXTRACTION_MODEL_CANDIDATES: CareerTreeModelCandidate[] = [
  { modelSeries: "qwen", label: "fast" },
  { modelSeries: "deepseek", label: "structured-fallback" },
];

export const CAREER_TREE_MERGE_MODEL_CANDIDATES: CareerTreeModelCandidate[] = [
  { modelSeries: "qwen", label: "fast" },
  { modelSeries: "deepseek", label: "structured-fallback" },
];

export const CAREER_TREE_COMPOSE_MODEL_CANDIDATES: CareerTreeModelCandidate[] = [
  { modelSeries: "qwen", label: "fast" },
  { modelSeries: "deepseek", label: "structured-fallback" },
];

export function getCareerTreeModelCandidateNames(
  policy: ModelPolicy,
  candidates: CareerTreeModelCandidate[],
): string {
  return candidates
    .map((candidate) => getModelNameForPolicy(policy, { modelSeries: candidate.modelSeries }))
    .join(">");
}

export type CareerTreeRunKind = "extract" | "merge" | "compose";

const careerTreePromptVersionByRunKind = {
  extract: CAREER_TREE_EXTRACT_PROMPT_VERSION,
  merge: CAREER_TREE_MERGE_PROMPT_VERSION,
  compose: CAREER_TREE_COMPOSE_PROMPT_VERSION,
} satisfies Record<CareerTreeRunKind, string>;

const careerTreeModelByRunKind = {
  extract: getCareerTreeModelCandidateNames(
    "extract-fast",
    CAREER_TREE_EXTRACTION_MODEL_CANDIDATES,
  ),
  merge: getCareerTreeModelCandidateNames("extract-fast", CAREER_TREE_MERGE_MODEL_CANDIDATES),
  compose: getCareerTreeModelCandidateNames(
    "outline-architect",
    CAREER_TREE_COMPOSE_MODEL_CANDIDATES,
  ),
} satisfies Record<CareerTreeRunKind, string>;

export function getCareerTreeRunModelName(kind: CareerTreeRunKind): string {
  return careerTreeModelByRunKind[kind];
}

export function isCurrentCareerTreeRun(params: {
  kind: string;
  model: string;
  promptVersion: string;
}): boolean {
  if (params.kind !== "extract" && params.kind !== "merge" && params.kind !== "compose") {
    return false;
  }

  return (
    careerTreePromptVersionByRunKind[params.kind] === params.promptVersion &&
    careerTreeModelByRunKind[params.kind] === params.model
  );
}
