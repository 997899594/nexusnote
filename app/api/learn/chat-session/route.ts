import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ensureLearnConversation } from "@/lib/chat/learn-conversations";
import { getLearningGuidance } from "@/lib/learning/guidance";
import { createLearnTrace } from "@/lib/learning/observability";

const LearnChatSessionQuerySchema = z.object({
  courseId: z.string().uuid(),
  chapterIndex: z.coerce.number().int().min(0),
});

export const GET = withAuth(async (request, { userId }) => {
  const trace = createLearnTrace("chat-session-route", {
    userId,
    method: request.method,
  });
  const { searchParams } = new URL(request.url);
  const parsed = LearnChatSessionQuerySchema.safeParse({
    courseId: searchParams.get("courseId"),
    chapterIndex: searchParams.get("chapterIndex"),
  });

  if (!parsed.success) {
    trace.fail(parsed.error, {
      stage: "validation",
    });
    return Response.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.issues } },
      { status: 400 },
    );
  }

  trace.step("request-validated", {
    courseId: parsed.data.courseId,
    chapterIndex: parsed.data.chapterIndex,
  });

  const learningGuidance = await getLearningGuidance({
    userId,
    courseId: parsed.data.courseId,
    chapterIndex: parsed.data.chapterIndex,
    traceId: trace.traceId,
  });

  if (!learningGuidance) {
    trace.finish({
      found: false,
      courseId: parsed.data.courseId,
      chapterIndex: parsed.data.chapterIndex,
    });
    return Response.json(
      { error: { code: "COURSE_NOT_FOUND", message: "课程不存在或无权限访问" } },
      { status: 404 },
    );
  }

  trace.step("learn-context-resolved", {
    courseId: learningGuidance.course.id,
    chapterTitle: learningGuidance.chapter.title,
    courseSkillCount: learningGuidance.course.skillIds.length,
    chapterSkillCount: learningGuidance.chapter.skillIds.length,
  });

  const session = await ensureLearnConversation({
    userId,
    courseId: learningGuidance.course.id,
    courseTitle: learningGuidance.course.title,
    chapterIndex: learningGuidance.chapter.index,
    chapterTitle: learningGuidance.chapter.title,
  });

  trace.finish({
    found: true,
    sessionId: session.id,
    messageCount: session.messageCount,
  });

  return Response.json({
    session: {
      id: session.id,
      title: session.title,
      intent: session.intent,
      messageCount: session.messageCount,
      lastMessageAt: session.lastMessageAt,
      metadata: session.metadata,
    },
  });
});
