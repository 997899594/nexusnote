// app/api/learn/generate/route.ts

import { streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { marked } from "marked";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSessions, db, documents } from "@/db";
import { aiProvider } from "@/lib/ai/core";
import { buildChapterPrompt } from "@/lib/ai/prompts/learn";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({
  courseId: z.string().uuid(),
  chapterIndex: z.number().int().min(0),
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

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new APIError("请求参数无效", 400, "VALIDATION_ERROR");
    }

    const { courseId, chapterIndex } = parsed.data;

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
        topics?: string[];
      }>;
    } | null;

    const chapter = outline?.chapters?.[chapterIndex];
    if (!chapter) {
      throw new APIError("章节不存在", 404, "CHAPTER_NOT_FOUND");
    }

    // Check if content already exists
    const outlineNodeId = `chapter-${chapterIndex + 1}`;
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

    // Build prompt
    const systemPrompt = buildChapterPrompt({
      courseTitle: course.title ?? "",
      courseDescription: outline?.description ?? "",
      targetAudience: outline?.targetAudience ?? "",
      difficulty: course.difficulty ?? "beginner",
      chapterIndex,
      chapterTitle: chapter.title,
      chapterDescription: chapter.description ?? "",
      topics: chapter.topics ?? [],
      totalChapters: outline?.chapters?.length ?? 0,
      outlineSummary:
        outline?.chapters
          ?.map((c: { title: string }, i: number) => `${i + 1}. ${c.title}`)
          .join("\n") ?? "",
    });

    // Stream text generation
    const result = streamText({
      model: aiProvider.proModel,
      system: systemPrompt,
      prompt: `请为「${chapter.title}」生成完整的教学内容。`,
      temperature: 0.5,
      onFinish: async ({ text }) => {
        try {
          // Convert markdown to HTML for Tiptap Editor
          const html = await marked.parse(text, { gfm: true, breaks: true });

          if (existingDoc) {
            await db
              .update(documents)
              .set({
                content: Buffer.from(html),
                plainText: text,
                updatedAt: new Date(),
              })
              .where(eq(documents.id, existingDoc.id));
          } else {
            await db.insert(documents).values({
              type: "course_chapter",
              title: chapter.title,
              courseId,
              outlineNodeId,
              content: Buffer.from(html),
              plainText: text,
            });
          }
        } catch (err) {
          console.error("[Learn/Generate] Failed to persist chapter content:", err);
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
        "X-Chapter-Index": String(chapterIndex),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
