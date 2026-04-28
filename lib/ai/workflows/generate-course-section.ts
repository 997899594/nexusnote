import { smoothStream, streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { courseSections, db } from "@/db";
import { getModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import { APIError } from "@/lib/api";
import { invalidateChapterCache } from "@/lib/cache/course-context";
import { revalidateLearnPage } from "@/lib/cache/tags";
import { getUserGrowthContext } from "@/lib/growth/generation-context";
import { formatLearningAlignmentBrief } from "@/lib/learning/alignment";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { buildLearningGuidance, type LearningGuidance } from "@/lib/learning/guidance";
import { createLearnTrace } from "@/lib/learning/observability";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import { enqueueCourseSectionRagIndex } from "@/lib/queue/rag-queue";

interface GenerateCourseSectionWorkflowOptions {
  userId: string;
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
  traceId?: string;
}

function buildCourseSectionUserPrompt(sectionTitle: string) {
  return renderPromptResource("learn/course-section-user.md", {
    section_title: sectionTitle,
  });
}

function buildSectionPrompt(params: { guidance: LearningGuidance; sectionIndex: number }): string {
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

  const formatSkillIds = (skillIds?: string[]) =>
    Array.isArray(skillIds) && skillIds.length > 0 ? skillIds.join("、") : "未指定";

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
    alignment_brief: formatLearningAlignmentBrief(section.alignment, "prompt"),
  });
}

