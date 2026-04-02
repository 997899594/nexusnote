import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ensureLearnConversation } from "@/lib/chat/learn-conversations";
import { createLearnTrace } from "@/lib/learning/observability";
import { resolveOwnedLearnContext } from "@/lib/learning/resolve-learn-context";

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

  const learnContext = await resolveOwnedLearnContext({
    userId,
    courseId: parsed.data.courseId,
    chapterIndex: parsed.data.chapterIndex,
    traceId: trace.traceId,
  });

  if (!learnContext) {
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
    courseId: learnContext.courseId,
    chapterTitle: learnContext.chapterTitle,
    courseSkillCount: learnContext.courseSkillIds.length,
    chapterSkillCount: learnContext.chapterSkillIds.length,
  });

  const session = await ensureLearnConversation({
    userId,
    courseId: learnContext.courseId,
    courseTitle: learnContext.courseTitle,
    chapterIndex: learnContext.chapterIndex,
    chapterTitle: learnContext.chapterTitle,
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
