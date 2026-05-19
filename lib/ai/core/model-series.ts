import { z } from "zod";

export const AIModelSeriesSchema = z.enum(["qwen", "gemini", "openai"]);

export type AIModelSeries = z.infer<typeof AIModelSeriesSchema>;

export const DEFAULT_AI_MODEL_SERIES: AIModelSeries = "qwen";

export interface AIModelSeriesOption {
  value: AIModelSeries;
  label: string;
  description: string;
}

export const AI_MODEL_SERIES_OPTIONS: AIModelSeriesOption[] = [
  {
    value: "qwen",
    label: "Qwen",
    description: "使用 Qwen 系列模型。",
  },
  {
    value: "gemini",
    label: "Gemini",
    description: "使用 Gemini 系列模型。",
  },
  {
    value: "openai",
    label: "OpenAI",
    description: "使用 OpenAI 系列模型。",
  },
];

export function normalizeAIModelSeries(value: unknown): AIModelSeries {
  return AIModelSeriesSchema.parse(value ?? DEFAULT_AI_MODEL_SERIES);
}
