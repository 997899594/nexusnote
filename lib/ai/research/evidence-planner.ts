import type { UIMessage } from "ai";
import type { AIModelSeries } from "@/lib/ai/core/model-series";
import {
  createResearchEvidenceDecisionInput,
  createResearchEvidenceDecisionInputFromMessages,
  type ModelFreshnessDecision,
  type ModelFreshnessDecisionInput,
  type ResearchEvidenceRequest,
  resolveResearchEvidenceRequest,
  resolveResearchEvidenceRequestFromMessages,
  resolveResearchEvidenceRequestFromModelDecision,
} from "@/lib/ai/research/evidence-request";
import { shouldUseModelFreshnessPlanner } from "@/lib/ai/research/evidence-signals";

export type FreshnessDecisionResolver = (params: {
  input: ModelFreshnessDecisionInput;
  userId?: string;
  modelSeries?: AIModelSeries;
  currentDate?: Date;
}) => Promise<ModelFreshnessDecision | null>;

async function resolveDefaultModelFreshnessDecision(
  params: Parameters<FreshnessDecisionResolver>[0],
): Promise<ModelFreshnessDecision | null> {
  const { resolveModelFreshnessDecision } = await import("@/lib/ai/research/freshness-decision");
  return resolveModelFreshnessDecision(params);
}

async function resolveWithModelPlanner(params: {
  decisionInput: ModelFreshnessDecisionInput | null;
  userId?: string;
  modelSeries?: AIModelSeries;
  currentDate?: Date;
  decisionResolver?: FreshnessDecisionResolver;
}): Promise<ResearchEvidenceRequest | null> {
  if (!params.decisionInput || !shouldUseModelFreshnessPlanner(params.decisionInput)) {
    return null;
  }

  const decision = await (params.decisionResolver ?? resolveDefaultModelFreshnessDecision)({
    input: params.decisionInput,
    userId: params.userId,
    modelSeries: params.modelSeries,
    currentDate: params.currentDate,
  });

  return decision
    ? resolveResearchEvidenceRequestFromModelDecision({
        decisionInput: params.decisionInput,
        decision,
      })
    : null;
}

export async function resolveResearchEvidenceRequestWithPlanner(params: {
  userMessages: string[];
  currentDate?: Date;
  userId?: string;
  modelSeries?: AIModelSeries;
  decisionResolver?: FreshnessDecisionResolver;
}): Promise<ResearchEvidenceRequest | null> {
  const decisionInput = createResearchEvidenceDecisionInput({
    userMessages: params.userMessages,
    currentDate: params.currentDate,
  });
  const modelRequest = await resolveWithModelPlanner({
    decisionInput,
    userId: params.userId,
    modelSeries: params.modelSeries,
    currentDate: params.currentDate,
    decisionResolver: params.decisionResolver,
  });

  return (
    modelRequest ??
    resolveResearchEvidenceRequest({
      userMessages: params.userMessages,
      currentDate: params.currentDate,
    })
  );
}

export async function resolveResearchEvidenceRequestFromMessagesWithPlanner(params: {
  messages: Array<Pick<UIMessage, "role" | "parts">>;
  currentDate?: Date;
  userId?: string;
  modelSeries?: AIModelSeries;
  decisionResolver?: FreshnessDecisionResolver;
}): Promise<ResearchEvidenceRequest | null> {
  const decisionInput = createResearchEvidenceDecisionInputFromMessages({
    messages: params.messages,
    currentDate: params.currentDate,
  });
  const modelRequest = await resolveWithModelPlanner({
    decisionInput,
    userId: params.userId,
    modelSeries: params.modelSeries,
    currentDate: params.currentDate,
    decisionResolver: params.decisionResolver,
  });

  return (
    modelRequest ??
    resolveResearchEvidenceRequestFromMessages({
      messages: params.messages,
      currentDate: params.currentDate,
    })
  );
}
