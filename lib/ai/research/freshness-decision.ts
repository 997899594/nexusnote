import { generateText, Output } from "ai";
import { z } from "zod";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import type { AIModelSeries } from "@/lib/ai/core/model-series";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import {
  type ModelFreshnessDecision,
  type ModelFreshnessDecisionInput,
  RESEARCH_EVIDENCE_DOMAIN_VALUES,
  RESEARCH_EVIDENCE_POLICY_REASON_CODE_VALUES,
} from "@/lib/ai/research/evidence-request";
import { shouldUseModelFreshnessPlanner } from "@/lib/ai/research/evidence-signals";

const MODEL_FRESHNESS_DECISION_PROMPT_VERSION = "research-freshness-decision@v1";
const MODEL_FRESHNESS_DECISION_TIMEOUT_MS = 12_000;

const freshnessDecisionSchema = z.object({
  requiresResearch: z.boolean(),
  domain: z.enum(RESEARCH_EVIDENCE_DOMAIN_VALUES).optional(),
  reasonCodes: z
    .array(z.enum(RESEARCH_EVIDENCE_POLICY_REASON_CODE_VALUES))
    .min(1)
    .max(4)
    .optional(),
  freshnessWindowDays: z.enum(["30", "90", "180"]).transform(Number).optional(),
  queryFocus: z.string().trim().min(1).max(180).optional(),
  freshnessProfile: z.enum(["stable", "current", "frontier"]).optional(),
  retrievalMode: z.enum(["targeted", "deep"]).optional(),
  sourceTypes: z
    .array(
      z.enum(["official_docs", "release_note", "paper", "source_code", "technical_blog", "news"]),
    )
    .min(1)
    .max(6)
    .optional(),
  rationale: z.string().trim().min(1).max(240).optional(),
});

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

export async function resolveModelFreshnessDecision(params: {
  input: ModelFreshnessDecisionInput;
  userId?: string;
  modelSeries?: AIModelSeries;
  currentDate?: Date;
}): Promise<ModelFreshnessDecision | null> {
  if (!shouldUseModelFreshnessPlanner(params.input)) {
    return null;
  }

  const telemetry = createTelemetryContext({
    endpoint: "research:freshness-decision",
    userId: params.userId,
    workflow: "research-freshness-decision",
    promptVersion: MODEL_FRESHNESS_DECISION_PROMPT_VERSION,
    modelPolicy: "interactive-fast",
    modelSeries: params.modelSeries,
    metadata: {
      policyDomain: params.input.policyDomain,
      policyReasonCodes: params.input.policyReasonCodes,
      ambiguousFreshnessSignals: params.input.ambiguousFreshnessSignals,
    },
  });
  const startedAt = Date.now();

  try {
    const result = await generateText({
      model: getPlainModelForPolicy("interactive-fast", { modelSeries: params.modelSeries }),
      output: Output.object({ schema: freshnessDecisionSchema }),
      system: renderPromptResource("research/freshness-decision-system.md", {}),
      prompt: renderPromptResource("research/freshness-decision-user.md", {
        current_date: (params.currentDate ?? new Date()).toISOString().slice(0, 10),
        recent_user_messages: params.input.recentUserMessages.join("\n"),
        seed_message: params.input.seedMessage,
        latest_user_message: params.input.latestUserMessage,
        policy_domain: params.input.policyDomain,
        policy_reason_codes: formatList(params.input.policyReasonCodes),
        ambiguous_signals: formatList(params.input.ambiguousFreshnessSignals),
      }),
      ...buildGenerationSettingsForPolicy(
        "interactive-fast",
        {
          temperature: 0,
          maxOutputTokens: 240,
        },
        { modelSeries: params.modelSeries },
      ),
      timeout: MODEL_FRESHNESS_DECISION_TIMEOUT_MS,
      maxRetries: 1,
    });

    void recordAIUsage({
      ...telemetry,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      success: true,
      metadata: {
        ...telemetry.metadata,
        requiresResearch: result.output.requiresResearch,
        decisionDomain: result.output.domain ?? null,
      },
    });

    return {
      requiresResearch: result.output.requiresResearch,
      domain: result.output.domain,
      reasonCodes: result.output.reasonCodes,
      freshnessWindowDays: result.output.freshnessWindowDays as 30 | 90 | 180 | undefined,
      queryFocus: result.output.queryFocus,
      freshnessProfile: result.output.freshnessProfile,
      retrievalMode: result.output.retrievalMode,
      sourceTypes: result.output.sourceTypes,
      rationale: result.output.rationale,
    };
  } catch (error) {
    void recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(error),
    });
    return null;
  }
}
