import { resolveResearchEvidenceRequestWithPlanner } from "@/lib/ai/research/evidence-planner";
import {
  createResearchEvidenceDecisionInput,
  resolveResearchEvidenceRequest,
} from "@/lib/ai/research/evidence-request";
import { buildCourseSectionSystemPrompt } from "@/lib/ai/workflows/course-section-production";
import { buildSafeJobId } from "@/lib/queue/job-id";

const currentDate = new Date("2026-06-05");

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function checkInterviewFreshnessRouting(): Promise<void> {
  const fallbackRequest = resolveResearchEvidenceRequest({
    userMessages: ["我想学 claude design 和类似的竞品"],
    currentDate,
  });

  assert(fallbackRequest, "Claude competitor topic should require fallback research.");
  assert(
    fallbackRequest?.domain === "product_ecosystem",
    "Claude competitor topic should use product domain.",
  );
  assert(
    fallbackRequest?.reasonCodes.includes("product_competitor_domain"),
    "Claude competitor topic should include product competitor reason.",
  );
  assert(
    fallbackRequest?.freshnessWindowDays === 30,
    "Claude competitor topic should use 30-day freshness.",
  );
  assert(
    fallbackRequest?.plan.retrievalMode === "deep",
    "Claude competitor topic should use deep retrieval.",
  );
  assert(
    fallbackRequest?.plan.sourceTypes.includes("official_docs"),
    "Claude competitor topic should prefer official sources.",
  );

  const plannedRequest = await resolveResearchEvidenceRequestWithPlanner({
    userMessages: ["我想学 claude design 和类似的竞品"],
    currentDate,
    decisionResolver: async () => ({
      requiresResearch: true,
      domain: "product_ecosystem",
      reasonCodes: ["product_competitor_domain"],
      freshnessWindowDays: 30,
      queryFocus: "Claude 与类似 AI 产品的能力、体验和官方生态变化",
      freshnessProfile: "frontier",
      retrievalMode: "deep",
      sourceTypes: ["official_docs", "release_note", "technical_blog"],
      rationale: "AI 产品竞品和能力边界变化快，需要当前来源校准。",
    }),
  });
  assert(plannedRequest, "Planner should resolve Claude competitor research.");
  assert(plannedRequest?.decisionSource === "model", "Planner result should be model sourced.");
  assert(
    plannedRequest?.query.includes("研究重点：Claude 与类似 AI 产品"),
    "Planner query focus should be preserved.",
  );

  const stableTopicDecision = createResearchEvidenceDecisionInput({
    userMessages: ["我想学市场营销基础"],
    currentDate,
  });
  assert(stableTopicDecision, "Stable topic should still produce decision input.");
  assert(
    stableTopicDecision?.policyReasonCodes.length === 0,
    "Stable marketing fundamentals should not be hard-routed to research.",
  );
  const stableRequest = await resolveResearchEvidenceRequestWithPlanner({
    userMessages: ["我想学市场营销基础"],
    currentDate,
    decisionResolver: async () => {
      throw new Error("Stable fundamentals should not call the model planner.");
    },
  });
  assert(!stableRequest, "Stable marketing fundamentals should not require research.");
}

function checkQueueJobIds(): void {
  const id = buildSafeJobId([
    "career-tree",
    "refresh",
    "user:1",
    "course:2",
    "course-progress:abc:1:2:section-1-1",
  ]);

  assert(!id.includes(":"), "BullMQ job id should not contain colons.");
  assert(id.length <= 180, "BullMQ job id should be bounded.");
}

function checkSectionPromptEvidenceBoundary(): void {
  const prompt = buildCourseSectionSystemPrompt({
    sectionIndex: 0,
    guidance: {
      course: {
        id: "course-1",
        title: "AI 产品设计",
        description: "学习 AI 产品体验与竞品分析。",
        targetAudience: "产品设计师",
        difficulty: "intermediate",
        learningOutcome: "能分析 AI 助手产品体验并形成设计判断。",
        skillIds: ["product-design"],
        totalChapters: 1,
        researchCitations: [
          {
            id: "S1",
            title: "Claude documentation",
            url: "https://docs.anthropic.com/",
            domain: "docs.anthropic.com",
            sourceType: "official_docs",
            qualityTier: "primary",
            snippet: "Claude official documentation.",
          },
        ],
      },
      chapter: {
        index: 0,
        title: "竞品与体验",
        description: "理解 AI 助手产品的体验差异。",
        skillIds: ["competitive-analysis"],
        sections: [
          {
            index: 0,
            title: "Claude 设计与竞品",
            description: "分析 Claude 与类似产品的能力和交互差异。",
          },
        ],
      },
    },
    sectionEvidenceContext: {
      promptBlock: "## 当前小节外部资料\n[S1] Section source",
      evidenceRequest: null,
      retrieval: null,
      evidenceAvailable: true,
      error: null,
    },
  });

  assert(
    prompt.includes("外部来源边界"),
    "Section prompt should include outline evidence boundary.",
  );
  assert(
    prompt.includes("Claude documentation"),
    "Section prompt should include outline citations.",
  );
  assert(
    prompt.includes("当前小节检索证据"),
    "Section prompt should include section evidence block.",
  );
  assert(
    prompt.includes("Section source"),
    "Section prompt should include section-level evidence.",
  );
}

await checkInterviewFreshnessRouting();
checkQueueJobIds();
checkSectionPromptEvidenceBoundary();

console.log("research routing checks passed");
