/**
 * Course Generation API
 *
 * 处理课程生成请求
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { courseProfiles, db, documents } from "@/db";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, chapters, outline } = body;

    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const chapterCount = chapters || outline?.chapters?.length || 8;

    const [profile] = await db
      .insert(courseProfiles)
      .values({
        title,
        description: outline
          ? outline.chapters.map((c: { title: string }) => c.title).join(", ")
          : undefined,
        difficulty: "intermediate",
        interviewStatus: "completed",
        status: "chapter_generating",
      })
      .returning();

    for (let i = 0; i < chapterCount; i++) {
      const chapterTitle = outline?.chapters?.[i]?.title || `第 ${i + 1} 章`;
      const chapterDescription = outline?.chapters?.[i]?.description || "";

      await db.insert(documents).values({
        type: "course_chapter",
        title: chapterTitle,
        courseProfileId: profile.id,
        outlineNodeId: `chapter-${i + 1}`,
        content: Buffer.from(
          JSON.stringify({
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: chapterTitle }],
              },
              {
                type: "paragraph",
                content: [{ type: "text", text: chapterDescription || "本章节内容生成中..." }],
              },
            ],
          }),
        ),
      });
    }

    await db
      .update(courseProfiles)
      .set({
        interviewStatus: "completed",
        status: "completed",
        progress: {
          currentChapter: chapterCount,
          completedChapters: [],
          totalChapters: chapterCount,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      })
      .where(eq(courseProfiles.id, profile.id));

    return NextResponse.json({
      success: true,
      courseId: profile.id,
      title: profile.title,
      chapters: chapterCount,
    });
  } catch (error) {
    console.error("[GenerateCourse] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
