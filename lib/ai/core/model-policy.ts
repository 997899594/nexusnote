import type { ModelType } from "./model-bundles";
import { aiProvider } from "./provider";
import type { AIRouteProfile } from "./route-profiles";

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
  routeProfile?: AIRouteProfile;
}

export function getModelForPolicy(policy: ModelPolicy, options?: ModelPolicyResolutionOptions) {
  return aiProvider.getModel(POLICY_TO_MODEL_TYPE[policy], options?.routeProfile);
}

export function getPlainModelForPolicy(
  policy: ModelPolicy,
  options?: ModelPolicyResolutionOptions,
) {
  return aiProvider.getPlainModel(POLICY_TO_MODEL_TYPE[policy], options?.routeProfile);
}

export function getToolCallingModelForPolicy(
  policy: ModelPolicy,
  options?: ModelPolicyResolutionOptions,
) {
  return aiProvider.getToolCallingModel(POLICY_TO_MODEL_TYPE[policy], options?.routeProfile);
}

export function getModelNameForPolicy(
  policy: ModelPolicy,
  options?: ModelPolicyResolutionOptions,
): string {
  return aiProvider.getModelName(POLICY_TO_MODEL_TYPE[policy], options?.routeProfile);
}

export function getProviderForPolicy(
  policy: ModelPolicy,
  options?: ModelPolicyResolutionOptions,
): string | null {
  return aiProvider.getProviderLabel(POLICY_TO_MODEL_TYPE[policy], options?.routeProfile);
}
