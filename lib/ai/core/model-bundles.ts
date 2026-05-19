import { env } from "@/config/env";
import {
  type AIModelSeries,
  DEFAULT_AI_MODEL_SERIES,
  normalizeAIModelSeries,
} from "./model-series";

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
  modelSeries: AIModelSeries;
  label: string;
  models: Record<ModelType, string>;
}

type LanguageModelBundleConfig = Record<LanguageModelType, string>;

function buildModelMap(config: LanguageModelBundleConfig): Record<ModelType, string> {
  return {
    ...config,
    embedding: env.EMBEDDING_MODEL,
  };
}

export function getAIModelBundles(): Record<AIModelSeries, AIModelBundle> {
  return {
    qwen: {
      modelSeries: "qwen",
      label: "Qwen",
      models: buildModelMap({
        chat: env.AI_QWEN_MODEL_INTERACTIVE,
        toolCalling: env.AI_QWEN_MODEL_INTERACTIVE,
        pro: env.AI_QWEN_MODEL_REVIEW,
        outline: env.AI_QWEN_MODEL_OUTLINE,
        sectionDraft: env.AI_QWEN_MODEL_SECTION_DRAFT,
        extract: env.AI_QWEN_MODEL_EXTRACT,
        review: env.AI_QWEN_MODEL_REVIEW,
        webSearch: env.AI_QWEN_MODEL_WEB_SEARCH,
      }),
    },
    gemini: {
      modelSeries: "gemini",
      label: "Gemini",
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
      modelSeries: "openai",
      label: "OpenAI",
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

export function getAIModelBundle(modelSeries?: AIModelSeries): AIModelBundle {
  const series = normalizeAIModelSeries(modelSeries ?? DEFAULT_AI_MODEL_SERIES);
  return getAIModelBundles()[series];
}

export function getAIModelId(modelType: ModelType, modelSeries?: AIModelSeries): string {
  const modelId = getAIModelBundle(modelSeries).models[modelType];
  if (!modelId) {
    throw new Error(`No model configured for type: ${modelType}`);
  }
  return modelId;
}
