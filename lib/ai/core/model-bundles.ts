import { env } from "@/config/env";
import {
  type AIRouteProfile,
  DEFAULT_AI_ROUTE_PROFILE,
  normalizeAIRouteProfile,
} from "./route-profiles";

export type ModelType =
  | "chat"
  | "toolCalling"
  | "pro"
  | "outline"
  | "sectionDraft"
  | "extract"
  | "review"
  | "webSearch"
  | "embedding";

export type LanguageModelType = Exclude<ModelType, "embedding">;

export interface AIModelBundle {
  routeProfile: AIRouteProfile;
  label: string;
  providerLabel: string;
  models: Record<ModelType, string>;
}

type LanguageModelBundleConfig = Record<LanguageModelType, string>;

function buildModelMap(config: LanguageModelBundleConfig): Record<ModelType, string> {
  return {
    ...config,
    embedding: env.EMBEDDING_MODEL,
  };
}

export function getAIModelBundles(): Record<AIRouteProfile, AIModelBundle> {
  return {
    platform: {
      routeProfile: "platform",
      label: "平台推荐",
      providerLabel: "302.ai",
      models: buildModelMap({
        chat: env.AI_MODEL_INTERACTIVE,
        toolCalling: env.AI_MODEL_INTERACTIVE,
        pro: env.AI_MODEL_REVIEW,
        outline: env.AI_MODEL_OUTLINE,
        sectionDraft: env.AI_MODEL_SECTION_DRAFT,
        extract: env.AI_MODEL_EXTRACT,
        review: env.AI_MODEL_REVIEW,
        webSearch: env.AI_MODEL_WEB_SEARCH,
      }),
    },
    domestic: {
      routeProfile: "domestic",
      label: "国产链路",
      providerLabel: "302.ai / domestic",
      models: buildModelMap({
        chat: env.AI_DOMESTIC_MODEL_INTERACTIVE,
        toolCalling: env.AI_DOMESTIC_MODEL_INTERACTIVE,
        pro: env.AI_DOMESTIC_MODEL_REVIEW,
        outline: env.AI_DOMESTIC_MODEL_OUTLINE,
        sectionDraft: env.AI_DOMESTIC_MODEL_SECTION_DRAFT,
        extract: env.AI_DOMESTIC_MODEL_EXTRACT,
        review: env.AI_DOMESTIC_MODEL_REVIEW,
        webSearch: env.AI_DOMESTIC_MODEL_WEB_SEARCH,
      }),
    },
    gemini: {
      routeProfile: "gemini",
      label: "Gemini 链路",
      providerLabel: "302.ai / Gemini",
      models: buildModelMap({
        chat: env.AI_GEMINI_MODEL_INTERACTIVE,
        toolCalling: env.AI_GEMINI_MODEL_INTERACTIVE,
        pro: env.AI_GEMINI_MODEL_REVIEW,
        outline: env.AI_GEMINI_MODEL_OUTLINE,
        sectionDraft: env.AI_GEMINI_MODEL_SECTION_DRAFT,
        extract: env.AI_GEMINI_MODEL_EXTRACT,
        review: env.AI_GEMINI_MODEL_REVIEW,
        webSearch: env.AI_GEMINI_MODEL_WEB_SEARCH,
      }),
    },
    openai: {
      routeProfile: "openai",
      label: "OpenAI 链路",
      providerLabel: "302.ai / OpenAI",
      models: buildModelMap({
        chat: env.AI_OPENAI_MODEL_INTERACTIVE,
        toolCalling: env.AI_OPENAI_MODEL_INTERACTIVE,
        pro: env.AI_OPENAI_MODEL_REVIEW,
        outline: env.AI_OPENAI_MODEL_OUTLINE,
        sectionDraft: env.AI_OPENAI_MODEL_SECTION_DRAFT,
        extract: env.AI_OPENAI_MODEL_EXTRACT,
        review: env.AI_OPENAI_MODEL_REVIEW,
        webSearch: env.AI_OPENAI_MODEL_WEB_SEARCH,
      }),
    },
  };
}

export function getAIModelBundle(routeProfile?: AIRouteProfile): AIModelBundle {
  const profile = normalizeAIRouteProfile(routeProfile ?? DEFAULT_AI_ROUTE_PROFILE);
  return getAIModelBundles()[profile];
}

export function getAIModelId(modelType: ModelType, routeProfile?: AIRouteProfile): string {
  const modelId = getAIModelBundle(routeProfile).models[modelType];
  if (!modelId) {
    throw new Error(`No model configured for type: ${modelType}`);
  }
  return modelId;
}
