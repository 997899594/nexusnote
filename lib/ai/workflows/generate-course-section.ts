import { smoothStream, streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { courseSections, db } from "@/db";
import { getModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { buildSectionPrompt } from "@/lib/ai/prompts/learn";
import { APIError } from "@/lib/api";
import { invalidateChapterCache } from "@/lib/cache/course-context";
import { revalidateLearnPage } from "@/lib/cache/tags";
import { getUserGrowthContext } from "@/lib/growth/generation-context";
import { buildLearningAlignmentBrief } from "@/lib/learning/alignment";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { createLearnTrace } from "@/lib/learning/observability";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import { ragQueue } from "@/lib/queue/rag-queue";

interface GenerateCourseSectionWorkflowOptions {
  userId: string;
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
  traceId?: string;
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
  const chapter = outline.chapters[chapterIndex];
  if (!chapter) {
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

  const siblingTitles = (chapter.sections ?? []).map((item) => item.title);
  const alignmentBrief = buildLearningAlignmentBrief({
    chapterTitle: chapter.title,
    chapterDescription: chapter.description ?? "",
    chapterSkillIds: chapter.skillIds,
    courseSkillIds: outline.courseSkillIds,
    sectionTitle: section.title,
    sectionDescription: section.description,
    generationContext,
  });
  const systemPrompt = buildSectionPrompt({
    courseTitle: course.title ?? "",
    courseDescription: outline.description ?? "",
    targetAudience: outline.targetAudience ?? "",
    difficulty: course.difficulty ?? "beginner",
    learningOutcome: outline.learningOutcome,
    courseSkillIds: outline.courseSkillIds,
    chapterIndex,
    chapterTitle: chapter.title,
    chapterDescription: chapter.description ?? "",
    chapterSkillIds: chapter.skillIds,
    sectionIndex,
    sectionTitle: section.title,
    sectionDescription: section.description,
    siblingTitles,
    totalChapters: outline.chapters.length,
    alignmentBrief,
  });
  trace.step("generation-start", {
    outlineNodeId,
    siblingCount: siblingTitles.length,
    chapterSkillCount: chapter.skillIds?.length ?? 0,
    alignmentRelation: alignmentBrief.relation,
    focusTitle: alignmentBrief.focusTitle,
  });

  const result = streamText({
    model: getModelForPolicy("structured-high-quality"),
    system: systemPrompt,
    prompt: `请为「${section.title}」生成教学内容。`,
    temperature: 0.5,
    experimental_transform: smoothStream({
      chunking: new Intl.Segmenter("zh-Hans", { granularity: "word" }),
    }),
    onFinish: async ({ text, totalUsage, finishReason, steps }) => {
      try {
        let sectionDocumentId = existingSection?.id ?? "";

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
          ragQueue
            .add("course-section", {
              type: "course_section",
              documentId: sectionDocumentId,
              plainText: text,
              userId,
              courseId,
              metadata: { chapterIndex, sectionIndex, sectionTitle: section.title },
            })
            .catch((err) => {
              console.error("[GenerateCourseSectionWorkflow] Failed to enqueue index job:", err);
              trace.step("enqueue-index-error", {
                outlineNodeId,
                error: err instanceof Error ? err.message : String(err),
              });
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
          },
        });
      } catch (error) {
        console.error("[GenerateCourseSectionWorkflow] Failed to persist section:", error);
        trace.step("persist-error", {
          outlineNodeId,
          error: error instanceof Error ? error.message : String(error),
        });
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
