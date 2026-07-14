import { smoothStream, streamText } from "ai";
import { and, courseSections, courses, db, eq } from "@/db";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getModelForPolicy } from "@/lib/ai/core/model-policy";
import { getUserAIModelSeries } from "@/lib/ai/core/model-series-preferences";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import {
  type CourseSectionEvidenceContext,
  resolveCourseSectionEvidenceContext,
} from "@/lib/ai/research/course-section-evidence";
import { invalidateChapterCache } from "@/lib/cache/course-context";
import { estimateReadingMinutes } from "@/lib/learning/course-duration";
import { refreshPublishedCoursePublication } from "@/lib/learning/course-publication-service";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { buildLearningGuidance, type LearningGuidance } from "@/lib/learning/guidance";
import { createLearnTrace } from "@/lib/learning/observability";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import { enqueueCourseSectionRagIndex } from "@/lib/queue/rag-queue";
import { getRedis } from "@/lib/redis";

const COURSE_SECTION_LOCK_TTL_MS = 10 * 60 * 1000;
const COURSE_SECTION_LIVE_STREAM_TTL_SECONDS = 30 * 60;
const COURSE_SECTION_MAX_OUTPUT_TOKENS = 1800;
const COURSE_SECTION_STREAM_CONTINUATION_ATTEMPTS = 1;
const RELEASE_SECTION_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export interface CourseSectionProductionTarget {
  userId: string;
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
  traceId?: string;
}

export interface CourseSectionProductionRunContext {
  attemptNumber?: number;
  maxAttempts?: number;
}

export interface ExistingCourseSectionDocument {
  id: string;
  content: string | null;
  outlineVersionId: string;
}

export interface ResolvedCourseSectionProductionInput {
  guidance: LearningGuidance;
  chapter: LearningGuidance["chapter"];
  section: LearningGuidance["chapter"]["sections"][number];
  outlineNodeId: string;
  existingSection: ExistingCourseSectionDocument;
}

export interface PersistGeneratedCourseSectionResult {
  sectionDocumentId: string | null;
  indexJobId: string | null;
}

export interface BackgroundCourseSectionProductionResult {
  status: "generated" | "exists" | "locked";
  sectionDocumentId: string | null;
  indexJobId: string | null;
}

export type CourseSectionLiveStreamStatus = "pending" | "generating" | "complete" | "error";

export interface CourseSectionLiveStreamSnapshot {
  status: CourseSectionLiveStreamStatus | null;
  chunks: string[];
  nextOffset: number;
  sectionDocumentId: string | null;
  error: string | null;
}

interface CourseSectionStreamingDraftResult {
  text: string;
  finishReason: string | null;
  totalUsage: Parameters<typeof recordAIUsage>[0]["usage"] | undefined;
  stepCount: number;
}

export function buildCourseSectionUserPrompt(sectionTitle: string) {
  return renderPromptResource("learn/course-section-user.md", {
    section_title: sectionTitle,
  });
}

function buildCourseSectionContinuationPrompt(params: {
  sectionTitle: string;
  partialText: string;
}) {
  return [
    `请继续完成「${params.sectionTitle}」这一节。`,
    "",
    "要求：",
    "- 不要重新开始，不要重复已经写过的标题或段落。",
    "- 直接从断点之后继续输出正文。",
    "- 保持原有 Markdown 风格，最后补齐 1-3 条小结。",
    "",
    "已经生成的内容如下：",
    params.partialText.slice(-1800),
  ].join("\n");
}

function formatSkillIds(skillIds?: string[]) {
  return Array.isArray(skillIds) && skillIds.length > 0 ? skillIds.join("、") : "未指定";
}

