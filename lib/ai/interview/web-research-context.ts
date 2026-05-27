import type { UIMessage } from "ai";
import {
  type ResearchEvidenceRequest,
  resolveResearchEvidenceRequestFromMessages,
} from "@/lib/ai/research/evidence-request";
import {
  collectResearchEvidence,
  formatResearchEvidenceForPrompt,
  type ResearchRetrievalOutput,
} from "@/lib/ai/research/web-research";

export interface InterviewWebResearchContext {
  promptBlock: string;
  evidenceRequest: ResearchEvidenceRequest | null;
  retrieval: ResearchRetrievalOutput | null;
  shouldDraftOutline: boolean;
  evidenceAvailable: boolean;
}

export function shouldBuildInterviewWebResearchContext(
  messages: Array<Pick<UIMessage, "role" | "parts">>,
) {
  return Boolean(resolveResearchEvidenceRequestFromMessages({ messages }));
}

export async function resolveInterviewWebResearchContext(params: {
  userId: string;
  messages: Array<Pick<UIMessage, "role" | "parts">>;
}): Promise<InterviewWebResearchContext> {
  const evidenceRequest = resolveResearchEvidenceRequestFromMessages({
    messages: params.messages,
  });

  if (!evidenceRequest) {
    return {
      promptBlock: "",
      evidenceRequest: null,
      retrieval: null,
      shouldDraftOutline: false,
      evidenceAvailable: false,
    };
  }

  const output = await collectResearchEvidence({
    query: evidenceRequest.query,
    queries: evidenceRequest.queries,
    limit: 8,
    maxExtractedSources: 10,
    freshnessWindowDays: evidenceRequest.freshnessWindowDays,
    userId: params.userId,
  });

  if (!output.success) {
    return {
      promptBlock: [
        "## 当前外部资料状态",
        "本轮需要最新/前沿信息，但没有拿到可用联网证据。",
        "生成课程蓝图时必须明确标注“当前未完成联网核验”。",
        output.errors.length > 0 ? `失败原因：${output.errors[0]}` : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
      evidenceRequest,
      retrieval: output,
      shouldDraftOutline: evidenceRequest.shouldDraftWithEvidence,
      evidenceAvailable: false,
    };
  }

  return {
    promptBlock: [
      "## 当前外部资料",
      "以下来源已完成多路检索、页面正文读取、去重和重排。生成课程蓝图时必须使用 source id 写入 outline.researchCitations；不要只吸收结论后丢掉来源。",
      `检索时间：${new Date().toISOString()}`,
      `Evidence Request: domain=${evidenceRequest.domain}; reasons=${evidenceRequest.reasonCodes.join(",")}`,
      `查询：${output.queries.join(" | ")}`,
      "",
      formatResearchEvidenceForPrompt(output.sources),
      "",
      "使用规则：",
      "- 涉及最新技术、模型、版本、生态判断时，优先依据 primary/high 来源。",
      "- 如果证据不足，直接写成待核验，不要编造确定结论。",
      "- 课程结构要区分稳定基础能力和近期活跃方向。",
      "- presentOutlinePreview 的 outline.researchCitations 必须引用上面的 source id、title、url、domain、provider；如果来源有 Extractor，也要写入 extractProvider。",
    ].join("\n"),
    evidenceRequest,
    retrieval: output,
    shouldDraftOutline: evidenceRequest.shouldDraftWithEvidence,
    evidenceAvailable: true,
  };
}

export async function buildInterviewWebResearchContext(params: {
  userId: string;
  messages: Array<Pick<UIMessage, "role" | "parts">>;
}) {
  const context = await resolveInterviewWebResearchContext(params);
  return context.promptBlock;
}
