import type { ModelType } from "./model-bundles";
import { aiModelGateway } from "./model-gateway";
import type { AIModelSeries } from "./model-series";

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

export interface ModelPolicyResolutionOptions {
  modelSeries?: AIModelSeries;
}

export function getModelForPolicy(policy: ModelPolicy, options?: ModelPolicyResolutionOptions) {
  return aiModelGateway.getModel(POLICY_TO_MODEL_TYPE[policy], options?.modelSeries);
}

export function getPlainModelForPolicy(
  policy: ModelPolicy,
  options?: ModelPolicyResolutionOptions,
) {
  return aiModelGateway.getPlainModel(POLICY_TO_MODEL_TYPE[policy], options?.modelSeries);
}

export function getToolCallingModelForPolicy(
  policy: ModelPolicy,
  options?: ModelPolicyResolutionOptions,
) {
  return aiModelGateway.getToolCallingModel(POLICY_TO_MODEL_TYPE[policy], options?.modelSeries);
}

export function getModelNameForPolicy(
  policy: ModelPolicy,
  options?: ModelPolicyResolutionOptions,
): string {
  return aiModelGateway.getModelName(POLICY_TO_MODEL_TYPE[policy], options?.modelSeries);
}
