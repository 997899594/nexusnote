import { z } from "zod";
import { notFound, parseSearchParamsAs, withAuth } from "@/lib/api";
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
  const query = parseSearchParamsAs(request, LearnChatSessionQuerySchema);

  trace.step("request-validated", {
    courseId: query.courseId,
    chapterIndex: query.chapterIndex,
  });

  const learningGuidance = await getLearningGuidance({
    userId,
    courseId: query.courseId,
    chapterIndex: query.chapterIndex,
    traceId: trace.traceId,
  });

  if (!learningGuidance) {
    trace.finish({
      found: false,
      courseId: query.courseId,
      chapterIndex: query.chapterIndex,
    });
    throw notFound("课程不存在或无权限访问", "COURSE_NOT_FOUND");
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
    },
  });
});
