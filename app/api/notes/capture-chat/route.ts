import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tagGenerationService } from "@/lib/ai/services/tag-generation-service";
import { badRequest, notFound, parseJsonBodyAs, withAuth } from "@/lib/api";
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

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const { courseId, chapterIndex, messages } = await parseJsonBodyAs(
    request,
    CaptureChatNoteSchema,
  );
  const normalizedMessages = normalizeMessages(messages);

  if (normalizedMessages.length === 0) {
    throw badRequest("No valid messages to capture", "VALIDATION_ERROR");
  }

  const learningGuidance = await getLearningGuidance({
    userId,
    courseId,
    chapterIndex,
  });

  if (!learningGuidance) {
    throw notFound("Course not found", "COURSE_NOT_FOUND");
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
});