function formatResearchCitationContext(guidance: LearningGuidance): string {
  const citations = guidance.course.researchCitations.slice(0, 8);
  if (citations.length === 0) {
    return "无外部来源。";
  }

  return citations
    .map((citation, index) => {
      const details = [
        citation.domain,
        citation.sourceType,
        citation.qualityTier,
        citation.publishedAt ? `published=${citation.publishedAt}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const snippet = citation.snippet ? `\n  摘要：${citation.snippet}` : "";

      return `[S${index + 1}] ${citation.title}\n  URL：${citation.url}\n  来源：${details || "未标注"}${snippet}`;
    })
    .join("\n");
}

export function buildCourseSectionSystemPrompt(params: {
  guidance: LearningGuidance;
  sectionIndex: number;
  sectionEvidenceContext?: CourseSectionEvidenceContext | null;
}): string {
  const { guidance, sectionIndex } = params;
  const section = guidance.chapter.sections[sectionIndex];

  if (!section) {
    throw new Error(`Missing learning guidance section at index ${sectionIndex}`);
  }

  const difficultyLabel =
    guidance.course.difficulty === "beginner"
      ? "入门"
      : guidance.course.difficulty === "intermediate"
        ? "中级"
        : "高级";

  const siblingContext = guidance.chapter.sections
    .map(
      (item, index) =>
        `  ${index === sectionIndex ? "→" : " "} ${guidance.chapter.index + 1}.${index + 1} ${item.title}`,
    )
    .join("\n");

  return renderPromptResource("learn/course-section-system.md", {
    course_title: guidance.course.title,
    course_description: guidance.course.description,
    target_audience: guidance.course.targetAudience,
    difficulty_label: difficultyLabel,
    total_chapters: guidance.course.totalChapters,
    learning_outcome: guidance.course.learningOutcome ?? "未提供",
    course_skill_ids: formatSkillIds(guidance.course.skillIds),
    research_citations: formatResearchCitationContext(guidance),
    section_research_evidence:
      params.sectionEvidenceContext?.promptBlock ??
      "本小节未触发额外实时检索；不要主动写未经核验的最新事实。",
    chapter_number: guidance.chapter.index + 1,
    chapter_title: guidance.chapter.title,
    chapter_description: guidance.chapter.description,
    chapter_skill_ids: formatSkillIds(guidance.chapter.skillIds),
    sibling_context: siblingContext,
    section_number: `${guidance.chapter.index + 1}.${sectionIndex + 1}`,
    section_title: section.title,
    section_description: section.description,
  });
}

async function loadExistingSectionDocument(
  outlineVersionId: string,
  outlineNodeId: string,
): Promise<ExistingCourseSectionDocument | null> {
  const [existingSection] = await db
    .select({
      id: courseSections.id,
      content: courseSections.contentMarkdown,
      outlineVersionId: courseSections.outlineVersionId,
    })
    .from(courseSections)
    .where(
      and(
        eq(courseSections.outlineVersionId, outlineVersionId),
        eq(courseSections.outlineNodeKey, outlineNodeId),
      ),
    )
    .limit(1);

  return existingSection ?? null;
}

export async function resolveCourseSectionProductionInput(
  params: CourseSectionProductionTarget,
): Promise<ResolvedCourseSectionProductionInput> {
  const course = await getOwnedCourseWithOutline(params.courseId, params.userId);
  if (!course) {
    throw new Error("COURSE_NOT_FOUND");
  }

  const guidance = buildLearningGuidance({
    course,
    chapterIndex: params.chapterIndex,
  });
  if (!guidance) {
    throw new Error("CHAPTER_NOT_FOUND");
  }

  const section = guidance.chapter.sections[params.sectionIndex];
  if (!section) {
    throw new Error("SECTION_NOT_FOUND");
  }

  const outlineNodeId = buildSectionOutlineNodeKey(params.chapterIndex, params.sectionIndex);
  const existingSection = await loadExistingSectionDocument(course.outlineVersionId, outlineNodeId);
  if (!existingSection) {
    throw new Error("COURSE_SECTION_DOCUMENT_NOT_FOUND");
  }

  return {
    guidance,
    chapter: guidance.chapter,
    section,
    outlineNodeId,
    existingSection,
  };
}

export async function persistGeneratedCourseSection(params: {
  userId: string;
  courseId: string;
  chapterIndex: number;
  outlineNodeId: string;
  sectionTitle: string;
  text: string;
  existingSection: ExistingCourseSectionDocument;
  trace?: ReturnType<typeof createLearnTrace>;
}): Promise<PersistGeneratedCourseSectionResult> {
  const text = params.text.trim();
  if (!text) {
    throw new Error("Generated section content is empty");
  }

  const sectionDocumentId = await db.transaction(async (tx) => {
    const persistedSectionDocumentId = params.existingSection.id;
    await tx
      .update(courseSections)
      .set({
        contentMarkdown: text,
        plainText: text,
        updatedAt: new Date(),
      })
      .where(eq(courseSections.id, params.existingSection.id));

    const revisionDocuments = await tx
      .select({ plainText: courseSections.plainText })
      .from(courseSections)
      .where(eq(courseSections.outlineVersionId, params.existingSection.outlineVersionId));
    const estimatedMinutes = estimateReadingMinutes(
      revisionDocuments.map((document) => document.plainText ?? ""),
    );
    await tx
      .update(courses)
      .set({ estimatedMinutes, updatedAt: new Date() })
      .where(eq(courses.id, params.courseId));

    if (!persistedSectionDocumentId) {
      return null;
    }

    await refreshPublishedCoursePublication({
      courseId: params.courseId,
      userId: params.userId,
      executor: tx,
    });

    return persistedSectionDocumentId;
  });

  let indexJobId: string | null = null;

  if (sectionDocumentId) {
    const indexJob = await enqueueCourseSectionRagIndex({
      documentId: sectionDocumentId,
      plainText: text,
      userId: params.userId,
      courseId: params.courseId,
    });
    indexJobId = indexJob?.id ?? null;
    params.trace?.step("enqueue-index", {
      outlineNodeId: params.outlineNodeId,
      jobId: indexJobId,
    });

    await invalidateChapterCache(params.courseId, params.chapterIndex);
  }

  return {
    sectionDocumentId: sectionDocumentId || null,
    indexJobId,
  };
}

function buildSectionLockKey(courseId: string, outlineNodeId: string) {
  return `course-production:section:${courseId}:${outlineNodeId}`;
}

function buildSectionLiveStreamKeys(courseId: string, outlineNodeId: string) {
  const base = `course-production:live:${courseId}:${outlineNodeId}`;
  return {
    state: `${base}:state`,
    chunks: `${base}:chunks`,
  };
}

async function expireSectionLiveStream(keys: ReturnType<typeof buildSectionLiveStreamKeys>) {
  const redis = getRedis();
  await redis.expire(keys.state, COURSE_SECTION_LIVE_STREAM_TTL_SECONDS);
  await redis.expire(keys.chunks, COURSE_SECTION_LIVE_STREAM_TTL_SECONDS);
}

export async function prepareCourseSectionLiveStream(params: {
  courseId: string;
  outlineNodeId: string;
}) {
  const redis = getRedis();
  const keys = buildSectionLiveStreamKeys(params.courseId, params.outlineNodeId);
  const status = await redis.hget(keys.state, "status");

  if (status === "generating" || status === "complete") {
    return;
  }

  await redis.del(keys.chunks);
  await redis.hset(keys.state, {
    status: "pending",
    updatedAt: new Date().toISOString(),
    sectionDocumentId: "",
    error: "",
  });
  await expireSectionLiveStream(keys);
}

async function startCourseSectionLiveStream(params: { courseId: string; outlineNodeId: string }) {
  const redis = getRedis();
  const keys = buildSectionLiveStreamKeys(params.courseId, params.outlineNodeId);

  await redis.del(keys.chunks);
  await redis.hset(keys.state, {
    status: "generating",
    updatedAt: new Date().toISOString(),
    sectionDocumentId: "",
    error: "",
  });
  await expireSectionLiveStream(keys);
}

async function appendCourseSectionLiveStreamChunk(params: {
  courseId: string;
  outlineNodeId: string;
  chunk: string;
}) {
  if (!params.chunk) {
    return;
  }

  const redis = getRedis();
  const keys = buildSectionLiveStreamKeys(params.courseId, params.outlineNodeId);
  await redis.rpush(keys.chunks, params.chunk);
  await redis.hset(keys.state, "updatedAt", new Date().toISOString());
  await expireSectionLiveStream(keys);
}

async function completeCourseSectionLiveStream(params: {
  courseId: string;
  outlineNodeId: string;
  sectionDocumentId: string | null;
}) {
  const redis = getRedis();
  const keys = buildSectionLiveStreamKeys(params.courseId, params.outlineNodeId);
  await redis.hset(keys.state, {
    status: "complete",
    updatedAt: new Date().toISOString(),
    sectionDocumentId: params.sectionDocumentId ?? "",
    error: "",
  });
  await expireSectionLiveStream(keys);
}

async function failCourseSectionLiveStream(params: {
  courseId: string;
  outlineNodeId: string;
  error: string;
}) {
  const redis = getRedis();
  const keys = buildSectionLiveStreamKeys(params.courseId, params.outlineNodeId);
  await redis.hset(keys.state, {
    status: "error",
    updatedAt: new Date().toISOString(),
    error: params.error,
  });
  await expireSectionLiveStream(keys);
}

async function markCourseSectionLiveStreamPending(params: {
  courseId: string;
  outlineNodeId: string;
}) {
  const redis = getRedis();
  const keys = buildSectionLiveStreamKeys(params.courseId, params.outlineNodeId);
  await redis.hset(keys.state, {
    status: "pending",
    updatedAt: new Date().toISOString(),
    error: "",
  });
  await expireSectionLiveStream(keys);
}

export async function readCourseSectionLiveStream(params: {
  courseId: string;
  outlineNodeId: string;
  offset: number;
}): Promise<CourseSectionLiveStreamSnapshot> {
  const redis = getRedis();
  const keys = buildSectionLiveStreamKeys(params.courseId, params.outlineNodeId);
  const [state, chunks] = await Promise.all([
    redis.hgetall(keys.state),
    redis.lrange(keys.chunks, params.offset, -1),
  ]);
  const status =
    state.status === "pending" ||
    state.status === "generating" ||
    state.status === "complete" ||
    state.status === "error"
      ? state.status
      : null;

  return {
    status,
    chunks,
    nextOffset: params.offset + chunks.length,
    sectionDocumentId: state.sectionDocumentId || null,
    error: state.error || null,
  };
}

async function acquireSectionLock(courseId: string, outlineNodeId: string) {
  const token = crypto.randomUUID();
  const key = buildSectionLockKey(courseId, outlineNodeId);
  const acquired = await getRedis().set(key, token, "PX", COURSE_SECTION_LOCK_TTL_MS, "NX");

  if (acquired !== "OK") {
    return null;
  }

  return { key, token };
}

async function releaseSectionLock(lock: { key: string; token: string } | null) {
  if (!lock) {
    return;
  }

  await getRedis().eval(RELEASE_SECTION_LOCK_SCRIPT, 1, lock.key, lock.token);
}

function hasRemainingQueueAttempts(context: CourseSectionProductionRunContext): boolean {
  if (!context.attemptNumber || !context.maxAttempts) {
    return false;
  }

  return context.attemptNumber < context.maxAttempts;
}

function isTransientUpstreamGenerationError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("bad gateway") ||
    message.includes("socket connection was closed") ||
    message.includes("operation timed out") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  );
}

function shouldKeepLiveStreamPendingForRetry(params: {
  error: unknown;
  generatedText: string;
  context: CourseSectionProductionRunContext;
}): boolean {
  return (
    !params.generatedText.trim() &&
    hasRemainingQueueAttempts(params.context) &&
    isTransientUpstreamGenerationError(params.error)
  );
}

function getCourseSectionUserFacingError(error: unknown): string {
  if (isTransientUpstreamGenerationError(error)) {
    return "模型服务临时波动，请稍后重试。";
  }

  const message = getErrorMessage(error);
  if (message === "Generated section content is empty") {
    return "模型这次没有返回章节内容，请重试。";
  }

  return message;
}

function mergeUsage(
  left: CourseSectionStreamingDraftResult["totalUsage"],
  right: CourseSectionStreamingDraftResult["totalUsage"],
): CourseSectionStreamingDraftResult["totalUsage"] {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }

  return {
    inputTokens: (left.inputTokens ?? 0) + (right.inputTokens ?? 0),
    outputTokens: (left.outputTokens ?? 0) + (right.outputTokens ?? 0),
    totalTokens: (left.totalTokens ?? 0) + (right.totalTokens ?? 0),
  };
}

async function streamCourseSectionDraft(params: {
  input: ResolvedCourseSectionProductionInput;
  target: CourseSectionProductionTarget;
  modelSeries: Awaited<ReturnType<typeof getUserAIModelSeries>>;
  sectionEvidenceContext: CourseSectionEvidenceContext | null;
  trace: ReturnType<typeof createLearnTrace>;
  onTextChange: (text: string) => void;
}): Promise<CourseSectionStreamingDraftResult> {
  let generatedText = "";
  let totalUsage: CourseSectionStreamingDraftResult["totalUsage"];
  let finishReason: string | null = null;
  let stepCount = 0;
  let continuationAttempts = 0;

  const runStream = async (prompt: string) => {
    const result = streamText({
      model: getModelForPolicy("section-draft", { modelSeries: params.modelSeries }),
      system: buildCourseSectionSystemPrompt({
        guidance: params.input.guidance,
        sectionIndex: params.target.sectionIndex,
        sectionEvidenceContext: params.sectionEvidenceContext,
      }),
      prompt,
      ...buildGenerationSettingsForPolicy(
        "section-draft",
        {
          maxOutputTokens: COURSE_SECTION_MAX_OUTPUT_TOKENS,
          temperature: 0.5,
        },
        {
          modelSeries: params.modelSeries,
        },
      ),
      timeout: 180_000,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-Hans", { granularity: "word" }),
      }),
      onFinish: ({ totalUsage: usage, finishReason: reason, steps }) => {
        totalUsage = mergeUsage(totalUsage, usage);
        finishReason = reason;
        stepCount += steps.length;
      },
    });

    for await (const chunk of result.textStream) {
      generatedText += chunk;
      params.onTextChange(generatedText);
      await appendCourseSectionLiveStreamChunk({
        courseId: params.target.courseId,
        outlineNodeId: params.input.outlineNodeId,
        chunk,
      });
    }
  };

  try {
    await runStream(buildCourseSectionUserPrompt(params.input.section.title));
  } catch (error) {
    const shouldContinue =
      generatedText.trim() &&
      continuationAttempts < COURSE_SECTION_STREAM_CONTINUATION_ATTEMPTS &&
      isTransientUpstreamGenerationError(error);

    if (!shouldContinue) {
      throw error;
    }

    continuationAttempts += 1;
    params.trace.step("stream-continuation-retry", {
      outlineNodeId: params.input.outlineNodeId,
      generatedChars: generatedText.length,
      continuationAttempts,
    });

    await runStream(
      buildCourseSectionContinuationPrompt({
        sectionTitle: params.input.section.title,
        partialText: generatedText,
      }),
    );
  }

  return {
    text: generatedText,
    finishReason,
    totalUsage,
    stepCount,
  };
}

export async function materializeCourseSectionInBackground(
  target: CourseSectionProductionTarget,
  context: CourseSectionProductionRunContext = {},
): Promise<BackgroundCourseSectionProductionResult> {
  const startedAt = Date.now();
  const trace = createLearnTrace("course-section-production", {
    userId: target.userId,
    courseId: target.courseId,
    chapterIndex: target.chapterIndex,
    sectionIndex: target.sectionIndex,
  });
  const modelSeries = await getUserAIModelSeries(target.userId);
  const telemetry = createTelemetryContext({
    endpoint: "course-production-worker",
    userId: target.userId,
    workflow: "materialize-course-section",
    promptVersion: "course-section@v3",
    modelPolicy: "section-draft",
    modelSeries,
    metadata: {
      courseId: target.courseId,
      chapterIndex: target.chapterIndex,
      sectionIndex: target.sectionIndex,
      modelSeries,
    },
  });

  const input = await resolveCourseSectionProductionInput({
    ...target,
  });
  const lock = await acquireSectionLock(target.courseId, input.outlineNodeId);
  if (!lock) {
    trace.finish({ status: "locked", outlineNodeId: input.outlineNodeId });
    return {
      status: "locked",
      sectionDocumentId: input.existingSection?.id ?? null,
      indexJobId: null,
    };
  }

  let generatedText = "";

  try {
    if (input.existingSection?.content) {
      const publicationRefresh = await refreshPublishedCoursePublication({
        courseId: target.courseId,
        userId: target.userId,
      });

      await startCourseSectionLiveStream({
        courseId: target.courseId,
        outlineNodeId: input.outlineNodeId,
      });
      await appendCourseSectionLiveStreamChunk({
        courseId: target.courseId,
        outlineNodeId: input.outlineNodeId,
        chunk: input.existingSection.content,
      });
      await completeCourseSectionLiveStream({
        courseId: target.courseId,
        outlineNodeId: input.outlineNodeId,
        sectionDocumentId: input.existingSection.id,
      });
      trace.finish({
        status: "exists",
        outlineNodeId: input.outlineNodeId,
        sectionDocumentId: input.existingSection.id,
        refreshedPublicationId: publicationRefresh?.publicationId ?? null,
        refreshedSnapshotId: publicationRefresh?.snapshotId ?? null,
      });
      return {
        status: "exists",
        sectionDocumentId: input.existingSection.id,
        indexJobId: null,
      };
    }

    await startCourseSectionLiveStream({
      courseId: target.courseId,
      outlineNodeId: input.outlineNodeId,
    });

    const sectionEvidenceContext = await resolveCourseSectionEvidenceContext({
      guidance: input.guidance,
      sectionIndex: target.sectionIndex,
      userId: target.userId,
      modelSeries,
    });
    trace.step("section-evidence-resolved", {
      outlineNodeId: input.outlineNodeId,
      evidenceRequired: Boolean(sectionEvidenceContext.evidenceRequest),
      evidenceAvailable: sectionEvidenceContext.evidenceAvailable,
      evidenceSourceCount: sectionEvidenceContext.retrieval?.sources.length ?? 0,
      evidenceDomain: sectionEvidenceContext.evidenceRequest?.domain ?? null,
      evidenceDecisionSource: sectionEvidenceContext.evidenceRequest?.decisionSource ?? null,
      evidenceError: sectionEvidenceContext.error,
    });

    const draft = await streamCourseSectionDraft({
      input,
      target,
      modelSeries,
      sectionEvidenceContext,
      trace,
      onTextChange: (text) => {
        generatedText = text;
      },
    });

    generatedText = draft.text;

    if (!generatedText.trim()) {
      throw new Error("Generated section content is empty");
    }

    const persisted = await persistGeneratedCourseSection({
      userId: target.userId,
      courseId: target.courseId,
      chapterIndex: target.chapterIndex,
      outlineNodeId: input.outlineNodeId,
      sectionTitle: input.section.title,
      text: generatedText,
      existingSection: input.existingSection,
      trace,
    });
    await completeCourseSectionLiveStream({
      courseId: target.courseId,
      outlineNodeId: input.outlineNodeId,
      sectionDocumentId: persisted.sectionDocumentId,
    });

    trace.finish({
      status: "generated",
      outlineNodeId: input.outlineNodeId,
      generatedChars: generatedText.length,
      finishReason: draft.finishReason,
      sectionDocumentId: persisted.sectionDocumentId,
      indexJobId: persisted.indexJobId,
    });

    void recordAIUsage({
      ...telemetry,
      usage: draft.totalUsage,
      durationMs: Date.now() - startedAt,
      success: true,
      metadata: {
        ...telemetry.metadata,
        finishReason: draft.finishReason,
        stepCount: draft.stepCount,
        outlineNodeId: input.outlineNodeId,
        sectionDocumentId: persisted.sectionDocumentId,
        indexJobId: persisted.indexJobId,
        evidenceRequired: Boolean(sectionEvidenceContext.evidenceRequest),
        evidenceAvailable: sectionEvidenceContext.evidenceAvailable,
        evidenceSourceCount: sectionEvidenceContext.retrieval?.sources.length ?? 0,
      },
    });

    return {
      status: "generated",
      ...persisted,
    };
  } catch (error) {
    if (shouldKeepLiveStreamPendingForRetry({ error, generatedText, context })) {
      await markCourseSectionLiveStreamPending({
        courseId: target.courseId,
        outlineNodeId: input.outlineNodeId,
      });
      trace.step("retryable-upstream-error-pending", {
        outlineNodeId: input.outlineNodeId,
        attemptNumber: context.attemptNumber,
        maxAttempts: context.maxAttempts,
      });
    } else {
      await failCourseSectionLiveStream({
        courseId: target.courseId,
        outlineNodeId: input.outlineNodeId,
        error: getCourseSectionUserFacingError(error),
      });
    }
    trace.fail(error, {
      outlineNodeId: input.outlineNodeId,
    });
    void recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(error),
    });
    throw error;
  } finally {
    await releaseSectionLock(lock);
  }
}
