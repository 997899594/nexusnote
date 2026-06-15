import type { LanguageModelUsage } from "ai";
import { env } from "@/config/env";
import { aiUsage, db } from "@/db";
import type { CapabilityMode } from "@/lib/ai/runtime/contracts";
import { isUuidString } from "@/lib/chat/session-id";
import { getAIErrorMessage } from "./ai-errors";
import { getModelNameForPolicy, type ModelPolicy } from "./model-policy";
import type { AIModelSeries } from "./model-series";

export interface AITelemetryContext {
  requestId: string;
  endpoint: string;
  userId?: string;
  intent?: string;
  capabilityMode?: CapabilityMode;
  workflow?: string;
  promptVersion?: string;
  model?: string;
  modelPolicy?: ModelPolicy;
  modelSeries?: AIModelSeries;
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
  const pricing = env.AI_MODEL_PRICING_JSON[model];
  if (!pricing) {
    return 0;
  }

  const costUsd =
    (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

  return Math.round(costUsd * 100);
}

function normalizeTelemetryUserId(userId: string | undefined): string | undefined {
  return isUuidString(userId) ? userId : undefined;
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
  return getAIErrorMessage(error);
}

export async function recordAIUsage(input: RecordAIUsageInput): Promise<void> {
  const model =
    input.model ??
    (input.modelPolicy
      ? getModelNameForPolicy(input.modelPolicy, { modelSeries: input.modelSeries })
      : null);
  if (!model) {
    return;
  }

  const { inputTokens, outputTokens, totalTokens } = normalizeUsage(input.usage);

  try {
    await db.insert(aiUsage).values({
      userId: normalizeTelemetryUserId(input.userId),
      requestId: input.requestId,
      endpoint: input.endpoint,
      intent: input.intent ?? input.capabilityMode ?? input.workflow,
      capabilityMode: input.capabilityMode ?? null,
      workflow: input.workflow,
      modelSeries: input.modelSeries ?? null,
      modelPolicy: input.modelPolicy ?? null,
      model,
      promptVersion: input.promptVersion,
      inputTokens,
      outputTokens,
      totalTokens,
      costCents: estimateCostCents(model, inputTokens, outputTokens),
      durationMs: input.durationMs,
      success: input.success ?? true,
      errorMessage: input.errorMessage,
      metadata: {
        ...input.metadata,
        capabilityMode: input.capabilityMode ?? null,
        modelSeries: input.modelSeries ?? null,
        modelPolicy: input.modelPolicy ?? null,
        resolvedModel: model,
      },
    });
  } catch (error) {
    console.error("[Telemetry] Failed to persist AI usage:", error);
  }
}
