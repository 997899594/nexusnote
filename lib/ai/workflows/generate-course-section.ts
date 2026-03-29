import { smoothStream, streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { courseSections, courses, db } from "@/db";
import { getModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { buildSectionPrompt } from "@/lib/ai/prompts/learn";
import { APIError } from "@/lib/api";
import { invalidateChapterCache } from "@/lib/cache/course-context";
import { revalidateLearnPage } from "@/lib/cache/tags";
import { ragQueue } from "@/lib/queue";

interface GenerateCourseSectionWorkflowOptions {
  userId: string;
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
}

type CourseOutlineData = {
  title?: string;
  description?: string;
  targetAudience?: string;
  chapters?: Array<{
    title: string;
    description?: string;
    sections?: Array<{ title: string; description: string }>;
  }>;
};

export async function runGenerateCourseSectionWorkflow({
  userId,
  courseId,
  chapterIndex,
  sectionIndex,
}: GenerateCourseSectionWorkflowOptions): Promise<Response> {
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "/api/learn/generate",
    userId,
    workflow: "generate-course-section",
    promptVersion: "course-section@v1",
    modelPolicy: "structured-high-quality",
    metadata: {
      courseId,
      chapterIndex,
      sectionIndex,
    },
  });

  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1);

  if (!course) {
    throw new APIError("课程不存在", 404, "NOT_FOUND");
  }

  const outline = course.outlineData as CourseOutlineData | null;
  const chapter = outline?.chapters?.[chapterIndex];
  if (!chapter) {
    throw new APIError("章节不存在", 404, "CHAPTER_NOT_FOUND");
  }

  const section = chapter.sections?.[sectionIndex];
  if (!section) {
    throw new APIError("小节不存在", 404, "SECTION_NOT_FOUND");
  }

  const outlineNodeId = `section-${chapterIndex + 1}-${sectionIndex + 1}`;
  const [existingSection] = await db
    .select({ id: courseSections.id, content: courseSections.contentMarkdown })
    .from(courseSections)
    .where(
      and(eq(courseSections.courseId, courseId), eq(courseSections.outlineNodeId, outlineNodeId)),
    )
    .limit(1);

  if (existingSection?.content) {
    return Response.json({
      exists: true,
      content: existingSection.content,
      documentId: existingSection.id,
    });
  }

  const siblingTitles = (chapter.sections ?? []).map((item) => item.title);
  const systemPrompt = buildSectionPrompt({
    courseTitle: course.title ?? "",
    courseDescription: outline?.description ?? "",
    targetAudience: outline?.targetAudience ?? "",
    difficulty: course.difficulty ?? "beginner",
    chapterIndex,
    chapterTitle: chapter.title,
    chapterDescription: chapter.description ?? "",
    sectionIndex,
    sectionTitle: section.title,
    sectionDescription: section.description,
    siblingTitles,
    totalChapters: outline?.chapters?.length ?? 0,
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
              outlineNodeId,
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
            });

          invalidateChapterCache(courseId, chapterIndex).catch(() => {});
          revalidateLearnPage(userId, courseId);
        }

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
