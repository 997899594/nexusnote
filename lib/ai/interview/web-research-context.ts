import type { UIMessage } from "ai";
import type { AIModelSeries } from "@/lib/ai/core/model-series";
import { resolveResearchEvidenceRequestFromMessagesWithPlanner } from "@/lib/ai/research/evidence-planner";
import type { ResearchEvidenceRequest } from "@/lib/ai/research/evidence-request";
import {
  buildResearchEvidenceSnapshot,
  type ResearchEvidenceSnapshot,
} from "@/lib/ai/research/evidence-snapshot";
import {
  collectResearchEvidence,
  formatResearchEvidenceForPrompt,
  type ResearchEvidenceProgress,
  type ResearchRetrievalOutput,
} from "@/lib/ai/research/web-research";

export interface InterviewWebResearchContext {
  promptBlock: string;
  evidenceRequest: ResearchEvidenceRequest | null;
  retrieval: ResearchRetrievalOutput | null;
  evidenceSnapshot: ResearchEvidenceSnapshot | null;
  shouldDraftOutline: boolean;
  evidenceAvailable: boolean;
}

function getResearchUnavailablePromptText(output: ResearchRetrievalOutput): string {
  switch (output.unavailableReason) {
    case "disabled":
    case "not_configured":
      return "本轮需要最新/前沿信息，但系统检索服务未启用。";
    case "provider_error":
      return "本轮需要最新/前沿信息，但检索服务异常，未完成来源校准。";
    case "no_results":
      return "本轮需要最新/前沿信息，但没有找到可用来源。";
    default:
      return "本轮需要最新/前沿信息，但未完成外部来源校准。";
  }
}

export async function resolveInterviewWebResearchContext(params: {
  userId: string;
  messages: Array<Pick<UIMessage, "role" | "parts">>;
  modelSeries?: AIModelSeries;
  enabled?: boolean;
  onRequest?: (request: ResearchEvidenceRequest) => void | Promise<void>;
  onProgress?: (progress: ResearchEvidenceProgress) => void | Promise<void>;
}): Promise<InterviewWebResearchContext> {
  if (params.enabled === false) {
    return {
      promptBlock: "",
      evidenceRequest: null,
      retrieval: null,
      evidenceSnapshot: null,
      shouldDraftOutline: false,
      evidenceAvailable: false,
    };
  }

  const evidenceRequest = await resolveResearchEvidenceRequestFromMessagesWithPlanner({
    messages: params.messages,
    userId: params.userId,
    modelSeries: params.modelSeries,
  });

  if (!evidenceRequest) {
    return {
      promptBlock: "",
      evidenceRequest: null,
      retrieval: null,
      evidenceSnapshot: null,
      shouldDraftOutline: false,
      evidenceAvailable: false,
    };
  }

  await params.onRequest?.(evidenceRequest);

  const output = await collectResearchEvidence({
    query: evidenceRequest.query,
    queries: evidenceRequest.queries,
    limit: 8,
    maxExtractedSources: 10,
    freshnessWindowDays: evidenceRequest.freshnessWindowDays,
    userId: params.userId,
    onProgress: params.onProgress,
  });

  if (!output.success) {
    const evidenceSnapshot = buildResearchEvidenceSnapshot({
      request: evidenceRequest,
      retrieval: output,
    });

    return {
      promptBlock: [
        "## 当前外部资料状态",
        getResearchUnavailablePromptText(output),
        evidenceRequest.outlineReadiness === "ready"
          ? "如果生成课程蓝图，只需简短标注“当前未完成联网核验”。"
          : "如果访谈信息还不完整，先继续追问关键约束，不要因为检索失败而生成蓝图，也不要在正文解释检索失败。",
        output.errors.length > 0 ? `失败原因：${output.errors[0]}` : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
      evidenceRequest,
      retrieval: output,
      evidenceSnapshot,
      shouldDraftOutline: evidenceRequest.outlineReadiness === "ready",
      evidenceAvailable: false,
    };
  }

  const evidenceSnapshot = buildResearchEvidenceSnapshot({
    request: evidenceRequest,
    retrieval: output,
  });

  return {
    promptBlock: [
      "## 当前外部资料",
      "以下来源已完成多路检索、页面正文读取、去重和重排。它们是本轮事实校准材料，不代表访谈信息已经足够。",
      `检索时间：${new Date().toISOString()}`,
      `Evidence Request: domain=${evidenceRequest.domain}; reasons=${evidenceRequest.reasonCodes.join(",")}`,
      `Evidence Plan: freshness=${evidenceRequest.plan.freshnessProfile}; mode=${evidenceRequest.plan.retrievalMode}; sourceTypes=${evidenceRequest.plan.sourceTypes.join(",")}`,
      `查询：${output.queries.join(" | ")}`,
      "",
      formatResearchEvidenceForPrompt(output.sources),
      "",
      "使用规则：",
      "- 涉及最新技术、模型、版本、生态判断时，优先依据 primary/high 来源。",
      "- 如果证据不足，直接写成待核验，不要编造确定结论。",
      "- 课程结构要区分稳定基础能力和近期活跃方向。",
      "- 如果本轮信息足够并调用 presentOutlinePreview，outline.researchCitations 必须引用上面的 source id、title、url、domain、provider；如果来源有 Extractor，也要写入 extractProvider。",
      "- 如果用户只给了宽泛主题，必须先继续追问应用场景、当前基础或目标产出。",
    ].join("\n"),
    evidenceRequest,
    retrieval: output,
    evidenceSnapshot,
    shouldDraftOutline: evidenceRequest.outlineReadiness === "ready",
    evidenceAvailable: true,
  };
}
