import type { AIModelSeries } from "@/lib/ai/core/model-series";
import { getErrorMessage } from "@/lib/ai/core/telemetry";
import { resolveResearchEvidenceRequestWithPlanner } from "@/lib/ai/research/evidence-planner";
import type { ResearchEvidenceRequest } from "@/lib/ai/research/evidence-request";
import {
  collectResearchEvidence,
  formatResearchEvidenceForPrompt,
  type ResearchRetrievalOutput,
} from "@/lib/ai/research/web-research";
import type { LearningGuidance } from "@/lib/learning/guidance";

export interface CourseSectionEvidenceContext {
  promptBlock: string;
  evidenceRequest: ResearchEvidenceRequest | null;
  retrieval: ResearchRetrievalOutput | null;
  evidenceAvailable: boolean;
  error: string | null;
}

function getRetrievalBudget(request: ResearchEvidenceRequest): {
  limit: number;
  maxExtractedSources: number;
} {
  if (request.plan.retrievalMode === "deep") {
    return {
      limit: 7,
      maxExtractedSources: 8,
    };
  }

  return {
    limit: 4,
    maxExtractedSources: 5,
  };
}

function getSection(guidance: LearningGuidance, sectionIndex: number) {
  return guidance.chapter.sections[sectionIndex] ?? null;
}

function buildSectionEvidenceProbe(params: {
  guidance: LearningGuidance;
  sectionIndex: number;
}): string {
  const section = getSection(params.guidance, params.sectionIndex);
  if (!section) {
    return "";
  }

  return [
    `课程：${params.guidance.course.title}`,
    params.guidance.course.description ? `课程简介：${params.guidance.course.description}` : null,
    params.guidance.course.learningOutcome
      ? `课程学习成果：${params.guidance.course.learningOutcome}`
      : null,
    `章节：${params.guidance.chapter.title}`,
    params.guidance.chapter.description ? `章节描述：${params.guidance.chapter.description}` : null,
    `小节：${section.title}`,
    section.description ? `小节描述：${section.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function resolveSectionEvidenceRequest(params: {
  guidance: LearningGuidance;
  sectionIndex: number;
  userId: string;
  modelSeries?: AIModelSeries;
}): Promise<ResearchEvidenceRequest | null> {
  const sectionProbe = buildSectionEvidenceProbe({
    guidance: params.guidance,
    sectionIndex: params.sectionIndex,
  });
  if (!sectionProbe) {
    return null;
  }

  return resolveResearchEvidenceRequestWithPlanner({
    userMessages: [sectionProbe],
    userId: params.userId,
    modelSeries: params.modelSeries,
  });
}

function buildUnavailablePromptBlock(params: {
  request: ResearchEvidenceRequest;
  output: ResearchRetrievalOutput | null;
  error: string | null;
}) {
  const reason =
    params.output?.unavailableReason ?? (params.error ? "provider_error" : ("no_results" as const));

  return [
    "## 当前小节外部资料状态",
    `本小节被判定需要额外资料校准，但检索未完成：${reason}。`,
    params.error ? `错误：${params.error}` : null,
    "写正文时不要编造最新产品能力、版本、价格、竞品结论或近期案例；证据不足处直接标为需要进一步核验。",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function resolveCourseSectionEvidenceContext(params: {
  guidance: LearningGuidance;
  sectionIndex: number;
  userId: string;
  modelSeries?: AIModelSeries;
}): Promise<CourseSectionEvidenceContext> {
  const evidenceRequest = await resolveSectionEvidenceRequest(params);
  if (!evidenceRequest) {
    return {
      promptBlock: "本小节未触发额外实时检索；不要主动写未经核验的最新事实。",
      evidenceRequest: null,
      retrieval: null,
      evidenceAvailable: false,
      error: null,
    };
  }

  try {
    const budget = getRetrievalBudget(evidenceRequest);
    const output = await collectResearchEvidence({
      query: evidenceRequest.query,
      queries: evidenceRequest.queries,
      limit: budget.limit,
      maxExtractedSources: budget.maxExtractedSources,
      freshnessWindowDays: evidenceRequest.freshnessWindowDays,
      userId: params.userId,
    });

    if (!output.success) {
      return {
        promptBlock: buildUnavailablePromptBlock({
          request: evidenceRequest,
          output,
          error: output.errors[0] ?? null,
        }),
        evidenceRequest,
        retrieval: output,
        evidenceAvailable: false,
        error: output.errors[0] ?? null,
      };
    }

    return {
      promptBlock: [
        "## 当前小节外部资料",
        `Evidence Request: domain=${evidenceRequest.domain}; reasons=${evidenceRequest.reasonCodes.join(",")}; source=${evidenceRequest.decisionSource}`,
        `Evidence Plan: freshness=${evidenceRequest.plan.freshnessProfile}; mode=${evidenceRequest.plan.retrievalMode}; sourceTypes=${evidenceRequest.plan.sourceTypes.join(",")}`,
        `查询：${output.queries.join(" | ")}`,
        "",
        formatResearchEvidenceForPrompt(output.sources),
        "",
        "使用规则：正文涉及最新事实时优先依据这些来源；只引用被用于正文事实的 source id。",
      ].join("\n"),
      evidenceRequest,
      retrieval: output,
      evidenceAvailable: true,
      error: null,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    return {
      promptBlock: buildUnavailablePromptBlock({
        request: evidenceRequest,
        output: null,
        error: errorMessage,
      }),
      evidenceRequest,
      retrieval: null,
      evidenceAvailable: false,
      error: errorMessage,
    };
  }
}
