import type { ModelFreshnessDecisionInput } from "@/lib/ai/research/evidence-request";
import type {
  ResearchEvidenceDomain,
  ResearchEvidenceReasonCode,
  ResearchEvidenceRequest,
} from "@/lib/ai/research/evidence-types";

const CUES = {
  current: [
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
  ],
  productCompetitor: [
    "竞品",
    "竞对",
    "类似",
    "同类",
    "替代",
    "替代品",
    "平替",
    "对比",
    "比较",
    "差异",
    "选型",
    "产品",
    "工具",
    "平台",
    "体验",
    "设计",
    "交互",
    "工作流",
    "生态",
    "商业化",
    "alternatives",
    "alternative",
    "competitor",
    "competitors",
    "competition",
    "comparison",
    "compare",
    "versus",
    " vs ",
    "product",
    "tool",
    "platform",
    "workflow",
    "ecosystem",
    "market",
    "ux",
    "ui",
    "design",
  ],
  marketEcosystem: [
    "公司",
    "厂商",
    "服务商",
    "价格",
    "定价",
    "套餐",
    "发布",
    "更新",
    "路线图",
    "趋势",
    "榜单",
    "排行",
    "融资",
    "收购",
    "用户量",
    "市场份额",
    "pricing",
    "plan",
    "plans",
    "release",
    "launched",
    "roadmap",
    "trend",
    "rank",
    "funding",
    "acquisition",
    "market share",
  ],
  ambiguousFreshness: [
    "怎么选",
    "哪个好",
    "推荐",
    "主流",
    "流行",
    "趋势",
    "案例",
    "最佳实践",
    "方案",
    "modern",
    "best practice",
    "recommended",
    "popular",
    "trend",
    "case study",
  ],
  currentProduct: [
    "claude",
    "anthropic",
    "chatgpt",
    "openai",
    "gpt",
    "gemini",
    "deepmind",
    "perplexity",
    "copilot",
    "microsoft copilot",
    "cursor",
    "windsurf",
    "v0",
    "lovable",
    "bolt",
    "bolt.new",
    "replit",
    "notion ai",
    "figma ai",
    "midjourney",
    "runway",
    "suno",
    "qwen",
    "通义",
    "千问",
    "deepseek",
    "豆包",
    "kimi",
    "月之暗面",
    "智谱",
    "glm",
    "腾讯元宝",
    "文心一言",
    "coze",
    "扣子",
    "dify",
    "langchain",
    "llamaindex",
  ],
  aiFrontier: [
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
    "人工智能",
  ],
  technology: ["api", "sdk", "模型", "框架", "架构", "工程", "技术", "系统", "部署", "integration"],
} as const;

const EVIDENCE_REASON_WEIGHTS: Record<ResearchEvidenceReasonCode, number> = {
  freshness_cue: 4,
  recent_year: 4,
  ai_frontier_domain: 3,
  technology_domain: 1,
  product_competitor_domain: 3,
  market_ecosystem_domain: 2,
  model_freshness_decision: 3,
};

export function normalizeEvidenceText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function hasAnyCue(message: string, cues: readonly string[]): boolean {
  const normalized = message.toLowerCase();
  return cues.some((cue) => normalized.includes(cue.toLowerCase()));
}

function hasStandaloneAiCue(message: string): boolean {
  return /(^|[\s,.;:!?，。！？、])ai($|[\s,.;:!?，。！？、])/iu.test(message);
}

function hasAiFrontierCue(message: string): boolean {
  return (
    hasStandaloneAiCue(message) ||
    hasAnyCue(message, CUES.aiFrontier) ||
    hasAnyCue(message, CUES.currentProduct)
  );
}

function hasVersionedTechnologyCue(message: string): boolean {
  return /\b[a-z][\w.-]*(?:\.js)?\s+v?\d{1,2}(?:\.\d+){0,2}\b/iu.test(message);
}

function hasTechnologyCue(message: string): boolean {
  return hasAnyCue(message, CUES.technology) || hasVersionedTechnologyCue(message);
}

function hasProductCompetitorCue(message: string): boolean {
  return hasAnyCue(message, CUES.productCompetitor);
}

function hasCurrentProductCue(message: string): boolean {
  return hasAnyCue(message, CUES.currentProduct);
}

function hasMarketEcosystemCue(message: string): boolean {
  return hasAnyCue(message, CUES.marketEcosystem);
}

function hasQualifiedMarketEcosystemCue(message: string): boolean {
  return (
    hasMarketEcosystemCue(message) &&
    (hasCurrentProductCue(message) ||
      hasProductCompetitorCue(message) ||
      hasAnyCue(message, CUES.current))
  );
}

