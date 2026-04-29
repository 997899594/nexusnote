import { aiProvider, type ModelType } from "./provider";

export type ModelPolicy =
  | "interactive-fast"
  | "outline-architect"
  | "section-draft"
  | "extract-fast"
  | "quality-review"
  | "search-enabled";

const POLICY_TO_MODEL_TYPE: Record<
  ModelPolicy,
  Extract<ModelType, "chat" | "outline" | "sectionDraft" | "extract" | "review" | "webSearch">
> = {
  "interactive-fast": "chat",
  "outline-architect": "outline",
  "section-draft": "sectionDraft",
  "extract-fast": "extract",
  "quality-review": "review",
  "search-enabled": "webSearch",
};

export function getModelForPolicy(policy: ModelPolicy) {
  return aiProvider.getModel(POLICY_TO_MODEL_TYPE[policy]);
}

export function getPlainModelForPolicy(policy: ModelPolicy) {
  return aiProvider.getPlainModel(POLICY_TO_MODEL_TYPE[policy]);
}

export function getToolCallingModelForPolicy(policy: ModelPolicy) {
  return aiProvider.getToolCallingModel(POLICY_TO_MODEL_TYPE[policy]);
}

export function getModelNameForPolicy(policy: ModelPolicy): string {
  return aiProvider.getModelName(POLICY_TO_MODEL_TYPE[policy]);
}

export function getProviderForPolicy(policy: ModelPolicy): string | null {
  return aiProvider.getProviderLabel(POLICY_TO_MODEL_TYPE[policy]);
}
