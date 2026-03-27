import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courses, db, notes } from "@/db";
import { tagGenerationService } from "@/lib/ai/services/tag-generation-service";
import { auth } from "@/lib/auth";
import {
  buildLearnChatCapturedHtml,
  buildLearnChatCapturedNoteTitle,
  buildLearnChatCapturedPlainText,
  type LearnChatCaptureMessage,
} from "@/lib/notes/capture";
import { indexNote } from "@/lib/rag/chunker";

const CaptureChatNoteSchema = z.object({
  courseId: z.string().uuid(),
  courseTitle: z.string().min(1).max(200),
  chapterIndex: z.number().int().min(0).optional(),
  chapterTitle: z.string().max(200).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1).max(5000),
      }),
    )
    .min(1)
    .max(40),
});

function normalizeMessages(messages: LearnChatCaptureMessage[]) {
  return messages
    .map((item) => ({
      role: item.role,
      text: item.text.trim(),
    }))
    .filter((item) => item.text.length > 0)
    .slice(-20);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = CaptureChatNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { courseId, courseTitle, chapterIndex, chapterTitle, messages } = parsed.data;
    const normalizedMessages = normalizeMessages(messages);

    if (normalizedMessages.length === 0) {
      return NextResponse.json({ error: "No valid messages to capture" }, { status: 400 });
    }

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const plainText = buildLearnChatCapturedPlainText({
      courseTitle,
      chapterTitle,
      messages: normalizedMessages,
    });
    const contentHtml = buildLearnChatCapturedHtml({
      courseTitle,
      chapterTitle,
      messages: normalizedMessages,
    });

    const [note] = await db
      .insert(notes)
      .values({
        userId,
        title: buildLearnChatCapturedNoteTitle({
          chapterTitle,
          messages: normalizedMessages,
        }),
        sourceType: "course_capture",
        sourceContext: {
          courseId,
          courseTitle,
          sectionTitle: chapterTitle?.trim() || "学习对话",
          chapterIndex,
          chatCapture: true,
          messageCount: normalizedMessages.length,
          latestExcerpt: normalizedMessages[normalizedMessages.length - 1]?.text,
        },
        contentHtml,
        plainText,
      })
      .returning({
        id: notes.id,
        title: notes.title,
      });

    try {
      await indexNote(note.id, plainText, {
        userId,
        metadata: {
          sourceType: "course_capture",
          courseId,
          source: "learn_chat_capture",
        },
      });
    } catch (error) {
      console.error("[Notes Capture Chat] Failed to index note:", error);
    }

    try {
      await tagGenerationService.generateTags(note.id);
    } catch (error) {
      console.error("[Notes Capture Chat] Failed to generate tags:", error);
    }

    return NextResponse.json({
      success: true,
      note: {
        id: note.id,
        title: note.title,
      },
    });
  } catch (error) {
    console.error("[Notes Capture Chat] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
