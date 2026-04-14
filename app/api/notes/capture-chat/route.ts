import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tagGenerationService } from "@/lib/ai/services/tag-generation-service";
import { auth } from "@/lib/auth";
import { enqueueKnowledgeInsights } from "@/lib/career-tree/queue";
import { ingestEvidenceEvent } from "@/lib/knowledge/events";
import { aggregateSourceEventsToKnowledgeEvidence } from "@/lib/knowledge/evidence";
import { resolveOwnedLearnContext } from "@/lib/learning/resolve-learn-context";
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

    const learnContext = await resolveOwnedLearnContext({
      userId,
      courseId,
      chapterIndex,
    });

    if (!learnContext) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const plainText = buildLearnChatCapturedPlainText({
      courseTitle: learnContext.courseTitle,
      chapterTitle: learnContext.chapterTitle,
      messages: normalizedMessages,
    });
    const contentHtml = buildLearnChatCapturedHtml({
      courseTitle: learnContext.courseTitle,
      chapterTitle: learnContext.chapterTitle,
      messages: normalizedMessages,
    });

    const note = await createOwnedNote({
      userId,
      title: buildLearnChatCapturedNoteTitle({
        chapterTitle: learnContext.chapterTitle,
        messages: normalizedMessages,
      }),
      sourceType: "course_capture",
      sourceContext: {
        courseId,
        courseTitle: learnContext.courseTitle,
        sectionTitle: learnContext.chapterTitle,
        chapterIndex: learnContext.chapterIndex,
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

    await ingestEvidenceEvent({
      id: crypto.randomUUID(),
      userId,
      kind: "capture",
      sourceType: "note",
      sourceId: note.id,
      sourceVersionHash: null,
      title: note.title,
      summary: normalizedMessages[normalizedMessages.length - 1]?.text ?? note.title,
      confidence: 1,
      happenedAt: new Date().toISOString(),
      metadata: {
        courseId,
        chapterIndex,
        messageCount: normalizedMessages.length,
        courseTitle: learnContext.courseTitle,
        chapterTitle: learnContext.chapterTitle,
      },
      refs: normalizedMessages.map((message, index) => ({
        refType: `conversation_message_${message.role}`,
        refId: `${courseId}:${chapterIndex}:${index}`,
        snippet: message.text,
        weight: 1,
      })),
    });

    await aggregateSourceEventsToKnowledgeEvidence({
      userId,
      sourceType: "note",
      sourceId: note.id,
      sourceVersionHash: null,
    });
    await enqueueKnowledgeInsights(userId);

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
