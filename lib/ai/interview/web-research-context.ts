import type { UIMessage } from "ai";
import {
  collectResearchEvidence,
  formatResearchEvidenceForPrompt,
} from "@/lib/ai/research/web-research";
import { extractUIMessageText } from "../message-text";

const CURRENT_KNOWLEDGE_CUES = [
  "最新",
  "当前",
  "现在",
  "前沿",
  "活跃",
  "今年",
  "2025",
  "2026",
  "today",
  "latest",
  "current",
  "frontier",
  "subagent",
  "skill",
  "skill-based",
  "tool learning",
  "self-reflection",
  "state machine",
  "llm-as-judge",
  "test-time",
  "mcp",
  "agent",
];

const AI_FRONTIER_CUES = [
  "subagent",
  "skill",
  "skill-based",
  "tool learning",
  "self-reflection",
  "state machine",
  "llm-as-judge",
  "test-time",
  "mcp",
  "agent",
  "智能体",
  "工具调用",
  "前沿知识",
  "ai 技术",
  "ai技术",
];

function getRecentUserMessages(messages: Array<Pick<UIMessage, "role" | "parts">>) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => extractUIMessageText(message, { separator: " " }).trim())
    .filter(Boolean);
}

function getLatestUserMessage(messages: Array<Pick<UIMessage, "role" | "parts">>) {
  return getRecentUserMessages(messages).at(-1) ?? "";
}

function hasAnyCue(message: string, cues: string[]) {
  const normalized = message.toLowerCase();
  return cues.some((cue) => normalized.includes(cue.toLowerCase()));
}

export function shouldBuildInterviewWebResearchContext(
  messages: Array<Pick<UIMessage, "role" | "parts">>,
) {
  return getRecentUserMessages(messages)
    .slice(-4)
    .some((message) => hasAnyCue(message, CURRENT_KNOWLEDGE_CUES));
}

function buildSearchQueries(latestUserMessage: string) {
  const queries = new Set<string>();
  const normalizedMessage = latestUserMessage.replace(/\s+/g, " ").trim();

  if (normalizedMessage) {
    queries.add(normalizedMessage.slice(0, 240));
  }

  if (hasAnyCue(latestUserMessage, AI_FRONTIER_CUES)) {
    queries.add("2026 AI agents subagents skill-based agents tool learning official docs papers");
    queries.add("MCP LLM-as-judge test-time scaling agent systems release notes technical reports");
  }

  return Array.from(queries).slice(0, 3);
}

export async function buildInterviewWebResearchContext(params: {
  userId: string;
  messages: Array<Pick<UIMessage, "role" | "parts">>;
}) {
  const latestUserMessage = getLatestUserMessage(params.messages);
  if (!shouldBuildInterviewWebResearchContext(params.messages)) {
    return "";
  }
  const researchSeedMessage =
    [...getRecentUserMessages(params.messages)]
      .reverse()
      .find((message) => hasAnyCue(message, CURRENT_KNOWLEDGE_CUES)) ?? latestUserMessage;
  const query =
    latestUserMessage && latestUserMessage !== researchSeedMessage
      ? `${researchSeedMessage}\n\n用户当前选择/补充：${latestUserMessage}`
      : researchSeedMessage;

  const output = await collectResearchEvidence({
    query,
    queries: buildSearchQueries(query),
    limit: 8,
    maxExtractedSources: 10,
    freshnessWindowDays: 30,
    userId: params.userId,
  });

  if (!output.success) {
    return [
      "## 当前外部资料状态",
      "本轮需要最新/前沿信息，但没有拿到可用联网证据。",
      "生成课程蓝图时必须明确标注“当前未完成联网核验”。",
      output.errors.length > 0 ? `失败原因：${output.errors[0]}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");
  }

  return [
    "## 当前外部资料",
    "以下来源已完成多路检索、页面正文读取、去重和重排。生成课程蓝图时必须使用 source id 写入 outline.researchCitations；不要只吸收结论后丢掉来源。",
    `检索时间：${new Date().toISOString()}`,
    `查询：${output.queries.join(" | ")}`,
    "",
    formatResearchEvidenceForPrompt(output.sources),
    "",
    "使用规则：",
    "- 涉及最新技术、模型、版本、生态判断时，优先依据 primary/high 来源。",
    "- 如果证据不足，直接写成待核验，不要编造确定结论。",
    "- 课程结构要区分稳定基础能力和近期活跃方向。",
    "- presentOutlinePreview 的 outline.researchCitations 必须引用上面的 source id、title、url、domain、provider；如果来源有 Extractor，也要写入 extractProvider。",
  ].join("\n");
}
