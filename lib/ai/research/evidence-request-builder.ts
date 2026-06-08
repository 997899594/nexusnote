import { normalizeEvidenceText } from "@/lib/ai/research/evidence-signals";
import type {
  ResearchEvidenceDecisionSource,
  ResearchEvidenceDomain,
  ResearchEvidencePlan,
  ResearchEvidenceReasonCode,
} from "@/lib/ai/research/evidence-types";

export function buildResearchEvidenceQueryVariants(params: {
  query: string;
  domain: ResearchEvidenceDomain;
  currentYear: number;
}): string[] {
  const queries = new Set<string>();
  const normalizedQuery = normalizeEvidenceText(params.query);

  if (normalizedQuery) {
    queries.add(normalizedQuery.slice(0, 280));
  }

  if (params.domain === "ai_frontier") {
    if (normalizedQuery) {
      queries.add(
        `${normalizedQuery} official docs product updates comparison ${params.currentYear}`,
      );
    }
    queries.add(
      [
        params.currentYear,
        "AI agents subagents multi-agent systems skill-based agents MCP official docs papers",
      ].join(" "),
    );
    queries.add(
      [
        params.currentYear,
        "LLM agents tool use orchestration LLM-as-judge test-time scaling technical reports",
      ].join(" "),
    );
  }

  if (params.domain === "product_ecosystem") {
    if (normalizedQuery) {
      queries.add(`${normalizedQuery} official docs pricing release notes ${params.currentYear}`);
      queries.add(`${normalizedQuery} competitors alternatives comparison ${params.currentYear}`);
      queries.add(`${normalizedQuery} product design UX workflow ${params.currentYear}`);
    }
    queries.add(`${params.currentYear} AI product competitors official docs pricing comparison`);
  }

  if (params.domain === "current_technology") {
    if (normalizedQuery) {
      queries.add(`${normalizedQuery} official docs release notes technical report`);
    }
    queries.add(`${params.currentYear} official docs release notes technical report architecture`);
  }

  return Array.from(queries).slice(0, 4);
}

export function getDefaultFreshnessWindowDays(params: {
  reasonCodes: ResearchEvidenceReasonCode[];
  domain: ResearchEvidenceDomain;
}): 30 | 90 | 180 {
  if (
    params.reasonCodes.includes("freshness_cue") ||
    params.reasonCodes.includes("ai_frontier_domain") ||
    params.reasonCodes.includes("product_competitor_domain") ||
    params.domain === "product_ecosystem"
  ) {
    return 30;
  }

  if (params.domain === "current_technology") {
    return 90;
  }

  return 180;
}

export function createDefaultEvidencePlan(params: {
  domain: ResearchEvidenceDomain;
  reasonCodes: ResearchEvidenceReasonCode[];
  freshnessWindowDays: 30 | 90 | 180;
  decisionSource: ResearchEvidenceDecisionSource;
  modelPlan?: Partial<ResearchEvidencePlan>;
}): ResearchEvidencePlan {
  const freshnessProfile =
    params.modelPlan?.freshnessProfile ??
    (params.freshnessWindowDays === 30
      ? "frontier"
      : params.freshnessWindowDays === 90
        ? "current"
        : "stable");
  const retrievalMode =
    params.modelPlan?.retrievalMode ??
    (params.domain === "ai_frontier" || params.domain === "product_ecosystem"
      ? "deep"
      : "targeted");
  const sourceTypes =
    params.modelPlan?.sourceTypes ??
    (params.domain === "product_ecosystem"
      ? (["official_docs", "release_note", "news", "technical_blog"] as const)
      : params.domain === "ai_frontier"
        ? (["official_docs", "paper", "source_code", "technical_blog"] as const)
        : (["official_docs", "release_note", "technical_blog"] as const));

  return {
    freshnessProfile,
    retrievalMode,
    sourceTypes: [...sourceTypes],
    rationale:
      params.modelPlan?.rationale ??
      `Evidence ${params.decisionSource} selected ${params.domain} from ${params.reasonCodes.join(",")}.`,
  };
}