function hasTopicSignal(message: string): boolean {
  return /想学|学习|课程|ai|人工智能|agent|智能体|React|SQL|Python|PPT|汇报|作品集|转岗|求职|数据分析|前端|运营/iu.test(
    message,
  );
}

function hasBaselineSignal(message: string): boolean {
  return /零基础|基础|我会|会一点|学过|用过|目前|现在|已经|熟悉|不熟|小白|入门/iu.test(message);
}

function hasOutcomeSignal(message: string): boolean {
  return /想.*做|做一个|完成|独立完成|作品集|项目|落地|应用|提效|工作|业务|转岗|求职|面试|汇报|考试|两周后|一个月|三个月|方案|产品/iu.test(
    message,
  );
}

export function resolveOutlineReadiness(
  messages: string[],
): ResearchEvidenceRequest["outlineReadiness"] {
  const joined = messages.join("\n");

  return hasTopicSignal(joined) && hasBaselineSignal(joined) && hasOutcomeSignal(joined)
    ? "ready"
    : "needs_interview";
}

function extractMentionedYears(message: string): number[] {
  const years = message.match(/\b20\d{2}\b/gu) ?? [];
  return years.map(Number).filter((year) => Number.isInteger(year));
}

function hasRecentYearCue(message: string, currentYear: number): boolean {
  return extractMentionedYears(message).some((year) => year >= currentYear - 1);
}

export function getEvidenceDomain(message: string): ResearchEvidenceDomain {
  if (
    hasCurrentProductCue(message) &&
    (hasProductCompetitorCue(message) || hasQualifiedMarketEcosystemCue(message))
  ) {
    return "product_ecosystem";
  }

  if (hasAiFrontierCue(message)) {
    return "ai_frontier";
  }

  if (hasTechnologyCue(message) || hasProductCompetitorCue(message)) {
    return "current_technology";
  }

  return "general_current";
}

export function getEvidenceReasonCodes(
  message: string,
  currentYear: number,
): ResearchEvidenceReasonCode[] {
  const reasonCodes: ResearchEvidenceReasonCode[] = [];

  if (hasAnyCue(message, CUES.current) || hasVersionedTechnologyCue(message)) {
    reasonCodes.push("freshness_cue");
  }
  if (hasRecentYearCue(message, currentYear)) {
    reasonCodes.push("recent_year");
  }
  if (hasAiFrontierCue(message)) {
    reasonCodes.push("ai_frontier_domain");
  }
  if (hasTechnologyCue(message)) {
    reasonCodes.push("technology_domain");
  }
  if (hasCurrentProductCue(message) && hasProductCompetitorCue(message)) {
    reasonCodes.push("product_competitor_domain");
  }
  if (hasQualifiedMarketEcosystemCue(message)) {
    reasonCodes.push("market_ecosystem_domain");
  }

  return reasonCodes;
}

function getEvidenceScore(message: string, currentYear: number): number {
  return getEvidenceReasonCodes(message, currentYear).reduce(
    (score, reasonCode) => score + EVIDENCE_REASON_WEIGHTS[reasonCode],
    0,
  );
}

export function getAmbiguousFreshnessSignals(message: string): string[] {
  const normalized = message.toLowerCase();
  return CUES.ambiguousFreshness
    .filter((cue) => normalized.includes(cue.toLowerCase()))
    .slice(0, 6);
}

export function selectEvidenceSeedMessage(messages: string[], currentYear: number): string {
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

export function shouldUsePolicyEvidenceRequest(params: {
  domain: ResearchEvidenceDomain;
  reasonCodes: ResearchEvidenceReasonCode[];
}): boolean {
  const reasonCodes = new Set(params.reasonCodes);

  return (
    params.domain === "ai_frontier" ||
    params.domain === "product_ecosystem" ||
    reasonCodes.has("freshness_cue") ||
    reasonCodes.has("recent_year") ||
    reasonCodes.has("product_competitor_domain") ||
    reasonCodes.has("market_ecosystem_domain")
  );
}

export function shouldUseModelFreshnessPlanner(input: ModelFreshnessDecisionInput): boolean {
  if (input.policyReasonCodes.length > 0 || input.ambiguousFreshnessSignals.length > 0) {
    return true;
  }

  const joined = input.recentUserMessages.join("\n");
  return (
    hasAnyCue(joined, CUES.currentProduct) ||
    hasAnyCue(joined, CUES.productCompetitor) ||
    hasAnyCue(joined, CUES.marketEcosystem) ||
    hasAnyCue(joined, CUES.current) ||
    hasTechnologyCue(joined)
  );
}
