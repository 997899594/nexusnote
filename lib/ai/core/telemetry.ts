import type { LanguageModelUsage } from "ai";
import { aiUsage, db } from "@/db";
import type { AgentProfile } from "./capability-profiles";
import { getModelNameForPolicy, type ModelPolicy } from "./model-policy";

const MODEL_PRICING_USD_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-3.1-flash-lite-preview": { input: 0.1, output: 0.4 },
  "gemini-3.1-pro-preview": { input: 3.5, output: 10.5 },
  "gemini-3.1-flash-preview-web-search": { input: 0.35, output: 1.05 },
};

export interface AITelemetryContext {
  requestId: string;
  endpoint: string;
  userId?: string;
  intent?: string;
  profile?: AgentProfile;
  workflow?: string;
  promptVersion?: string;
  model?: string;
  modelPolicy?: ModelPolicy;
  metadata?: Record<string, unknown>;
}

interface RecordAIUsageInput extends AITelemetryContext {
  usage?: Partial<LanguageModelUsage>;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
}

function normalizeUsage(usage?: Partial<LanguageModelUsage>) {
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const totalTokens = usage?.totalTokens ?? inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING_USD_PER_1M_TOKENS[model];
  if (!pricing) {
    return 0;
  }

  const costUsd =
    (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

  return Math.round(costUsd * 100);
}

export function createTelemetryContext(
  input: Omit<AITelemetryContext, "requestId"> & { requestId?: string },
): AITelemetryContext {
  return {
    ...input,
    requestId: input.requestId ?? crypto.randomUUID(),
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export async function recordAIUsage(input: RecordAIUsageInput): Promise<void> {
  const model =
    input.model ?? (input.modelPolicy ? getModelNameForPolicy(input.modelPolicy) : null);
  if (!model) {
    return;
  }

  const { inputTokens, outputTokens, totalTokens } = normalizeUsage(input.usage);

  try {
    await db.insert(aiUsage).values({
      userId: input.userId,
      requestId: input.requestId,
      endpoint: input.endpoint,
      intent: input.intent ?? input.profile ?? input.workflow,
      profile: input.profile,
      workflow: input.workflow,
      model,
      promptVersion: input.promptVersion,
      inputTokens,
      outputTokens,
      totalTokens,
      costCents: estimateCostCents(model, inputTokens, outputTokens),
      durationMs: input.durationMs,
      success: input.success ?? true,
      errorMessage: input.errorMessage,
      metadata: input.metadata,
    });
  } catch (error) {
    console.error("[Telemetry] Failed to persist AI usage:", error);
  }
}
