import { aiProvider, type ModelType } from "./provider";

export type ModelPolicy = "interactive-fast" | "structured-high-quality" | "search-enabled";

const POLICY_TO_MODEL_TYPE: Record<
  ModelPolicy,
  Extract<ModelType, "chat" | "pro" | "webSearch">
> = {
  "interactive-fast": "chat",
  "structured-high-quality": "pro",
  "search-enabled": "webSearch",
};

export function getModelForPolicy(policy: ModelPolicy) {
  return aiProvider.getModel(POLICY_TO_MODEL_TYPE[policy]);
}

export function getPlainModelForPolicy(policy: ModelPolicy) {
  return aiProvider.getPlainModel(POLICY_TO_MODEL_TYPE[policy]);
}

export function getJsonModelForPolicy(policy: ModelPolicy) {
  return aiProvider.getJsonModel(POLICY_TO_MODEL_TYPE[policy]);
}

export function getModelNameForPolicy(policy: ModelPolicy): string {
  return aiProvider.getModelName(POLICY_TO_MODEL_TYPE[policy]);
}

export function getProviderForPolicy(policy: ModelPolicy): string | null {
  return aiProvider.getProviderLabel(POLICY_TO_MODEL_TYPE[policy]);
}
