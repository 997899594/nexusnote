import type { UIMessage } from "ai";
import { extractUIMessageText } from "@/lib/ai/message-text";

export type ResearchEvidenceDomain = "ai_frontier" | "current_technology" | "general_current";
export type ResearchEvidenceRequirement = "required";
export type ResearchEvidenceReasonCode =
  | "freshness_cue"
  | "recent_year"
  | "ai_frontier_domain"
  | "technology_domain";

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
  shouldDraftWithEvidence: boolean;
}

const CURRENT_KNOWLEDGE_CUES = [
  "最新",
  "当前",
  "现在",
  "前沿",
  "活跃",
  "今年",
  "today",
  "latest",
  "current",
  "frontier",
  "state of the art",
  "sota",
];

const AI_FRONTIER_CUES = [
  "agent",
  "ai agent",
  "subagent",
  "multiagent",
  "multi-agent",
  "skill",
  "skill-based",
  "tool learning",
  "self-reflection",
  "state machine",
  "llm-as-judge",
  "test-time",
  "mcp",
  "智能体",
  "多智能体",
  "子智能体",
  "工具调用",
  "技能编排",
  "前沿知识",
  "ai 技术",
  "ai技术",
];

const TECHNOLOGY_CUES = [
  "api",
  "sdk",
  "模型",
  "框架",
  "架构",
  "工程",
  "技术",
  "系统",
  "产品",
  "部署",
  "选型",
  "integration",
  "framework",
  "release",
  "changelog",
];

const EVIDENCE_REASON_WEIGHTS: Record<ResearchEvidenceReasonCode, number> = {
  freshness_cue: 4,
  recent_year: 4,
  ai_frontier_domain: 3,
  technology_domain: 1,
};

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function hasAnyCue(message: string, cues: string[]): boolean {
  const normalized = message.toLowerCase();
  return cues.some((cue) => normalized.includes(cue.toLowerCase()));
}

function hasVersionedTechnologyCue(message: string): boolean {
  return /\b[a-z][\w.-]*(?:\.js)?\s+v?\d{1,2}(?:\.\d+){0,2}\b/iu.test(message);
}

function hasTechnologyCue(message: string): boolean {
  return hasAnyCue(message, TECHNOLOGY_CUES) || hasVersionedTechnologyCue(message);
}

function extractMentionedYears(message: string): number[] {
  const years = message.match(/\b20\d{2}\b/gu) ?? [];
  return years.map(Number).filter((year) => Number.isInteger(year));
}

function hasRecentYearCue(message: string, currentYear: number): boolean {
  return extractMentionedYears(message).some((year) => year >= currentYear - 1);
}

function getDomain(message: string): ResearchEvidenceDomain {
  if (hasAnyCue(message, AI_FRONTIER_CUES)) {
    return "ai_frontier";
  }

  if (hasTechnologyCue(message)) {
    return "current_technology";
  }

  return "general_current";
}

function getReasonCodes(message: string, currentYear: number): ResearchEvidenceReasonCode[] {
  const reasonCodes: ResearchEvidenceReasonCode[] = [];

  if (hasAnyCue(message, CURRENT_KNOWLEDGE_CUES)) {
    reasonCodes.push("freshness_cue");
  }
  if (hasRecentYearCue(message, currentYear)) {
    reasonCodes.push("recent_year");
  }
  if (hasAnyCue(message, AI_FRONTIER_CUES)) {
    reasonCodes.push("ai_frontier_domain");
  }
  if (hasTechnologyCue(message)) {
    reasonCodes.push("technology_domain");
  }

  return reasonCodes;
}

function getEvidenceScore(message: string, currentYear: number): number {
  return getReasonCodes(message, currentYear).reduce(
    (score, reasonCode) => score + EVIDENCE_REASON_WEIGHTS[reasonCode],
    0,
  );
}

function selectEvidenceSeedMessage(messages: string[], currentYear: number): string {
  const best = messages.reduce<{ message: string; score: number; index: number }>(
    (candidate, message, index) => {
      const score = getEvidenceScore(message, currentYear);
      if (score === 0) {
        return candidate;
      }

      if (score > candidate.score || (score === candidate.score && index > candidate.index)) {
        return { message, score, index };
      }

      return candidate;
    },
    { message: "", score: 0, index: -1 },
  );

  return best.message;
}

function buildQueryVariants(params: {
  query: string;
  domain: ResearchEvidenceDomain;
  currentYear: number;
}): string[] {
  const queries = new Set<string>();
  const normalizedQuery = normalizeText(params.query);

  if (normalizedQuery) {
    queries.add(normalizedQuery.slice(0, 280));
  }

  if (params.domain === "ai_frontier") {
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

  if (params.domain === "current_technology") {
    if (normalizedQuery) {
      queries.add(`${normalizedQuery} official docs release notes technical report`);
    }
    queries.add(`${params.currentYear} official docs release notes technical report architecture`);
  }

  return Array.from(queries).slice(0, 4);
}

export function extractRecentUserMessages(
  messages: Array<Pick<UIMessage, "role" | "parts">>,
  windowSize = 6,
): string[] {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => normalizeText(extractUIMessageText(message, { separator: " " })))
    .filter(Boolean)
    .slice(-windowSize);
}

export function resolveResearchEvidenceRequest(params: {
  userMessages: string[];
  currentDate?: Date;
}): ResearchEvidenceRequest | null {
  const currentYear = (params.currentDate ?? new Date()).getFullYear();
  const recentUserMessages = params.userMessages.map(normalizeText).filter(Boolean).slice(-6);
  const latestUserMessage = recentUserMessages.at(-1) ?? "";
  const seedMessage = selectEvidenceSeedMessage(recentUserMessages, currentYear);

  if (!seedMessage) {
    return null;
  }

  const query =
    latestUserMessage && latestUserMessage !== seedMessage
      ? `${seedMessage}\n\n用户当前选择/补充：${latestUserMessage}`
      : seedMessage;
  const domain = getDomain(`${seedMessage} ${latestUserMessage}`);
  const reasonCodes = Array.from(
    new Set([
      ...getReasonCodes(seedMessage, currentYear),
      ...getReasonCodes(latestUserMessage, currentYear),
    ]),
  );

  return {
    requirement: "required",
    domain,
    query,
    queries: buildQueryVariants({ query, domain, currentYear }),
    seedMessage,
    latestUserMessage,
    recentUserMessages,
    freshnessWindowDays:
      reasonCodes.includes("freshness_cue") || reasonCodes.includes("ai_frontier_domain") ? 30 : 90,
    reasonCodes,
    shouldDraftWithEvidence: true,
  };
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
