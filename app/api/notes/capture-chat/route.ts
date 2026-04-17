import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tagGenerationService } from "@/lib/ai/services/tag-generation-service";
import { auth } from "@/lib/auth";
import { getLearningGuidance } from "@/lib/learning/guidance";
import {
  buildLearnChatCapturedHtml,
  buildLearnChatCapturedNoteTitle,
  buildLearnChatCapturedPlainText,
  type LearnChatCaptureMessage,
} from "@/lib/notes/capture";
import { createOwnedNote } from "@/lib/notes/write-service";

const CaptureChatNoteSchema = z.object({
  courseId: z.string().uuid(),
  chapterIndex: z.number().int().min(0),
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

    const { courseId, chapterIndex, messages } = parsed.data;
    const normalizedMessages = normalizeMessages(messages);

    if (normalizedMessages.length === 0) {
      return NextResponse.json({ error: "No valid messages to capture" }, { status: 400 });
    }

    const learningGuidance = await getLearningGuidance({
      userId,
      courseId,
      chapterIndex,
    });

    if (!learningGuidance) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const plainText = buildLearnChatCapturedPlainText({
      courseTitle: learningGuidance.course.title,
      chapterTitle: learningGuidance.chapter.title,
      messages: normalizedMessages,
    });
    const contentHtml = buildLearnChatCapturedHtml({
      courseTitle: learningGuidance.course.title,
      chapterTitle: learningGuidance.chapter.title,
      messages: normalizedMessages,
    });

    const note = await createOwnedNote({
      userId,
      title: buildLearnChatCapturedNoteTitle({
        chapterTitle: learningGuidance.chapter.title,
        messages: normalizedMessages,
      }),
      sourceType: "course_capture",
      sourceContext: {
        courseId,
        courseTitle: learningGuidance.course.title,
        sectionTitle: learningGuidance.chapter.title,
        chapterIndex: learningGuidance.chapter.index,
        chatCapture: true,
        messageCount: normalizedMessages.length,
        latestExcerpt: normalizedMessages[normalizedMessages.length - 1]?.text,
        source: "learn_chat_capture",
      },
      content: {
        kind: "both",
        contentHtml,
        plainText,
      },
    });

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
