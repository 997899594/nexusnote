export const RESEARCH_EVIDENCE_DOMAIN_VALUES = [
  "ai_frontier",
  "current_technology",
  "product_ecosystem",
  "general_current",
] as const;

export const RESEARCH_EVIDENCE_POLICY_REASON_CODE_VALUES = [
  "freshness_cue",
  "recent_year",
  "ai_frontier_domain",
  "technology_domain",
  "product_competitor_domain",
  "market_ecosystem_domain",
] as const;

const RESEARCH_EVIDENCE_REASON_CODE_VALUES = [
  ...RESEARCH_EVIDENCE_POLICY_REASON_CODE_VALUES,
  "model_freshness_decision",
] as const;

export type ResearchEvidenceDomain = (typeof RESEARCH_EVIDENCE_DOMAIN_VALUES)[number];
export type ResearchEvidenceRequirement = "required";
export type ResearchEvidenceReasonCode = (typeof RESEARCH_EVIDENCE_REASON_CODE_VALUES)[number];
export type ResearchEvidenceDecisionSource = "policy" | "model";
export type ResearchFreshnessProfile = "stable" | "current" | "frontier";
export type ResearchRetrievalMode = "targeted" | "deep";

export interface ResearchEvidencePlan {
  freshnessProfile: ResearchFreshnessProfile;
  retrievalMode: ResearchRetrievalMode;
  sourceTypes: Array<
    "official_docs" | "release_note" | "paper" | "source_code" | "technical_blog" | "news"
  >;
  rationale: string;
}

export interface ResearchEvidenceRequest {
  requirement: ResearchEvidenceRequirement;
  domain: ResearchEvidenceDomain;
  query: string;
  queries: string[];
  seedMessage: string;
  latestUserMessage: string;
  recentUserMessages: string[];
  freshnessWindowDays: 30 | 90 | 180;
  reasonCodes: ResearchEvidenceReasonCode[];
  outlineReadiness: "needs_interview" | "ready";
  decisionSource: ResearchEvidenceDecisionSource;
  plan: ResearchEvidencePlan;
}
