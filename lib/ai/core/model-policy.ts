import type { LanguageModel } from "ai";
import { aiProvider } from "./provider";

export type ModelPolicy = "interactive-fast" | "structured-high-quality" | "search-enabled";

const MODEL_POLICY_NAMES: Record<ModelPolicy, string> = {
  "interactive-fast": "gemini-3.1-flash-lite-preview",
  "structured-high-quality": "gemini-3.1-pro-preview",
  "search-enabled": "gemini-3.1-flash-preview-web-search",
};

export function getModelForPolicy(policy: ModelPolicy): LanguageModel {
  switch (policy) {
    case "structured-high-quality":
      return aiProvider.proModel;
    case "search-enabled":
      return aiProvider.webSearchModel;
    default:
      return aiProvider.chatModel;
  }
}

export function getModelNameForPolicy(policy: ModelPolicy): string {
  return MODEL_POLICY_NAMES[policy];
}
