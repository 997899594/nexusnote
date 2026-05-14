import { smoothStream, streamText } from "ai";
import { and, courseSections, db, eq } from "@/db";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getModelForPolicy } from "@/lib/ai/core/model-policy";
import { getUserAIRouteProfile } from "@/lib/ai/core/route-profile-preferences";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { APIError } from "@/lib/api";
import { invalidateChapterCache } from "@/lib/cache/course-context";
import { revalidateLearnPage } from "@/lib/cache/tags";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { buildLearningGuidance, type LearningGuidance } from "@/lib/learning/guidance";
import { createLearnTrace } from "@/lib/learning/observability";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import { enqueueCourseSectionRagIndex } from "@/lib/queue/rag-queue";
import { getRedis } from "@/lib/redis";

const COURSE_SECTION_LOCK_TTL_MS = 10 * 60 * 1000;
const COURSE_SECTION_LIVE_STREAM_TTL_SECONDS = 30 * 60;

export interface CourseSectionProductionTarget {
  userId: string;
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
  traceId?: string;
}

export interface ExistingCourseSectionDocument {
  id: string;
  content: string | null;
}

export interface ResolvedCourseSectionProductionInput {
  guidance: LearningGuidance;
  chapter: LearningGuidance["chapter"];
  section: LearningGuidance["chapter"]["sections"][number];
  outlineNodeId: string;
  existingSection: ExistingCourseSectionDocument | null;
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

export function buildCourseSectionUserPrompt(sectionTitle: string) {
  return renderPromptResource("learn/course-section-user.md", {
    section_title: sectionTitle,
  });
}

function formatSkillIds(skillIds?: string[]) {
  return Array.isArray(skillIds) && skillIds.length > 0 ? skillIds.join("、") : "未指定";
}

export function buildCourseSectionSystemPrompt(params: {
  guidance: LearningGuidance;
  sectionIndex: number;
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
  courseId: string,
  outlineNodeId: string,
): Promise<ExistingCourseSectionDocument | null> {
  const [existingSection] = await db
    .select({ id: courseSections.id, content: courseSections.contentMarkdown })
    .from(courseSections)
    .where(
      and(eq(courseSections.courseId, courseId), eq(courseSections.outlineNodeKey, outlineNodeId)),
    )
    .limit(1);

  return existingSection ?? null;
}

export async function resolveCourseSectionProductionInput(
  params: CourseSectionProductionTarget,
): Promise<ResolvedCourseSectionProductionInput> {
  const course = await getOwnedCourseWithOutline(params.courseId, params.userId);
  if (!course) {
    throw new APIError("课程不存在", 404, "NOT_FOUND");
  }

  const guidance = buildLearningGuidance({
    course,
    chapterIndex: params.chapterIndex,
  });
  if (!guidance) {
    throw new APIError("章节不存在", 404, "CHAPTER_NOT_FOUND");
  }

  const section = guidance.chapter.sections[params.sectionIndex];
  if (!section) {
    throw new APIError("小节不存在", 404, "SECTION_NOT_FOUND");
  }

  const outlineNodeId = buildSectionOutlineNodeKey(params.chapterIndex, params.sectionIndex);
  const existingSection = await loadExistingSectionDocument(params.courseId, outlineNodeId);

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
  existingSection: ExistingCourseSectionDocument | null;
  trace?: ReturnType<typeof createLearnTrace>;
}): Promise<PersistGeneratedCourseSectionResult> {
  const text = params.text.trim();
  if (!text) {
    throw new Error("Generated section content is empty");
  }

  let sectionDocumentId = params.existingSection?.id ?? "";
  let indexJobId: string | null = null;

  if (params.existingSection) {
    await db
      .update(courseSections)
      .set({
        contentMarkdown: text,
        plainText: text,
        updatedAt: new Date(),
      })
      .where(eq(courseSections.id, params.existingSection.id));
  } else {
    const [inserted] = await db
      .insert(courseSections)
      .values({
        title: params.sectionTitle,
        courseId: params.courseId,
        outlineNodeKey: params.outlineNodeId,
        contentMarkdown: text,
        plainText: text,
      })
      .returning({ id: courseSections.id });
    sectionDocumentId = inserted?.id ?? "";
  }

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
    revalidateLearnPage(params.userId, params.courseId);
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

  const currentToken = await getRedis().get(lock.key);
  if (currentToken === lock.token) {
    await getRedis().del(lock.key);
  }
}

export async function materializeCourseSectionInBackground(
  target: CourseSectionProductionTarget,
): Promise<BackgroundCourseSectionProductionResult> {
  const startedAt = Date.now();
  const trace = createLearnTrace("course-section-production", {
    userId: target.userId,
    courseId: target.courseId,
    chapterIndex: target.chapterIndex,
    sectionIndex: target.sectionIndex,
  });
  const routeProfile = await getUserAIRouteProfile(target.userId);
  const telemetry = createTelemetryContext({
    endpoint: "course-production-worker",
    userId: target.userId,
    workflow: "materialize-course-section",
    promptVersion: "course-section@v3",
    modelPolicy: "section-draft",
    routeProfile,
    metadata: {
      courseId: target.courseId,
      chapterIndex: target.chapterIndex,
      sectionIndex: target.sectionIndex,
      routeProfile,
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

  try {
    if (input.existingSection?.content) {
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

    let generatedText = "";
    let finishReason: string | null = null;
    let totalUsage: Parameters<typeof recordAIUsage>[0]["usage"] | undefined;
    let stepCount = 0;

    const result = streamText({
      model: getModelForPolicy("section-draft", { routeProfile }),
      system: buildCourseSectionSystemPrompt({
        guidance: input.guidance,
        sectionIndex: target.sectionIndex,
      }),
      prompt: buildCourseSectionUserPrompt(input.section.title),
      ...buildGenerationSettingsForPolicy(
        "section-draft",
        {
          temperature: 0.5,
        },
        {
          routeProfile,
        },
      ),
      timeout: 180_000,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-Hans", { granularity: "word" }),
      }),
      onFinish: ({ totalUsage: usage, finishReason: reason, steps }) => {
        totalUsage = usage;
        finishReason = reason;
        stepCount = steps.length;
      },
    });

    for await (const chunk of result.textStream) {
      generatedText += chunk;
      await appendCourseSectionLiveStreamChunk({
        courseId: target.courseId,
        outlineNodeId: input.outlineNodeId,
        chunk,
      });
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
      finishReason,
      sectionDocumentId: persisted.sectionDocumentId,
      indexJobId: persisted.indexJobId,
    });

    void recordAIUsage({
      ...telemetry,
      usage: totalUsage,
      durationMs: Date.now() - startedAt,
      success: true,
      metadata: {
        ...telemetry.metadata,
        finishReason,
        stepCount,
        outlineNodeId: input.outlineNodeId,
        sectionDocumentId: persisted.sectionDocumentId,
        indexJobId: persisted.indexJobId,
      },
    });

    return {
      status: "generated",
      ...persisted,
    };
  } catch (error) {
    await failCourseSectionLiveStream({
      courseId: target.courseId,
      outlineNodeId: input.outlineNodeId,
      error: getErrorMessage(error),
    });
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
