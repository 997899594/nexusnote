import { generateText, Output, type UIMessage } from "ai";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import type { CapabilityMode, IntentClassification } from "@/lib/ai/runtime/contracts";
import type { ResolvedRequestContext } from "@/lib/ai/runtime/resolve-request-context";
import { isUuidString } from "@/lib/chat/session-id";
import { intentClassificationSchema } from "./schemas";

const INTENT_CLASSIFIER_PROMPT_VERSION = "intent-classifier@v1";
const INTENT_CLASSIFIER_TIMEOUT_MS = 8_000;

const RESEARCH_CUES = [
  "最新",
  "官方",
  "官网",
  "查一下",
  "查下",
  "帮我查",
  "对比",
  "比较",
  "外部",
  "official",
  "latest",
  "compare",
  "versus",
];

const CAREER_CUES = [
  "职业",
  "方向",
  "差距",
  "下一步",
  "该学什么",
  "适合",
  "路线",
  "发展",
  "主树",
  "职业树",
  "学习路径",
];

const LEARN_CUES = [
  "这节",
  "这一节",
  "当前这一节",
  "没懂",
  "再解释",
  "举例",
  "例子",
  "怎么理解",
  "为什么这样学",
  "章节",
  "小节",
];

const NOTE_CUES = ["笔记", "整理", "提炼", "总结", "改写", "润色", "结构化", "归纳"];

const INTERVIEW_CUES = [
  "访谈",
  "先问我",
  "目标澄清",
  "课程规划",
  "帮我规划课程",
  "目标",
  "基础",
  "时间",
];

interface FallbackCandidate {
  capabilityMode: CapabilityMode;
  score: number;
  reasons: string[];
}

function mapCapabilityModeToIntent(capabilityMode: CapabilityMode): IntentClassification["intent"] {
  switch (capabilityMode) {
    case "learn_coach":
      return "learn_explanation";
    case "note_assistant":
      return "note_work";
    case "research_assistant":
      return "research_lookup";
    case "career_guide":
      return "career_guidance";
    case "course_interviewer":
      return "course_interview";
    default:
      return "general_assistance";
  }
}

function getRequiredScopesForCapabilityMode(
  capabilityMode: CapabilityMode,
): IntentClassification["requiredScopes"] {
  switch (capabilityMode) {
    case "learn_coach":
      return ["course"];
    case "note_assistant":
      return ["notes"];
    case "research_assistant":
      return ["web"];
    case "career_guide":
      return ["growth"];
    default:
      return ["session"];
  }
}

