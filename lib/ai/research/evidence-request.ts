import type { UIMessage } from "ai";
import { extractUIMessageText } from "@/lib/ai/message-text";
import {
  buildResearchEvidenceQueryVariants,
  createDefaultEvidencePlan,
  getDefaultFreshnessWindowDays,
} from "@/lib/ai/research/evidence-request-builder";
import {
  getAmbiguousFreshnessSignals,
  getEvidenceDomain,
  getEvidenceReasonCodes,
  normalizeEvidenceText,
  resolveOutlineReadiness,
  selectEvidenceSeedMessage,
  shouldUsePolicyEvidenceRequest,
} from "@/lib/ai/research/evidence-signals";
import type {
  ResearchEvidenceDecisionSource,
  ResearchEvidenceDomain,
  ResearchEvidencePlan,
  ResearchEvidenceReasonCode,
  ResearchEvidenceRequest,
  ResearchFreshnessProfile,
  ResearchRetrievalMode,
} from "@/lib/ai/research/evidence-types";

export type {
  ResearchEvidenceDecisionSource,
  ResearchEvidenceDomain,
  ResearchEvidencePlan,
  ResearchEvidenceReasonCode,
  ResearchEvidenceRequest,
  ResearchEvidenceRequirement,
  ResearchFreshnessProfile,
  ResearchRetrievalMode,
} from "@/lib/ai/research/evidence-types";
export {
  RESEARCH_EVIDENCE_DOMAIN_VALUES,
  RESEARCH_EVIDENCE_POLICY_REASON_CODE_VALUES,
} from "@/lib/ai/research/evidence-types";

interface ResearchEvidenceMessageContext {
  currentYear: number;
  recentUserMessages: string[];
  latestUserMessage: string;
  seedMessage: string;
  query: string;
  outlineReadiness: ResearchEvidenceRequest["outlineReadiness"];
}

export interface ModelFreshnessDecisionInput extends ResearchEvidenceMessageContext {
  policyReasonCodes: ResearchEvidenceReasonCode[];
  policyDomain: ResearchEvidenceDomain;
  ambiguousFreshnessSignals: string[];
}

export interface ModelFreshnessDecision {
  requiresResearch: boolean;
  domain?: ResearchEvidenceDomain;
  reasonCodes?: ResearchEvidenceReasonCode[];
  freshnessWindowDays?: 30 | 90 | 180;
  queryFocus?: string;
  freshnessProfile?: ResearchFreshnessProfile;
  retrievalMode?: ResearchRetrievalMode;
  sourceTypes?: ResearchEvidencePlan["sourceTypes"];
  rationale?: string;
}

function extractRecentUserMessages(
  messages: Array<Pick<UIMessage, "role" | "parts">>,
  windowSize = 6,
): string[] {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => normalizeEvidenceText(extractUIMessageText(message, { separator: " " })))
    .filter(Boolean)
    .slice(-windowSize);
}

function createResearchEvidenceMessageContext(params: {
  userMessages: string[];
  currentDate?: Date;
}): ResearchEvidenceMessageContext | null {
  const currentYear = (params.currentDate ?? new Date()).getFullYear();
  const recentUserMessages = params.userMessages
    .map(normalizeEvidenceText)
    .filter(Boolean)
    .slice(-6);
  const latestUserMessage = recentUserMessages.at(-1) ?? "";
  const seedMessage = selectEvidenceSeedMessage(recentUserMessages, currentYear);

  if (!seedMessage) {
    return null;
  }

  const query =
    latestUserMessage && latestUserMessage !== seedMessage
      ? `${seedMessage}\n\n用户当前选择/补充：${latestUserMessage}`
      : seedMessage;

  return {
    currentYear,
    recentUserMessages,
    latestUserMessage,
    seedMessage,
    query,
    outlineReadiness: resolveOutlineReadiness(recentUserMessages),
  };
}

export function createResearchEvidenceDecisionInput(params: {
  userMessages: string[];
  currentDate?: Date;
}): ModelFreshnessDecisionInput | null {
  const currentYear = (params.currentDate ?? new Date()).getFullYear();
  const recentUserMessages = params.userMessages
    .map(normalizeEvidenceText)
    .filter(Boolean)
    .slice(-6);
  const latestUserMessage = recentUserMessages.at(-1) ?? "";
  const seedMessage =
    selectEvidenceSeedMessage(recentUserMessages, currentYear) || latestUserMessage;

  if (!seedMessage) {
    return null;
  }

  const query =
    latestUserMessage && latestUserMessage !== seedMessage
      ? `${seedMessage}\n\n用户当前选择/补充：${latestUserMessage}`
      : seedMessage;
  const combinedMessage = `${seedMessage} ${latestUserMessage}`;

  return {
    currentYear,
    recentUserMessages,
    latestUserMessage,
    seedMessage,
    query,
    outlineReadiness: resolveOutlineReadiness(recentUserMessages),
    policyReasonCodes: Array.from(
      new Set([
        ...getEvidenceReasonCodes(seedMessage, currentYear),
        ...getEvidenceReasonCodes(latestUserMessage, currentYear),
      ]),
    ),
    policyDomain: getEvidenceDomain(combinedMessage),
    ambiguousFreshnessSignals: getAmbiguousFreshnessSignals(combinedMessage),
  };
}

