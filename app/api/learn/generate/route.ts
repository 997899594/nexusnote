// app/api/learn/generate/route.ts

import { smoothStream, streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSessions, db, documents } from "@/db";
import { aiProvider } from "@/lib/ai/core";
import { buildSectionPrompt } from "@/lib/ai/prompts/learn";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { invalidateChapterCache } from "@/lib/cache/course-context";
import { ragQueue } from "@/lib/queue";
import { checkRateLimitOrThrow } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({
  courseId: z.string().uuid(),
  chapterIndex: z.number().int().min(0),
  sectionIndex: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // Rate limit: 20 generate requests per minute per user
    checkRateLimitOrThrow(`learn-generate:${userId}`, 20, 60 * 1000);

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new APIError("请求参数无效", 400, "VALIDATION_ERROR");
    }

    const { courseId, chapterIndex, sectionIndex } = parsed.data;

    // Verify course ownership
    const [course] = await db
      .select()
      .from(courseSessions)
      .where(and(eq(courseSessions.id, courseId), eq(courseSessions.userId, userId)))
      .limit(1);

    if (!course) {
      throw new APIError("课程不存在", 404, "NOT_FOUND");
    }

    const outline = course.outlineData as {
      title?: string;
      description?: string;
      targetAudience?: string;
      chapters?: Array<{
        title: string;
        description?: string;
        sections?: Array<{ title: string; description: string }>;
      }>;
    } | null;

    const chapter = outline?.chapters?.[chapterIndex];
    if (!chapter) {
      throw new APIError("章节不存在", 404, "CHAPTER_NOT_FOUND");
    }

    const section = chapter.sections?.[sectionIndex];
    if (!section) {
      throw new APIError("小节不存在", 404, "SECTION_NOT_FOUND");
    }

    // Check if content already exists
    const outlineNodeId = `section-${chapterIndex + 1}-${sectionIndex + 1}`;
    const [existingDoc] = await db
      .select({ id: documents.id, content: documents.content })
      .from(documents)
      .where(and(eq(documents.courseId, courseId), eq(documents.outlineNodeId, outlineNodeId)))
      .limit(1);

    if (existingDoc?.content) {
      const content = Buffer.isBuffer(existingDoc.content)
        ? existingDoc.content.toString("utf-8")
        : "";
      return NextResponse.json({
        exists: true,
        content,
        documentId: existingDoc.id,
      });
    }

    // Build section prompt
    const siblingTitles = (chapter.sections ?? []).map((s) => s.title);
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

    // Stream text generation with smoothStream for Chinese word boundaries
    const result = streamText({
      model: aiProvider.proModel,
      system: systemPrompt,
      prompt: `请为「${section.title}」生成教学内容。`,
      temperature: 0.5,
      experimental_transform: smoothStream({
        chunking: new Intl.Segmenter("zh-Hans", { granularity: "word" }),
      }),
      onFinish: async ({ text }) => {
        try {
          let docId: string;

          // Store raw Markdown (no HTML conversion) — StreamdownMessage renders Markdown directly
          if (existingDoc) {
            docId = existingDoc.id;
            await db
              .update(documents)
              .set({
                content: Buffer.from(text),
                plainText: text,
                updatedAt: new Date(),
              })
              .where(eq(documents.id, existingDoc.id));
          } else {
            const [inserted] = await db
              .insert(documents)
              .values({
                type: "course_section",
                title: section.title,
                courseId,
                outlineNodeId,
                content: Buffer.from(text),
                plainText: text,
              })
              .onConflictDoNothing()
              .returning({ id: documents.id });
            docId = inserted?.id ?? "";
          }

          // Queue indexing to knowledge_chunks for RAG search (with retry)
          if (docId && text.length > 0) {
            ragQueue
              .add("course-section", {
                type: "course_section",
                documentId: docId,
                plainText: text,
                userId,
                courseId,
                metadata: { chapterIndex, sectionIndex, sectionTitle: section.title },
              })
              .catch((err) => {
                console.error("[Learn/Generate] Failed to enqueue index job:", err);
              });
            invalidateChapterCache(courseId, chapterIndex).catch(() => {});
          }
        } catch (err) {
          console.error("[Learn/Generate] Failed to persist section content:", err);
        }
      },
    });

    // Return plain text stream
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          console.error("[Learn/Generate] Stream error:", err);
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
  } catch (error) {
    return handleError(error);
  }
}
