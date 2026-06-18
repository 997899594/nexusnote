import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, notFound, parseJsonBodyAs, withAuth } from "@/lib/api";
import { getLearningGuidance } from "@/lib/learning/guidance";
import {
  buildLearnChatCapturedHtml,
  buildLearnChatCapturedNoteTitle,
  buildLearnChatCapturedPlainText,
  buildLearnChatCaptureKey,
  type LearnChatCaptureMessage,
} from "@/lib/notes/capture";
import { scheduleCapturedNoteFollowups } from "@/lib/notes/capture-followups";
import { createOwnedNoteWithResult } from "@/lib/notes/write-service";

const CaptureChatNoteSchema = z.object({
  courseId: z.string().uuid(),
  chapterIndex: z.number().int().min(0),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(40),
});

const CAPTURED_CHAT_MESSAGE_TEXT_LIMIT = 5000;

function truncateMessageText(value: string): string {
  const normalized = value.trim();

  if (normalized.length <= CAPTURED_CHAT_MESSAGE_TEXT_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, CAPTURED_CHAT_MESSAGE_TEXT_LIMIT).trim()}...`;
}

function normalizeMessages(messages: LearnChatCaptureMessage[]) {
  return messages
    .map((item) => ({
      role: item.role,
      text: truncateMessageText(item.text),
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
  const captureKey = await buildLearnChatCaptureKey({
    courseId,
    chapterIndex,
    messages: normalizedMessages,
  });

  const { note, created } = await createOwnedNoteWithResult({
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
    dedupeKey: captureKey,
    content: {
      kind: "both",
      contentHtml,
      plainText,
    },
    followups: "deferred",
  });

  if (created) {
    await scheduleCapturedNoteFollowups({ userId, noteId: note.id });
  }

  return Response.json({
    success: true,
    note: {
      id: note.id,
      title: note.title,
    },
  });
});