function buildClassificationFromCapabilityMode(params: {
  capabilityMode: CapabilityMode;
  confidence: number;
  reasons: string[];
}): IntentClassification {
  return {
    intent: mapCapabilityModeToIntent(params.capabilityMode),
    capabilityMode: params.capabilityMode,
    executionMode: params.capabilityMode === "course_interviewer" ? "redirect" : "tool_loop",
    requiredScopes: getRequiredScopesForCapabilityMode(params.capabilityMode),
    confidence: params.confidence,
    reasons: params.reasons,
  };
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function collectCueMatches(message: string, cues: string[]): string[] {
  return cues.filter((cue) => message.includes(cue));
}

function buildCueReason(label: string, matches: string[]): string {
  return `${label} cues matched: ${matches.join(", ")}`;
}

function getSurfaceFallbackMode(requestContext: ResolvedRequestContext): CapabilityMode {
  const { surface, hasLearningGuidance, hasGrowthSnapshot } = requestContext;

  switch (surface) {
    case "learn":
      return hasLearningGuidance ? "learn_coach" : "general_chat";
    case "notes":
      return "note_assistant";
    case "career":
      return hasGrowthSnapshot ? "career_guide" : "career_guide";
    case "interview":
      return "course_interviewer";
    default:
      return "general_chat";
  }
}

function getFallbackClassification(
  requestContext: ResolvedRequestContext,
  latestUserMessage: string,
  reason: string,
): IntentClassification {
  if (!latestUserMessage) {
    return buildClassificationFromCapabilityMode({
      capabilityMode: getSurfaceFallbackMode(requestContext),
      confidence: 0.25,
      reasons: [reason, `surface fallback: ${requestContext.surface}`],
    });
  }

  if (requestContext.surface === "learn" && requestContext.hasLearningGuidance) {
    return buildClassificationFromCapabilityMode({
      capabilityMode: "learn_coach",
      confidence: 0.45,
      reasons: [reason, "surface fallback: learn surface with live course context"],
    });
  }

  if (requestContext.surface === "notes" || requestContext.hasEditorContext) {
    return buildClassificationFromCapabilityMode({
      capabilityMode: "note_assistant",
      confidence: 0.45,
      reasons: [reason, "surface fallback: notes/editor context is present"],
    });
  }

  if (requestContext.surface === "career") {
    return buildClassificationFromCapabilityMode({
      capabilityMode: "career_guide",
      confidence: 0.45,
      reasons: [reason, "surface fallback: career surface preserves career_guide"],
    });
  }

  if (requestContext.surface === "interview") {
    return buildClassificationFromCapabilityMode({
      capabilityMode: "course_interviewer",
      confidence: 0.45,
      reasons: [reason, "surface fallback: interview surface preserves course_interviewer"],
    });
  }

  const normalizedMessage = normalizeText(latestUserMessage);
  const researchMatches = collectCueMatches(normalizedMessage, RESEARCH_CUES);
  const careerMatches = collectCueMatches(normalizedMessage, CAREER_CUES);
  const learnMatches = collectCueMatches(normalizedMessage, LEARN_CUES);
  const noteMatches = collectCueMatches(normalizedMessage, NOTE_CUES);
  const interviewMatches = collectCueMatches(normalizedMessage, INTERVIEW_CUES);

  const candidates: FallbackCandidate[] = [
    {
      capabilityMode: "general_chat",
      score: 0,
      reasons: [reason, "deterministic fallback found no stronger specialist contract"],
    },
  ];

  if (researchMatches.length > 0) {
    candidates.push({
      capabilityMode: "research_assistant",
      score: researchMatches.length * 3,
      reasons: [reason, buildCueReason("research", researchMatches)],
    });
  }

  if (careerMatches.length > 0) {
    candidates.push({
      capabilityMode: "career_guide",
      score: careerMatches.length * 3 + (requestContext.hasGrowthSnapshot ? 1 : 0),
      reasons: [
        reason,
        buildCueReason("career", careerMatches),
        requestContext.hasGrowthSnapshot
          ? "growth snapshot exists, so career guidance is actionable"
          : "career intent detected even though growth snapshot is still missing",
      ],
    });
  }

  if (learnMatches.length > 0 && requestContext.hasLearningGuidance) {
    candidates.push({
      capabilityMode: "learn_coach",
      score: learnMatches.length * 3 + 2,
      reasons: [
        reason,
        buildCueReason("learn", learnMatches),
        "live course context is available for learn_coach",
      ],
    });
  }

  if (noteMatches.length > 0) {
    candidates.push({
      capabilityMode: "note_assistant",
      score: noteMatches.length * 3 + (requestContext.hasEditorContext ? 2 : 0),
      reasons: [
        reason,
        buildCueReason("notes", noteMatches),
        requestContext.hasEditorContext
          ? "editor context is present for note operations"
          : "note-editing cues are stronger than a general chat fallback",
      ],
    });
  }

  if (interviewMatches.length > 0) {
    candidates.push({
      capabilityMode: "course_interviewer",
      score: interviewMatches.length * 4,
      reasons: [reason, buildCueReason("interview", interviewMatches)],
    });
  }

  const bestCandidate = [...candidates].sort((left, right) => right.score - left.score)[0];
  const confidence =
    bestCandidate.capabilityMode === "general_chat"
      ? 0.25
      : Math.min(0.55, 0.35 + bestCandidate.score * 0.03);

  return buildClassificationFromCapabilityMode({
    capabilityMode: bestCandidate.capabilityMode,
    confidence,
    reasons: bestCandidate.reasons,
  });
}

function getLatestUserMessage(messages: UIMessage[]): string {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");

  return latestUserMessage ? extractUIMessageText(latestUserMessage) : "";
}

function buildRecentConversationSummary(requestContext: ResolvedRequestContext): string {
  if (requestContext.recentMessages.length <= 1) {
    return "无";
  }

  return requestContext.recentMessages
    .slice(0, -1)
    .slice(-4)
    .map((message, index) => `${index + 1}. ${message}`)
    .join("\n");
}

function buildRequestContextSummary(requestContext: ResolvedRequestContext): string {
  const parts = [
    `surface: ${requestContext.surface}`,
    `hasLearningGuidance: ${requestContext.hasLearningGuidance ? "yes" : "no"}`,
    `hasGrowthSnapshot: ${requestContext.hasGrowthSnapshot ? "yes" : "no"}`,
    `hasEditorContext: ${requestContext.hasEditorContext ? "yes" : "no"}`,
    `courseId: ${requestContext.resourceContext.courseId ?? "none"}`,
    `chapterIndex: ${requestContext.resourceContext.chapterIndex ?? "none"}`,
    `sectionIndex: ${requestContext.resourceContext.sectionIndex ?? "none"}`,
    `documentId: ${requestContext.resourceContext.documentId ?? "none"}`,
    `metadataContext: ${requestContext.metadata?.context ?? "default"}`,
  ];

  return parts.join("\n");
}

function buildCapabilityContractSummary(requestContext: ResolvedRequestContext): string {
  return [
    "- general_chat: 通用解释、讨论、工程建议；没有明显课程/笔记/外部检索/职业规划契约时默认选这个",
    `- learn_coach: 解释当前课程、章节、小节、举例、我没懂、学习顺序。当前可用性：${
      requestContext.hasLearningGuidance ? "可用" : "仅在有课程上下文时可用"
    }`,
    "- note_assistant: 围绕用户自己的笔记整理、总结、提炼、改写、检索",
    "- research_assistant: 查最新、查官方、做对比、需要外部事实核验或最新信息",
    `- career_guide: 结合职业树/成长快照判断方向、差距、下一步学习。当前可用性：${
      requestContext.hasGrowthSnapshot ? "可用" : "快照缺失，若强行选择会被要求先澄清"
    }`,
    "- course_interviewer: 明确要做课程访谈、职业目标访谈、课程规划引导时选择；在 /api/chat 中通常会被重定向到专门访谈流",
  ].join("\n");
}

export async function classifyIntent(params: {
  userId: string;
  messages: UIMessage[];
  requestContext: ResolvedRequestContext;
}): Promise<IntentClassification> {
  const latestUserMessage = getLatestUserMessage(params.messages);
  const routeProfile = params.requestContext.userPolicy.routeProfile;
  const shouldRecordTelemetry = isUuidString(params.userId);
  const telemetry = createTelemetryContext({
    endpoint: "chat:route-classifier",
    workflow: "intent-classifier",
    promptVersion: INTENT_CLASSIFIER_PROMPT_VERSION,
    modelPolicy: "interactive-fast",
    routeProfile,
    userId: params.userId,
    metadata: {
      surface: params.requestContext.surface,
      sessionId: params.requestContext.sessionId,
      hasLearningGuidance: params.requestContext.hasLearningGuidance,
      hasGrowthSnapshot: params.requestContext.hasGrowthSnapshot,
      hasEditorContext: params.requestContext.hasEditorContext,
    },
  });
  const startedAt = Date.now();

  if (!latestUserMessage) {
    return getFallbackClassification(
      params.requestContext,
      latestUserMessage,
      "missing_latest_user_message",
    );
  }

  try {
    const result = await generateText({
      model: getPlainModelForPolicy("interactive-fast", { routeProfile }),
      output: Output.object({ schema: intentClassificationSchema }),
      system: renderPromptResource("routing/intent-classifier-system.md", {}),
      prompt: renderPromptResource("routing/intent-classifier-user.md", {
        latest_user_message: latestUserMessage,
        recent_conversation_summary: buildRecentConversationSummary(params.requestContext),
        request_context: buildRequestContextSummary(params.requestContext),
        capability_contracts: buildCapabilityContractSummary(params.requestContext),
      }),
      ...buildGenerationSettingsForPolicy(
        "interactive-fast",
        {
          temperature: 0.1,
          maxOutputTokens: 300,
        },
        { routeProfile },
      ),
      timeout: INTENT_CLASSIFIER_TIMEOUT_MS,
    });

    if (shouldRecordTelemetry) {
      await recordAIUsage({
        ...telemetry,
        usage: result.usage,
        durationMs: Date.now() - startedAt,
        success: true,
        intent: result.output.intent,
        capabilityMode: result.output.capabilityMode,
        metadata: {
          ...telemetry.metadata,
          executionMode: result.output.executionMode,
          requiredScopes: result.output.requiredScopes,
          confidence: result.output.confidence,
        },
      });
    }

    return result.output;
  } catch (error) {
    if (shouldRecordTelemetry) {
      await recordAIUsage({
        ...telemetry,
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: getErrorMessage(error),
      });
    }

    return getFallbackClassification(
      params.requestContext,
      latestUserMessage,
      `classifier_failed:${getErrorMessage(error)}`,
    );
  }
}