function createResearchEvidenceRequest(params: {
  context: ResearchEvidenceMessageContext;
  domain: ResearchEvidenceDomain;
  reasonCodes: ResearchEvidenceReasonCode[];
  decisionSource: ResearchEvidenceDecisionSource;
  freshnessWindowDays?: 30 | 90 | 180;
  queryFocus?: string;
  plan?: Partial<ResearchEvidencePlan>;
}): ResearchEvidenceRequest {
  const query = params.queryFocus
    ? `${params.context.query}\n\n研究重点：${normalizeEvidenceText(params.queryFocus)}`
    : params.context.query;
  const reasonCodes = Array.from(new Set(params.reasonCodes));
  const freshnessWindowDays =
    params.freshnessWindowDays ??
    getDefaultFreshnessWindowDays({
      reasonCodes,
      domain: params.domain,
    });

  return {
    requirement: "required",
    domain: params.domain,
    query,
    queries: buildResearchEvidenceQueryVariants({
      query,
      domain: params.domain,
      currentYear: params.context.currentYear,
    }),
    seedMessage: params.context.seedMessage,
    latestUserMessage: params.context.latestUserMessage,
    recentUserMessages: params.context.recentUserMessages,
    freshnessWindowDays,
    reasonCodes,
    outlineReadiness: params.context.outlineReadiness,
    decisionSource: params.decisionSource,
    plan: createDefaultEvidencePlan({
      domain: params.domain,
      reasonCodes,
      freshnessWindowDays,
      decisionSource: params.decisionSource,
      modelPlan: params.plan,
    }),
  };
}

export function resolveResearchEvidenceRequest(params: {
  userMessages: string[];
  currentDate?: Date;
}): ResearchEvidenceRequest | null {
  const context = createResearchEvidenceMessageContext(params);

  if (!context) {
    return null;
  }

  const { currentYear, latestUserMessage, seedMessage } = context;
  const domain = getEvidenceDomain(`${seedMessage} ${latestUserMessage}`);
  const reasonCodes = Array.from(
    new Set([
      ...getEvidenceReasonCodes(seedMessage, currentYear),
      ...getEvidenceReasonCodes(latestUserMessage, currentYear),
    ]),
  );

  if (!shouldUsePolicyEvidenceRequest({ domain, reasonCodes })) {
    return null;
  }

  return createResearchEvidenceRequest({
    context,
    domain,
    reasonCodes,
    decisionSource: "policy",
  });
}

export function resolveResearchEvidenceRequestFromModelDecision(params: {
  decisionInput: ModelFreshnessDecisionInput;
  decision: ModelFreshnessDecision;
}): ResearchEvidenceRequest | null {
  if (!params.decision.requiresResearch) {
    return null;
  }

  const reasonCodes: ResearchEvidenceReasonCode[] = Array.from(
    new Set([
      ...params.decisionInput.policyReasonCodes,
      ...(params.decision.reasonCodes ?? []),
      "model_freshness_decision" satisfies ResearchEvidenceReasonCode,
    ]),
  );

  return createResearchEvidenceRequest({
    context: params.decisionInput,
    domain: params.decision.domain ?? params.decisionInput.policyDomain,
    reasonCodes,
    decisionSource: "model",
    freshnessWindowDays: params.decision.freshnessWindowDays,
    queryFocus: params.decision.queryFocus,
    plan: {
      freshnessProfile: params.decision.freshnessProfile,
      retrievalMode: params.decision.retrievalMode,
      sourceTypes: params.decision.sourceTypes,
      rationale: params.decision.rationale,
    },
  });
}

export function resolveResearchEvidenceRequestFromMessages(params: {
  messages: Array<Pick<UIMessage, "role" | "parts">>;
  currentDate?: Date;
}): ResearchEvidenceRequest | null {
  return resolveResearchEvidenceRequest({
    userMessages: extractRecentUserMessages(params.messages),
    currentDate: params.currentDate,
  });
}

export function createResearchEvidenceDecisionInputFromMessages(params: {
  messages: Array<Pick<UIMessage, "role" | "parts">>;
  currentDate?: Date;
}): ModelFreshnessDecisionInput | null {
  return createResearchEvidenceDecisionInput({
    userMessages: extractRecentUserMessages(params.messages),
    currentDate: params.currentDate,
  });
}