export async function runGenerateCourseSectionWorkflow({
  userId,
  courseId,
  chapterIndex,
  sectionIndex,
  traceId,
}: GenerateCourseSectionWorkflowOptions): Promise<Response> {
  const startedAt = Date.now();
  const trace = createLearnTrace(
    "generate-section-workflow",
    {
      userId,
      courseId,
      chapterIndex,
      sectionIndex,
    },
    traceId,
  );
  const telemetry = createTelemetryContext({
    endpoint: "/api/learn/generate",
    userId,
    workflow: "generate-course-section",
    promptVersion: "course-section@v3",
    modelPolicy: "structured-high-quality",
    metadata: {
      courseId,
      chapterIndex,
      sectionIndex,
    },
  });

  const course = await getOwnedCourseWithOutline(courseId, userId);
  if (!course) {
    trace.finish({
      found: false,
      reason: "course-not-found",
    });
    throw new APIError("课程不存在", 404, "NOT_FOUND");
  }
  trace.step("course-loaded", {
    title: course.title,
  });

  const outline = course.outline;
  const generationContext = await getUserGrowthContext(userId);
  const guidance = buildLearningGuidance({
    course,
    chapterIndex,
    growth: generationContext,
  });
  const chapter = outline.chapters[chapterIndex];
  if (!chapter || !guidance) {
    trace.finish({
      found: false,
      reason: "chapter-not-found",
    });
    throw new APIError("章节不存在", 404, "CHAPTER_NOT_FOUND");
  }

  const section = chapter.sections[sectionIndex];
  if (!section) {
    trace.finish({
      found: false,
      reason: "section-not-found",
    });
    throw new APIError("小节不存在", 404, "SECTION_NOT_FOUND");
  }

  const outlineNodeId = buildSectionOutlineNodeKey(chapterIndex, sectionIndex);
  const [existingSection] = await db
    .select({ id: courseSections.id, content: courseSections.contentMarkdown })
    .from(courseSections)
    .where(
      and(eq(courseSections.courseId, courseId), eq(courseSections.outlineNodeKey, outlineNodeId)),
    )
    .limit(1);
  trace.step("section-resolved", {
    outlineNodeId,
    sectionTitle: section.title,
    existedBefore: Boolean(existingSection?.id),
  });

  if (existingSection?.content) {
    trace.finish({
      cacheHit: true,
      outlineNodeId,
      sectionDocumentId: existingSection.id,
      contentLength: existingSection.content.length,
    });
    return Response.json({
      exists: true,
      content: existingSection.content,
      documentId: existingSection.id,
    });
  }

  const sectionGuidance = guidance.chapter.sections[sectionIndex];
  if (!sectionGuidance) {
    trace.finish({
      found: false,
      reason: "section-guidance-not-found",
    });
    throw new APIError("小节不存在", 404, "SECTION_NOT_FOUND");
  }

  const systemPrompt = buildSectionPrompt({
    guidance,
    sectionIndex,
  });
  trace.step("generation-start", {
    outlineNodeId,
    siblingCount: guidance.chapter.sections.length,
    chapterSkillCount: guidance.chapter.skillIds.length,
    alignmentRelation: sectionGuidance.alignment.relation,
    focusTitle: sectionGuidance.alignment.focusTitle,
  });

  const result = streamText({
    model: getModelForPolicy("structured-high-quality"),
    system: systemPrompt,
    prompt: buildCourseSectionUserPrompt(section.title),
    temperature: 0.5,
    experimental_transform: smoothStream({
      chunking: new Intl.Segmenter("zh-Hans", { granularity: "word" }),
    }),
    onFinish: async ({ text, totalUsage, finishReason, steps }) => {
      try {
        let sectionDocumentId = existingSection?.id ?? "";
        let indexJobId: string | null = null;

        if (existingSection) {
          await db
            .update(courseSections)
            .set({
              contentMarkdown: text,
              plainText: text,
              updatedAt: new Date(),
            })
            .where(eq(courseSections.id, existingSection.id));
        } else {
          const [inserted] = await db
            .insert(courseSections)
            .values({
              title: section.title,
              courseId,
              outlineNodeKey: outlineNodeId,
              contentMarkdown: text,
              plainText: text,
            })
            .onConflictDoNothing()
            .returning({ id: courseSections.id });
          sectionDocumentId = inserted?.id ?? "";
        }

        if (sectionDocumentId && text.length > 0) {
          const indexJob = await enqueueCourseSectionRagIndex({
            documentId: sectionDocumentId,
            plainText: text,
            userId,
            courseId,
          });
          indexJobId = indexJob?.id ?? null;
          trace.step("enqueue-index", {
            outlineNodeId,
            jobId: indexJobId,
          });

          invalidateChapterCache(courseId, chapterIndex).catch(() => {});
          revalidateLearnPage(userId, courseId);
        }

        trace.finish({
          cacheHit: false,
          outlineNodeId,
          finishReason,
          generatedChars: text.length,
          stepCount: steps.length,
          sectionDocumentId: sectionDocumentId || null,
          existedBefore: Boolean(existingSection?.id),
          queuedForIndex: Boolean(sectionDocumentId && text.length > 0),
          indexJobId,
        });

        await recordAIUsage({
          ...telemetry,
          usage: totalUsage,
          durationMs: Date.now() - startedAt,
          success: true,
          metadata: {
            ...telemetry.metadata,
            finishReason,
            stepCount: steps.length,
            outlineNodeId,
            sectionDocumentId: sectionDocumentId || null,
            existedBefore: Boolean(existingSection?.id),
            indexJobId,
          },
        });
      } catch (error) {
        console.error("[GenerateCourseSectionWorkflow] Failed to persist section:", error);
        trace.fail(error, {
          stage: "persist",
          outlineNodeId,
        });
        await recordAIUsage({
          ...telemetry,
          durationMs: Date.now() - startedAt,
          success: false,
          errorMessage: getErrorMessage(error),
        });
        throw error;
      }
    },
  });

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        console.error("[GenerateCourseSectionWorkflow] Stream error:", error);
        trace.fail(error, {
          stage: "stream",
          outlineNodeId,
        });
        await recordAIUsage({
          ...telemetry,
          durationMs: Date.now() - startedAt,
          success: false,
          errorMessage: getErrorMessage(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Course-Id": courseId,
      "X-Section-Id": outlineNodeId,
    },
  });
}
